-- 0031: a listing goes public only once it is known to be a card.
--
-- Trolls were posting junk (memes, random photos, nothing at all) as
-- listings. Every listing a member creates now starts in review:
--
--   pending   only the seller (and moderators) can see it
--   approved  public, as before
--   rejected  a moderator said no; only the seller sees it, with the reason
--
-- How a listing leaves `pending`:
--
--  1. Screening. Right after the photos upload, the app asks the
--     /api/listings/screen function to look at them. It claims a screen
--     (claim_listing_screen, as the seller), asks the vision model whether
--     the photos show a trading card, and records the verdict
--     (record_listing_screen). Only a clear "card" approves; anything
--     else leaves the listing for a moderator and tells the moderators.
--     record_listing_screen only accepts a caller holding the screening
--     secret, which lives in the Vercel environment and, hashed, in
--     private.listing_screen_secret — so a seller can't approve their
--     own listing by calling it.
--  2. A moderator, from the review queue (admin_review_listing).
--
-- New photos on a listing send it back to `pending` (so a card can't be
-- swapped for junk after approval) and the app screens it again.
--
-- While a listing is pending or rejected nobody else can open a chat
-- about it, bid on it or watch it. An auction keeps its full running
-- time: the time it spent waiting is added back when it's approved, and
-- the closing sweep skips auctions that aren't public.
--
-- Listings that already exist stay approved. Rows written without a
-- signed-in user (the seed, the service role) keep what they're given,
-- which by default is approved; the guard below makes every member's
-- new listing pending.

-- ---------------------------------------------------------------------------
-- Review state on listings
-- ---------------------------------------------------------------------------

alter table public.listings
  add column review_state text not null default 'approved',
  add column review_note text,
  add column review_requested_at timestamptz,
  add column reviewed_at timestamptz,
  add column reviewed_by uuid references public.profiles (id) on delete set null,
  add constraint review_state_valid check (review_state in ('pending', 'approved', 'rejected')),
  add constraint review_note_length check (review_note is null or char_length(review_note) <= 500);

create index listings_review_queue on public.listings (review_requested_at)
  where review_state = 'pending';

alter type public.admin_action_kind add value if not exists 'listing_approve';
alter type public.admin_action_kind add value if not exists 'listing_reject';

-- Members can't set their own review. A new listing starts pending; the
-- review columns change only inside the screening and moderator
-- functions below, which announce themselves with app.listing_review.
create or replace function public.enforce_listing_review()
returns trigger
language plpgsql
as $$
begin
  if current_setting('app.listing_review', true) is not distinct from '1' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.review_state := 'pending';
      new.review_note := null;
      new.review_requested_at := now();
      new.reviewed_at := null;
      new.reviewed_by := null;
    end if;
    return new;
  end if;
  if new.review_state is distinct from old.review_state
     or new.review_note is distinct from old.review_note
     or new.review_requested_at is distinct from old.review_requested_at
     or new.reviewed_at is distinct from old.reviewed_at
     or new.reviewed_by is distinct from old.reviewed_by then
    raise exception 'a listing''s review is set by screening or a moderator';
  end if;
  return new;
end;
$$;

create trigger listings_review_guard
  before insert or update on public.listings
  for each row execute function public.enforce_listing_review();

-- New photos mean a new look at the listing.
create or replace function public.rereview_on_new_photo()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  perform set_config('app.listing_review', '1', true);
  update listings
    set review_state = 'pending',
        review_note = null,
        review_requested_at = now(),
        reviewed_at = null,
        reviewed_by = null
    where id = new.listing_id and review_state <> 'pending';
  perform set_config('app.listing_review', '', true);
  return new;
end;
$$;

create trigger listing_images_rereview
  after insert on public.listing_images
  for each row execute function public.rereview_on_new_photo();

-- ---------------------------------------------------------------------------
-- Who can see what
-- ---------------------------------------------------------------------------

