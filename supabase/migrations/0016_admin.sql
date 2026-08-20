-- 0016: the admin console — roles, suspensions, a report workflow and an
-- audit log.
--
-- Design rules, in order of importance:
--
--  1. NO privileged mutation is a plain table write. Every one is a
--     security-definer RPC that asserts the caller is an admin and writes
--     an admin_actions row in the same transaction, so "who removed this
--     and why" is always answerable. The app's anon key therefore never
--     needs elevated table grants, and the service_role key never has to
--     reach the browser.
--  2. Admins are marked by profiles.is_admin, which users CANNOT set on
--     themselves: the profiles update policy is still `auth.uid() = id`,
--     so a guard trigger rejects writes to the privileged columns unless
--     an admin RPC set app.admin_action for the statement (the same
--     technique 0001/0005 use for the system-maintained rating fields).
--  3. Reads widen only where moderation needs them. Admins see every
--     listing (including removed ones), the report queue and the audit
--     log. Private conversations stay private — an admin can read a
--     message ONLY when that message is the target of a report.
--  4. Suspension is an account-level stop on creating things (listings,
--     messages, bids). It never deletes history: a suspended user's past
--     trades, reviews and conversations stay readable so the other party
--     keeps their record.

-- ---------------------------------------------------------------------------
-- Role + suspension columns
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column is_admin boolean not null default false,
  add column suspended_at timestamptz,
  add column suspended_reason text,
  add constraint suspended_reason_length
    check (suspended_reason is null or char_length(suspended_reason) <= 300);

create index profiles_admins on public.profiles (id) where is_admin;
create index profiles_suspended on public.profiles (id) where suspended_at is not null;

-- Security definer so policies on profiles can call it without recursing
-- into profiles' own RLS.
create or replace function public.is_admin(p_user uuid default auth.uid())
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select coalesce((select p.is_admin from profiles p where p.id = p_user), false);
$$;

create or replace function public.is_suspended(p_user uuid default auth.uid())
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select coalesce(
    (select p.suspended_at is not null from profiles p where p.id = p_user),
    false);
$$;

-- is_admin / suspended_* are privileged: only the admin RPCs below may
-- write them, and they announce themselves with app.admin_action.
create or replace function public.enforce_privileged_profile_fields()
returns trigger
language plpgsql
as $$
begin
  if (new.is_admin is distinct from old.is_admin
      or new.suspended_at is distinct from old.suspended_at
      or new.suspended_reason is distinct from old.suspended_reason)
     and current_setting('app.admin_action', true) is distinct from '1' then
    raise exception 'role and suspension fields are set by admin actions only';
  end if;
  return new;
end;
$$;

create trigger profiles_privileged_fields
  before update on public.profiles
  for each row execute function public.enforce_privileged_profile_fields();

-- ---------------------------------------------------------------------------
-- Report workflow: the queue from 0006 gains a lifecycle and admin reads
-- ---------------------------------------------------------------------------

create type public.report_status as enum ('open', 'reviewing', 'resolved', 'dismissed');

alter table public.reports
  add column status public.report_status not null default 'open',
  add column resolved_by uuid references public.profiles (id) on delete set null,
  add column resolved_at timestamptz,
  add column resolution_note text,
  add constraint resolution_note_length
    check (resolution_note is null or char_length(resolution_note) <= 1000);

create index reports_queue on public.reports (status, created_at desc);

create policy "admins read the report queue"
  on public.reports for select
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------

create type public.admin_action_kind as enum (
  'user_suspend',
  'user_unsuspend',
  'user_promote',
  'user_demote',
  'user_clear_bid_ban',
  'listing_status',
  'listing_delete',
  'auction_cancel',
  'review_delete',
  'report_resolve'
);

create table public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles (id) on delete cascade,
  kind public.admin_action_kind not null,
  -- target_id is text (not uuid) because reports.target_id is: a target
  -- can be a listing, a user or a message.
  target_type text not null,
  target_id text not null,
  reason text not null default '',
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint reason_length check (char_length(reason) <= 500)
);

create index admin_actions_recent on public.admin_actions (created_at desc);
create index admin_actions_target on public.admin_actions (target_type, target_id);