-- Replaces 0003's rule: public rows must also be approved. The seller
-- always sees their own; people already in a conversation about it keep
-- seeing the listing they were talking about.
drop policy "listings readable unless removed" on public.listings;
create policy "listings readable when public"
  on public.listings for select
  using (
    (status <> 'removed' and review_state = 'approved')
    or seller_id = auth.uid()
    or public.is_conversation_party_for_listing(id)
  );

-- Auctions and bids follow their listing (they were readable by anyone).
drop policy "auctions are public" on public.auctions;
create policy "auctions follow their listing"
  on public.auctions for select
  using (exists (select 1 from public.listings l where l.id = listing_id));

drop policy "bids are public" on public.bids;
create policy "bids follow their auction"
  on public.bids for select
  using (exists (select 1 from public.auctions a where a.id = auction_id));

create or replace function public.listing_is_public(p_listing uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select coalesce(
    (select l.review_state = 'approved' from listings l where l.id = p_listing),
    false);
$$;

-- open_conversation(), place_bid() and favourites all run past RLS in
-- places, so the rule is enforced where the rows are written.
create or replace function public.require_public_listing()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_listing uuid;
begin
  if tg_table_name = 'bids' then
    select listing_id into v_listing from auctions where id = new.auction_id;
  else
    v_listing := new.listing_id;
  end if;
  if not public.listing_is_public(v_listing) then
    raise exception 'this listing is waiting for review';
  end if;
  return new;
end;
$$;

create trigger conversations_need_public_listing
  before insert on public.conversations
  for each row execute function public.require_public_listing();

create trigger bids_need_public_listing
  before insert on public.bids
  for each row execute function public.require_public_listing();

create trigger favorites_need_public_listing
  before insert on public.favorites
  for each row execute function public.require_public_listing();

-- The closing sweep leaves auctions that aren't public alone: their clock
-- is restarted when they're approved, and a rejected one is cancelled.
create or replace function public.close_due_auctions()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  a public.auctions;
  n integer := 0;
begin
  for a in
    select au.* from auctions au
    where au.status = 'live' and au.ends_at <= now()
      and public.listing_is_public(au.listing_id)
    for update of au skip locked
  loop
    perform public.close_auction_row(a);
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- Screening
-- ---------------------------------------------------------------------------

create table public.listing_screens (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  -- null while the check is running
  verdict text,
  reason text,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  constraint verdict_valid check (verdict is null or verdict in ('card', 'not_card', 'unsure', 'error')),
  constraint reason_length check (reason is null or char_length(reason) <= 500)
);

create index listing_screens_listing on public.listing_screens (listing_id, created_at desc);
create index listing_screens_seller on public.listing_screens (seller_id, created_at desc);

alter table public.listing_screens enable row level security;

create policy "sellers read own screens"
  on public.listing_screens for select
  using (seller_id = auth.uid());

create policy "admins read every screen"
  on public.listing_screens for select
  using (public.is_admin());
-- No write policies: the two functions below are the only door.

-- The screening secret. Not in an exposed schema, so the API can't reach
-- it; only its SHA-256 is stored.
create schema if not exists private;
revoke all on schema private from public;

create table if not exists private.listing_screen_secret (
  singleton boolean primary key default true check (singleton),
  secret_hash bytea not null,
  rotated_at timestamptz not null default now()
);
-- Belt and braces: no API role can reach it even if the schema were
-- exposed. The functions below run as the table owner, which RLS
-- doesn't restrict, so they still read and write it.
alter table private.listing_screen_secret enable row level security;
revoke all on private.listing_screen_secret from public, anon, authenticated;

-- Run in the SQL editor: `select private.rotate_listing_screen_secret();`
-- It returns a new secret once. Put it in the Vercel project as
-- LISTING_SCREEN_SECRET and redeploy; the old one stops working at once.
create or replace function private.rotate_listing_screen_secret()
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_secret text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  insert into private.listing_screen_secret (singleton, secret_hash, rotated_at)
    values (true, sha256(convert_to(v_secret, 'UTF8')), now())
  on conflict (singleton) do update
    set secret_hash = excluded.secret_hash, rotated_at = excluded.rotated_at;
  return v_secret;
end;
$$;
revoke execute on function private.rotate_listing_screen_secret() from public;

-- Called as the seller, before the model is paid for. Three checks per
-- listing and 30 a day per seller; past that, moderators decide.
create or replace function public.claim_listing_screen(p_listing uuid)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  l record;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  select id, seller_id, review_state into l from listings where id = p_listing for update;
  if not found or l.seller_id <> auth.uid() then
    raise exception 'listing not found';
  end if;
  if l.review_state <> 'pending' then
    raise exception 'this listing is not waiting for review';
  end if;
  if (select count(*) from listing_screens where listing_id = p_listing) >= 3 then
    raise exception 'this listing has been checked too many times; a moderator will look at it';
  end if;
  if (select count(*) from listing_screens
      where seller_id = auth.uid() and created_at > now() - interval '24 hours') >= 30 then
    raise exception 'too many listings checked today; a moderator will look at this one';
  end if;
  insert into listing_screens (listing_id, seller_id)
    values (p_listing, auth.uid())
    returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.claim_listing_screen(uuid) from public, anon;
grant execute on function public.claim_listing_screen(uuid) to authenticated;

-- Approve one listing (shared by screening and moderators). An auction
-- gets back the time it spent waiting.
create or replace function public.approve_listing_row(p_listing uuid, p_actor uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_since timestamptz;
begin
  select review_requested_at into v_since from listings where id = p_listing;
  perform set_config('app.listing_review', '1', true);
  update listings
    set review_state = 'approved',
        review_note = null,
        reviewed_at = now(),
        reviewed_by = p_actor
    where id = p_listing;
  perform set_config('app.listing_review', '', true);
  if v_since is not null then
    update auctions
      set ends_at = ends_at + (now() - v_since)
      where listing_id = p_listing and status = 'live';
  end if;
end;
$$;
revoke execute on function public.approve_listing_row(uuid, uuid) from public, anon, authenticated;

create or replace function public.record_listing_screen(
  p_screen uuid,
  p_secret text,
  p_verdict text,
  p_reason text
)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_hash bytea;
  s record;
  l record;
  v_reason text := left(coalesce(trim(p_reason), ''), 500);
begin
  select secret_hash into v_hash from private.listing_screen_secret;
  if v_hash is null or p_secret is null
     or sha256(convert_to(p_secret, 'UTF8')) <> v_hash then
    raise exception 'screening is not authorised';
  end if;
  if p_verdict is null or p_verdict not in ('card', 'not_card', 'unsure', 'error') then
    raise exception 'unknown verdict';
  end if;

  select * into s from listing_screens where id = p_screen for update;
  if not found then
    raise exception 'screen not found';
  end if;
  if s.finished_at is not null then
    raise exception 'screen already recorded';
  end if;
  update listing_screens
    set verdict = p_verdict, reason = v_reason, finished_at = now()
    where id = p_screen;

  select id, seller_id, title, review_state into l
    from listings where id = s.listing_id for update;
  if not found then
    return 'pending';
  end if;
  if l.review_state <> 'pending' then
    return l.review_state;
  end if;

  -- Once a moderator has turned a listing down, only a moderator can put
  -- it up: new photos on it go to the queue whatever the check says.
  if p_verdict = 'card' and not exists (
    select 1 from admin_actions
    where kind = 'listing_reject' and target_type = 'listing' and target_id = l.id::text
  ) then
    perform public.approve_listing_row(l.id, null);
    return 'approved';
  end if;

  perform public.notify_staff('moderation', 'Listing waiting for review',
    l.title || case when v_reason <> '' then ' — ' || v_reason else '' end,
    '/admin?tab=review', l.seller_id, 'review:' || l.id::text);
  return 'pending';
end;
$$;
revoke execute on function public.record_listing_screen(uuid, text, text, text) from public, anon;
grant execute on function public.record_listing_screen(uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Moderators
-- ---------------------------------------------------------------------------

-- Approve (from pending or rejected) or reject (from pending or
-- approved; a reason is required and the seller sees it). A rejected
-- auction is cancelled.
create or replace function public.admin_review_listing(
  p_listing uuid,
  p_approve boolean,
  p_reason text default ''
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_actor uuid := public.require_admin();
  l record;
  v_reason text := left(coalesce(trim(p_reason), ''), 500);
begin
  select id, seller_id, title, review_state into l from listings where id = p_listing for update;
  if not found then
    raise exception 'listing not found';
  end if;

  if p_approve then
    if l.review_state = 'approved' then
      return;
    end if;
    perform public.approve_listing_row(p_listing, v_actor);
    perform public.notify(l.seller_id, 'moderation', 'Your listing is live',
      l.title, '/listing/' || p_listing::text, v_actor, null);
    perform public.log_admin_action(v_actor, 'listing_approve', 'listing', p_listing::text,
      v_reason, jsonb_build_object('from', l.review_state));
    return;
  end if;

  if l.review_state = 'rejected' then
    return;
  end if;
  if length(v_reason) < 3 then
    raise exception 'a reason is required to reject a listing';
  end if;
  perform set_config('app.listing_review', '1', true);
  update listings
    set review_state = 'rejected',
        review_note = v_reason,
        reviewed_at = now(),
        reviewed_by = v_actor
    where id = p_listing;
  perform set_config('app.listing_review', '', true);
  update auctions
    set status = 'cancelled', cancel_reason = 'Listing not approved: ' || v_reason
    where listing_id = p_listing and status = 'live';
  perform public.notify(l.seller_id, 'moderation', 'Your listing wasn''t approved',
    l.title || ' — ' || v_reason, '/listing/' || p_listing::text, v_actor, null);
  perform public.log_admin_action(v_actor, 'listing_reject', 'listing', p_listing::text,
    v_reason, jsonb_build_object('from', l.review_state));
end;
$$;

-- The overview gains the queue size.
create or replace function public.admin_stats()
returns jsonb
language plpgsql
security definer set search_path = public
stable
as $$
declare
  v_out jsonb;
begin
  perform public.require_admin();
  select jsonb_build_object(
    'users',            (select count(*) from profiles),
    'usersNew7d',       (select count(*) from profiles where created_at > now() - interval '7 days'),
    'suspended',        (select count(*) from profiles where suspended_at is not null),
    'admins',           (select count(*) from profiles where is_admin),
    'listingsActive',   (select count(*) from listings where status = 'active' and review_state = 'approved'),
    'listingsReserved', (select count(*) from listings where status = 'reserved'),
    'listingsSold',     (select count(*) from listings where status = 'sold'),
    'listingsRemoved',  (select count(*) from listings where status = 'removed'),
    'listingsNew7d',    (select count(*) from listings where created_at > now() - interval '7 days'),
    'listingsPending',  (select count(*) from listings where review_state = 'pending' and status <> 'removed'),
    'auctionsLive',     (select count(*) from auctions where status = 'live'),
    'bids24h',          (select count(*) from bids where created_at > now() - interval '24 hours'),
    'reportsOpen',      (select count(*) from reports where status = 'open'),
    'reportsReviewing', (select count(*) from reports where status = 'reviewing'),
    'reviews',          (select count(*) from reviews),
    'messages24h',      (select count(*) from messages where created_at > now() - interval '24 hours'),
    'gmvListedActive',  (select coalesce(sum(price), 0) from listings where status = 'active' and review_state = 'approved'),
    'valueSold',        (select coalesce(sum(price), 0) from listings where status = 'sold')
  ) into v_out;
  return v_out;
end;
$$;