alter table public.admin_actions enable row level security;

create policy "admins read the audit log"
  on public.admin_actions for select
  using (public.is_admin());

-- No insert/update/delete policies at all: the log is append-only and only
-- the security-definer RPCs below write to it. An admin cannot erase their
-- own trail through the API.

-- ---------------------------------------------------------------------------
-- Widened admin reads
-- ---------------------------------------------------------------------------

create policy "admins read every listing"
  on public.listings for select
  using (public.is_admin());

-- Deliberately narrow: conversations stay private. An admin can read a
-- message only once someone has reported that exact message, which is the
-- only case where judging it is the job.
create policy "admins read reported messages"
  on public.messages for select
  using (
    public.is_admin()
    and exists (
      select 1 from public.reports r
      where r.target_type = 'message' and r.target_id = messages.id::text
    )
  );

-- ---------------------------------------------------------------------------
-- Suspension enforcement — a suspended account creates nothing new
-- ---------------------------------------------------------------------------

drop policy "sellers insert own listings" on public.listings;
create policy "sellers insert own listings"
  on public.listings for insert
  with check (
    seller_id = auth.uid()
    and status = 'active'
    and not public.is_suspended()
  );

drop policy "participants send messages" on public.messages;
create policy "participants send messages"
  on public.messages for insert
  with check (
    kind = 'user'
    and sender_id = auth.uid()
    and public.is_conversation_participant(conversation_id)
    and not public.is_suspended()
    and not exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and public.is_blocked_between(c.buyer_id, c.seller_id)
    )
  );

-- Bidding already funnels through is_bid_banned() inside place_bid, so
-- extending that one predicate covers auctions (0015's no-show rule is
-- preserved verbatim).
create or replace function public.is_bid_banned(p_user uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select public.is_suspended(p_user)
    or (
      select count(*) >= 3
      from auction_no_shows
      where reported_id = p_user
        and role = 'winner'
        and created_at > now() - interval '90 days'
    );
$$;

-- ---------------------------------------------------------------------------
-- Admin RPC plumbing
-- ---------------------------------------------------------------------------

create or replace function public.require_admin()
returns uuid
language plpgsql
security definer set search_path = public
stable
as $$
begin
  if auth.uid() is null then
    raise exception 'sign in required';
  end if;
  if not public.is_admin() then
    raise exception 'this action is restricted to admins';
  end if;
  return auth.uid();
end;
$$;

create or replace function public.log_admin_action(
  p_actor uuid,
  p_kind public.admin_action_kind,
  p_target_type text,
  p_target_id text,
  p_reason text,
  p_detail jsonb default '{}'::jsonb
)
returns void
language sql
security definer set search_path = public
as $$
  insert into admin_actions (actor_id, kind, target_type, target_id, reason, detail)
  values (p_actor, p_kind, p_target_type, p_target_id, coalesce(trim(p_reason), ''), p_detail);
$$;

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------

create or replace function public.admin_set_suspended(
  p_user uuid,
  p_suspended boolean,
  p_reason text default ''
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_actor uuid := public.require_admin();
begin
  if p_user = v_actor then
    raise exception 'you cannot suspend your own account';
  end if;
  if p_suspended and (p_reason is null or length(trim(p_reason)) < 3) then
    raise exception 'a suspension reason is required';
  end if;
  if p_suspended and public.is_admin(p_user) then
    raise exception 'demote this admin before suspending the account';
  end if;

  perform set_config('app.admin_action', '1', true);
  update profiles set
    suspended_at = case when p_suspended then now() else null end,
    suspended_reason = case when p_suspended then trim(p_reason) else null end
  where id = p_user;
  if not found then
    raise exception 'user not found';
  end if;

  perform public.log_admin_action(
    v_actor,
    case when p_suspended then 'user_suspend' else 'user_unsuspend' end::public.admin_action_kind,
    'user', p_user::text, p_reason);
end;
$$;

create or replace function public.admin_set_admin(p_user uuid, p_is_admin boolean)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_actor uuid := public.require_admin();
begin
  -- Self-demotion is how you lock everyone out of the console by
  -- accident; another admin has to do it.
  if p_user = v_actor and not p_is_admin then
    raise exception 'another admin has to remove your own admin access';
  end if;
  if p_is_admin and public.is_suspended(p_user) then
    raise exception 'lift the suspension before granting admin access';
  end if;

  perform set_config('app.admin_action', '1', true);
  update profiles set is_admin = p_is_admin where id = p_user;
  if not found then
    raise exception 'user not found';
  end if;

  perform public.log_admin_action(
    v_actor,
    case when p_is_admin then 'user_promote' else 'user_demote' end::public.admin_action_kind,
    'user', p_user::text, '');
end;
$$;

-- Lift a bidding block by clearing the winner-role no-shows behind it
-- (0015). Used when a no-show report turns out to be retaliation.
create or replace function public.admin_clear_bid_ban(p_user uuid, p_reason text default '')
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_actor uuid := public.require_admin();
  v_n integer;
begin
  delete from auction_no_shows
    where reported_id = p_user and role = 'winner';
  get diagnostics v_n = row_count;
  perform public.log_admin_action(v_actor, 'user_clear_bid_ban', 'user', p_user::text,
    p_reason, jsonb_build_object('cleared', v_n));
  return v_n;
end;
$$;

-- ---------------------------------------------------------------------------
-- Listings
-- ---------------------------------------------------------------------------

-- Moderation overrides the seller-authored lifecycle: a fraudulent listing
-- has to come down even from `sold` (which is terminal for sellers). The
-- transition trigger is skipped for exactly this path.
create or replace function public.enforce_listing_transitions()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status
     and current_setting('app.admin_action', true) is distinct from '1' then
    if not (
      (old.status = 'active'   and new.status in ('reserved', 'sold', 'removed')) or
      (old.status = 'reserved' and new.status in ('active', 'sold', 'removed')) or
      (old.status = 'removed'  and new.status = 'active')
    ) then
      raise exception 'invalid listing status transition: % -> %', old.status, new.status;
    end if;
  end if;
  if new.status <> 'reserved' then
    new.reserved_for_conversation_id = null;
  end if;
  return new;
end;
$$;

-- The system message a moderated listing posts into its conversations has
-- to say a moderator did it — "Seller removed this listing" would be a lie.
create or replace function public.announce_listing_status()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  conv record;
  msg text;
  by_admin boolean := current_setting('app.admin_action', true) = '1';
begin
  if new.status is distinct from old.status then
    for conv in select id from conversations where listing_id = new.id loop
      msg := case
        when by_admin and new.status = 'removed' then
          'A moderator removed this listing.'
        when by_admin and new.status = 'active' then
          'A moderator restored this listing.'
        when new.status = 'reserved' then
          case when new.reserved_for_conversation_id = conv.id
            then 'Seller reserved this listing for this conversation.'
            else 'Seller marked this listing as reserved.'
          end
        when new.status = 'sold' then 'Seller marked this listing as sold.'
        when new.status = 'active' then 'Seller relisted this card — it is available again.'
        when new.status = 'removed' then 'Seller removed this listing.'
      end;
      if msg is not null then
        insert into messages (conversation_id, sender_id, kind, body)
          values (conv.id, null, 'system', msg);
      end if;
    end loop;
  end if;
  return new;
end;
$$;

create or replace function public.admin_set_listing_status(
  p_listing uuid,
  p_status public.listing_status,
  p_reason text default ''
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_actor uuid := public.require_admin();
  v_old public.listing_status;
begin
  select status into v_old from listings where id = p_listing for update;
  if not found then
    raise exception 'listing not found';
  end if;
  if v_old = p_status then
    return;
  end if;
  if p_status = 'removed' and (p_reason is null or length(trim(p_reason)) < 3) then
    raise exception 'a reason is required to remove a listing';
  end if;

  perform set_config('app.admin_action', '1', true);
  perform set_config('app.auction_price_sync', 'on', true);
  update listings set status = p_status where id = p_listing;

  perform public.log_admin_action(v_actor, 'listing_status', 'listing', p_listing::text,
    p_reason, jsonb_build_object('from', v_old, 'to', p_status));
end;
$$;

-- Hard delete, for listings that should not exist at all (illegal content,
-- spam floods). Cascades to images, conversations, offers and reviews, so
-- it is the last resort — removal is the everyday tool.
create or replace function public.admin_delete_listing(p_listing uuid, p_reason text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_actor uuid := public.require_admin();
  v_title text;
  v_seller uuid;
begin
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'a reason is required to delete a listing';
  end if;
  select title, seller_id into v_title, v_seller from listings where id = p_listing;
  if not found then
    raise exception 'listing not found';
  end if;

  perform set_config('app.admin_action', '1', true);
  delete from listings where id = p_listing;

  perform public.log_admin_action(v_actor, 'listing_delete', 'listing', p_listing::text,
    p_reason, jsonb_build_object('title', v_title, 'seller_id', v_seller));
end;
$$;

-- ---------------------------------------------------------------------------
-- Auctions
-- ---------------------------------------------------------------------------

-- Same shape as cancel_auction (0013) but for a moderator, and the bidders
-- are told it was a moderator rather than the seller.
create or replace function public.admin_cancel_auction(p_auction uuid, p_reason text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_actor uuid := public.require_admin();
  a record;
  b record;
  conv public.conversations;
begin
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'a cancellation reason is required';
  end if;
  select * into a from auctions where id = p_auction for update;
  if not found then
    raise exception 'auction not found';
  end if;
  if a.status <> 'live' then
    raise exception 'this auction is not live';
  end if;

  update auctions
    set status = 'cancelled', cancel_reason = trim(p_reason)
    where id = p_auction;

  perform set_config('app.admin_action', '1', true);
  perform set_config('app.auction_price_sync', 'on', true);
  update listings set status = 'removed'
    where id = a.listing_id and status = 'active';

  for b in select distinct bidder_id from bids where auction_id = p_auction loop
    select * into conv from conversations
      where listing_id = a.listing_id and buyer_id = b.bidder_id;
    if not found then
      insert into conversations (listing_id, buyer_id, seller_id)
        values (a.listing_id, b.bidder_id, a.seller_id)
        returning * into conv;
    end if;
    insert into messages (conversation_id, sender_id, kind, body)
      values (conv.id, null, 'system',
        'A moderator cancelled this auction. Reason: ' || trim(p_reason));
  end loop;

  perform public.log_admin_action(v_actor, 'auction_cancel', 'auction', p_auction::text,
    p_reason, jsonb_build_object('listing_id', a.listing_id));
end;
$$;

-- ---------------------------------------------------------------------------
-- Reviews
-- ---------------------------------------------------------------------------

-- Deleting a review has to re-roll the denormalized rating on the profile,
-- including back to NULL when it was the only one (the 0005 rollup trigger
-- is insert-only and its subquery yields no row for the last deletion).
create or replace function public.admin_delete_review(p_review uuid, p_reason text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_actor uuid := public.require_admin();
  v_reviewee uuid;
  v_rating integer;
begin
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'a reason is required to delete a review';
  end if;
  select reviewee_id, rating into v_reviewee, v_rating from reviews where id = p_review;
  if not found then
    raise exception 'review not found';
  end if;

  delete from reviews where id = p_review;

  perform set_config('app.allow_rating_write', '1', true);
  update profiles p set
    rating_avg = sub.avg_rating,
    rating_count = sub.n
  from (
    select round(avg(rating)::numeric, 2) as avg_rating, count(*) as n
    from reviews where reviewee_id = v_reviewee
  ) sub
  where p.id = v_reviewee;
  -- count(*) is 0 (not null) when the last review goes, so blank the average.
  update profiles set rating_avg = null where id = v_reviewee and rating_count = 0;

  perform public.log_admin_action(v_actor, 'review_delete', 'review', p_review::text,
    p_reason, jsonb_build_object('reviewee_id', v_reviewee, 'rating', v_rating));
end;
$$;

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------

create policy "admins update the report queue"
  on public.reports for update
  using (public.is_admin())
  with check (public.is_admin());

create or replace function public.admin_resolve_report(
  p_report uuid,
  p_status public.report_status,
  p_note text default ''
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_actor uuid := public.require_admin();
  v_settled boolean := p_status in ('resolved', 'dismissed');
begin
  update reports set
    status = p_status,
    resolution_note = nullif(trim(coalesce(p_note, '')), ''),
    resolved_by = case when v_settled then v_actor else null end,
    resolved_at = case when v_settled then now() else null end
  where id = p_report;
  if not found then
    raise exception 'report not found';
  end if;

  perform public.log_admin_action(v_actor, 'report_resolve', 'report', p_report::text,
    p_note, jsonb_build_object('status', p_status));
end;
$$;

-- ---------------------------------------------------------------------------
-- Dashboard counters — one round trip instead of a dozen head-count queries
-- ---------------------------------------------------------------------------

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
    'listingsActive',   (select count(*) from listings where status = 'active'),
    'listingsReserved', (select count(*) from listings where status = 'reserved'),
    'listingsSold',     (select count(*) from listings where status = 'sold'),
    'listingsRemoved',  (select count(*) from listings where status = 'removed'),
    'listingsNew7d',    (select count(*) from listings where created_at > now() - interval '7 days'),
    'auctionsLive',     (select count(*) from auctions where status = 'live'),
    'bids24h',          (select count(*) from bids where created_at > now() - interval '24 hours'),
    'reportsOpen',      (select count(*) from reports where status = 'open'),
    'reportsReviewing', (select count(*) from reports where status = 'reviewing'),
    'reviews',          (select count(*) from reviews),
    'messages24h',      (select count(*) from messages where created_at > now() - interval '24 hours'),
    'gmvListedActive',  (select coalesce(sum(price), 0) from listings where status = 'active'),
    'valueSold',        (select coalesce(sum(price), 0) from listings where status = 'sold')
  ) into v_out;
  return v_out;
end;
$$;

-- One row per account with the counts a moderator decides on. An RPC
-- because the alternative is a per-user fan-out of head counts from the
-- browser; the aggregation belongs next to the data.
create or replace function public.admin_users(p_query text default '', p_limit integer default 50)
returns jsonb
language plpgsql
security definer set search_path = public
stable
as $$
declare
  v_q text := '%' || lower(coalesce(trim(p_query), '')) || '%';
  v_out jsonb;
begin
  perform public.require_admin();
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_out
  from (
    select
      p.id,
      p.username,
      p.display_name,
      p.avatar_url,
      p.bio,
      p.rating_avg,
      p.rating_count,
      p.is_admin,
      p.suspended_at,
      p.suspended_reason,
      p.created_at,
      (select count(*) from listings l where l.seller_id = p.id) as listing_count,
      (select count(*) from listings l where l.seller_id = p.id and l.status = 'active') as active_count,
      (select count(*) from listings l where l.seller_id = p.id and l.status = 'sold') as sold_count,
      (select count(*) from reviews r where r.reviewee_id = p.id) as review_count,
      (
        select count(*) from reports r
        where (r.target_type = 'user' and r.target_id = p.id::text)
           or (r.target_type = 'listing' and r.target_id in
                 (select l.id::text from listings l where l.seller_id = p.id))
           or (r.target_type = 'message' and r.target_id in
                 (select m.id::text from messages m where m.sender_id = p.id))
      ) as reports_against,
      (
        select count(*) from auction_no_shows n
        where n.reported_id = p.id and n.role = 'winner'
          and n.created_at > now() - interval '90 days'
      ) as no_show_count,
      public.is_bid_banned(p.id) as bid_banned
    from profiles p
    where p_query is null or trim(p_query) = ''
       or lower(coalesce(p.username, '')) like v_q
       or lower(p.display_name) like v_q
       or p.id::text = trim(p_query)
    order by p.created_at desc
    limit greatest(1, least(p_limit, 200))
  ) t;
  return v_out;
end;
$$;

-- ---------------------------------------------------------------------------
-- Bootstrapping the first admin
-- ---------------------------------------------------------------------------
-- There is deliberately no way to become an admin through the app: the
-- first one is promoted once, by hand, from the SQL editor (the service
-- role bypasses RLS, and set_config satisfies the guard trigger):
--
--   select set_config('app.admin_action', '1', true);
--   update public.profiles set is_admin = true
--     where id = (select id from auth.users where email = 'you@example.com');
--
-- After that, admins promote each other from /admin.
