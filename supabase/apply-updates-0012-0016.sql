-- ==========================================================================
-- LebanonTCG — UPDATE script for an EXISTING project
-- Applies only migrations 0012–0016 (pre-grade diagram column + the whole
-- Live Auctions feature). Use this when the project already runs 0001–0011.
--
-- HOW TO USE: Supabase dashboard → SQL Editor → New query → paste this
-- entire file → Run. Run it ONCE. (0012 is a no-op if already applied.)
--
-- Optional but recommended afterwards, for on-the-minute auction closes:
--   Database → Extensions → enable pg_cron, then run:
--   select cron.schedule('close-auctions', '* * * * *',
--                        'select public.close_due_auctions()');
-- Without it, auctions still close correctly on read (lazy close).
-- ==========================================================================


-- ──────────────────────────────────────────────────────────────────────────
-- BEGIN supabase/migrations/0012_pregrade_diagram.sql
-- ──────────────────────────────────────────────────────────────────────────
-- 0012: photo-backed centering diagrams.
-- Stores the eight measured guide positions (normalised 0-1 to the card
-- box) per face, plus whether each face's capture was corner-pinned and
-- flattened — only then do the lines land truthfully on the photo.
-- Null on rows saved before this migration; the UI falls back to the
-- abstract diagram.

alter table public.pregrade_reports
  add column if not exists diagram jsonb;

-- ──────────────────────────────────────────────────────────────────────────
-- END supabase/migrations/0012_pregrade_diagram.sql
-- ──────────────────────────────────────────────────────────────────────────


-- ──────────────────────────────────────────────────────────────────────────
-- BEGIN supabase/migrations/0013_auctions.sql
-- ──────────────────────────────────────────────────────────────────────────
-- 0013: live auctions — sale_type split, auction/bid tables, and ALL
-- bid/close rules as Postgres functions. A bid is a public, non-binding
-- signal: no money moves, the platform holds nothing and enforces no
-- sale. The client never validates a bid for real — place_bid() is the
-- rule, the client check is a nicety.
--
-- Adaptation note: this schema has one price column (listings.price).
-- For auctions it MIRRORS the current top bid (starting price until the
-- first bid) so grids, sorting and price filters keep working unchanged.
-- The mirror is maintained only by the security-definer functions below;
-- a trigger rejects any other price write on an auction listing.

create type public.sale_type as enum ('fixed', 'auction');
create type public.auction_status as enum ('live', 'closed', 'cancelled');

alter table public.listings
  add column sale_type public.sale_type not null default 'fixed';

create table public.auctions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null unique references public.listings (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  starting_price numeric(12, 2) not null,
  reserve_price numeric(12, 2),
  currency text not null,
  ends_at timestamptz not null,
  status public.auction_status not null default 'live',
  winner_id uuid references public.profiles (id) on delete set null,
  winning_bid numeric(12, 2),
  cancel_reason text,
  created_at timestamptz not null default now(),
  constraint starting_price_positive check (starting_price > 0 and starting_price <= 1000000),
  constraint reserve_above_start check (reserve_price is null or reserve_price >= starting_price)
);

create index auctions_live_ending on public.auctions (status, ends_at);

create table public.bids (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.auctions (id) on delete cascade,
  bidder_id uuid not null references public.profiles (id) on delete cascade,
  amount numeric(12, 2) not null,
  -- true when this bid landed in the final minute and pushed ends_at out
  extended boolean not null default false,
  created_at timestamptz not null default now(),
  constraint bid_positive check (amount > 0)
);

create index bids_auction on public.bids (auction_id, created_at desc);
create index bids_auction_amount on public.bids (auction_id, amount desc, created_at asc);

-- ---------------------------------------------------------------------------
-- The two listing types own different behaviour, enforced not documented
-- ---------------------------------------------------------------------------

-- sale_type is chosen once, at creation, for the life of the listing.
create or replace function public.enforce_listing_sale_type()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.sale_type is distinct from old.sale_type then
    raise exception 'sale_type is immutable — close this listing and create a new one';
  end if;
  if new.sale_type = 'auction' and new.quantity <> 1 then
    raise exception 'auctions are for a single card (quantity must be 1)';
  end if;
  -- The price of an auction listing mirrors the current bid and is only
  -- written by the auction functions.
  if tg_op = 'UPDATE'
     and new.sale_type = 'auction'
     and new.price is distinct from old.price
     and current_setting('app.auction_price_sync', true) is distinct from 'on' then
    raise exception 'an auction listing''s price is set by bidding, not edited';
  end if;
  return new;
end;
$$;

create trigger listings_sale_type_guard
  before insert or update on public.listings
  for each row execute function public.enforce_listing_sale_type();

-- Every auction listing must have its auctions row by commit (created in
-- the same transaction), and only auction listings may have one.
create or replace function public.enforce_auction_pairing()
returns trigger
language plpgsql
as $$
begin
  if new.sale_type = 'auction'
     and not exists (select 1 from public.auctions where listing_id = new.id) then
    raise exception 'auction listing has no auction row — create both in one transaction';
  end if;
  return new;
end;
$$;

create constraint trigger listings_auction_pairing
  after insert or update on public.listings
  deferrable initially deferred
  for each row execute function public.enforce_auction_pairing();

create or replace function public.enforce_auction_insert()
returns trigger
language plpgsql
as $$
declare
  l record;
begin
  select seller_id, sale_type, currency into l
    from public.listings where id = new.listing_id;
  if not found then
    raise exception 'listing not found';
  end if;
  if l.sale_type <> 'auction' then
    raise exception 'a fixed-price listing cannot have an auction';
  end if;
  if new.seller_id <> l.seller_id then
    raise exception 'auction seller must be the listing seller';
  end if;
  if new.currency <> l.currency then
    raise exception 'auction currency must match the listing';
  end if;
  if new.ends_at <= now() then
    raise exception 'auction must end in the future';
  end if;
  return new;
end;
$$;

create trigger auctions_insert_guard
  before insert on public.auctions
  for each row execute function public.enforce_auction_insert();

-- Bids are append-only: placed via place_bid(), never edited.
create or replace function public.forbid_bid_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'bids cannot be changed';
end;
$$;

create trigger bids_immutable
  before update on public.bids
  for each row execute function public.forbid_bid_mutation();

-- ---------------------------------------------------------------------------
-- RLS: auctions and bids are public reading; writes go through functions
-- ---------------------------------------------------------------------------

alter table public.auctions enable row level security;
alter table public.bids enable row level security;

create policy "auctions are public"
  on public.auctions for select
  using (true);

-- Creation happens client-side in the same transaction as the listing.
create policy "sellers create own auctions"
  on public.auctions for insert
  with check (auth.uid() = seller_id);

-- No update/delete policies: status changes go through the security-
-- definer functions below; rows die with the listing (cascade).

create policy "bids are public"
  on public.bids for select
  using (true);

-- No bid insert policy: place_bid() is the only door.

-- ---------------------------------------------------------------------------
-- The bidding rule, in one place
-- ---------------------------------------------------------------------------

-- Minimum next bid: 5% of the current bid rounded up to a whole unit,
-- floor of 1 unit; the first bid may equal the starting price.
create or replace function public.min_next_bid(p_current numeric, p_starting numeric)
returns numeric
language sql
immutable
as $$
  select case
    when p_current is null then p_starting
    else p_current + greatest(1, ceiling(p_current * 0.05))
  end;
$$;

-- Placeholder until no-show tracking lands (a later migration replaces
-- it): nobody is banned from bidding yet.
create or replace function public.is_bid_banned(p_user uuid)
returns boolean
language sql
stable
as $$
  select false;
$$;

create or replace function public.place_bid(p_auction_id uuid, p_amount numeric)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  a record;
  v_current numeric;
  v_min numeric;
  v_extend boolean;
  v_bid public.bids;
  v_ends timestamptz;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  select * into a from auctions where id = p_auction_id for update;
  if not found then
    raise exception 'auction not found';
  end if;
  if a.status <> 'live' or a.ends_at <= now() then
    raise exception 'this auction has ended';
  end if;
  if a.seller_id = auth.uid() then
    raise exception 'sellers cannot bid on their own auction';
  end if;
  if public.is_blocked_between(auth.uid(), a.seller_id) then
    raise exception 'you cannot bid on this auction';
  end if;
  if public.is_bid_banned(auth.uid()) then
    raise exception 'bidding is blocked on this account after repeated no-shows';
  end if;

  select max(amount) into v_current from bids where auction_id = p_auction_id;
  v_min := public.min_next_bid(v_current, a.starting_price);
  if p_amount < v_min then
    raise exception 'minimum bid is %', trim(to_char(v_min, 'FM999999990.00'));
  end if;
  if p_amount > 1000000 then
    raise exception 'bid too large';
  end if;

  -- Anti-snipe: a bid inside the final minute pushes the close out 60s.
  v_extend := a.ends_at - now() < interval '60 seconds';
  v_ends := a.ends_at;
  if v_extend then
    v_ends := a.ends_at + interval '60 seconds';
    update auctions set ends_at = v_ends where id = p_auction_id;
  end if;

  insert into bids (auction_id, bidder_id, amount, extended)
    values (p_auction_id, auth.uid(), p_amount, v_extend)
    returning * into v_bid;

  -- Mirror the top bid onto the listing so grids/sorting stay truthful.
  perform set_config('app.auction_price_sync', 'on', true);
  update listings set price = p_amount where id = a.listing_id;

  return jsonb_build_object(
    'bid_id', v_bid.id,
    'amount', v_bid.amount,
    'ends_at', v_ends,
    'extended', v_extend
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Closing — shared by the cron sweep, lazy close, and seller end-early
-- ---------------------------------------------------------------------------

-- Close one due auction: resolve the winner against the reserve, open
-- the winner<->seller conversation, post the handoff system message,
-- park the listing. Assumes the caller holds the row lock.
create or replace function public.close_auction_row(a public.auctions)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  top record;
  conv public.conversations;
  v_handle text;
begin
  select bidder_id, amount into top
    from bids
    where auction_id = a.id
    order by amount desc, created_at asc
    limit 1;

  perform set_config('app.auction_price_sync', 'on', true);

  if top is not null and (a.reserve_price is null or top.amount >= a.reserve_price) then
    select * into conv from conversations
      where listing_id = a.listing_id and buyer_id = top.bidder_id;
    if not found then
      insert into conversations (listing_id, buyer_id, seller_id)
        values (a.listing_id, top.bidder_id, a.seller_id)
        returning * into conv;
    end if;
    select coalesce('@' || username, display_name) into v_handle
      from profiles where id = top.bidder_id;
    insert into messages (conversation_id, sender_id, kind, body)
      values (conv.id, null, 'system',
        v_handle || ' won this auction at ' || a.currency || ' '
        || trim(to_char(top.amount, 'FM999999990.00'))
        || '. Sort out payment and delivery between yourselves — LebanonTCG isn''t part of the transaction.');
    update auctions
      set status = 'closed', winner_id = top.bidder_id, winning_bid = top.amount
      where id = a.id;
    update listings
      set status = 'reserved', reserved_for_conversation_id = conv.id
      where id = a.listing_id and status = 'active';
  else
    -- No bids, or the reserve wasn't met: nobody wins, the card stays
    -- with the seller. The listing leaves browse; Relist creates a new one.
    update auctions set status = 'closed' where id = a.id;
    update listings set status = 'removed'
      where id = a.listing_id and status = 'active';
  end if;
end;
$$;

-- The sweep: pg_cron runs it every minute, and clients call it lazily on
-- read so a stale auction never renders as live when cron is behind.
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
    select * from auctions
    where status = 'live' and ends_at <= now()
    for update skip locked
  loop
    perform public.close_auction_row(a);
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Seller ends the auction now: the highest bid (if any) wins as-is.
create or replace function public.end_auction_early(p_auction_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  a public.auctions;
begin
  select * into a from auctions where id = p_auction_id for update;
  if not found then
    raise exception 'auction not found';
  end if;
  if a.seller_id <> auth.uid() then
    raise exception 'only the seller can end this auction';
  end if;
  if a.status <> 'live' then
    raise exception 'this auction is not live';
  end if;
  update auctions set ends_at = now() where id = p_auction_id;
  a.ends_at := now();
  perform public.close_auction_row(a);
end;
$$;

-- Seller cancels: no winner, reason required, every bidder notified via
-- a system message in a conversation with the seller.
create or replace function public.cancel_auction(p_auction_id uuid, p_reason text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  a record;
  b record;
  conv public.conversations;
begin
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'a cancellation reason is required';
  end if;
  select * into a from auctions where id = p_auction_id for update;
  if not found then
    raise exception 'auction not found';
  end if;
  if a.seller_id <> auth.uid() then
    raise exception 'only the seller can cancel this auction';
  end if;
  if a.status <> 'live' then
    raise exception 'this auction is not live';
  end if;

  update auctions
    set status = 'cancelled', cancel_reason = trim(p_reason)
    where id = p_auction_id;
  perform set_config('app.auction_price_sync', 'on', true);
  update listings set status = 'removed'
    where id = a.listing_id and status = 'active';

  for b in select distinct bidder_id from bids where auction_id = p_auction_id loop
    select * into conv from conversations
      where listing_id = a.listing_id and buyer_id = b.bidder_id;
    if not found then
      insert into conversations (listing_id, buyer_id, seller_id)
        values (a.listing_id, b.bidder_id, a.seller_id)
        returning * into conv;
    end if;
    insert into messages (conversation_id, sender_id, kind, body)
      values (conv.id, null, 'system',
        'The seller cancelled this auction. Reason: ' || trim(p_reason));
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Realtime + cron (both best-effort; lazy close is the safety net)
-- ---------------------------------------------------------------------------

do $$
begin
  alter publication supabase_realtime add table public.auctions;
  alter publication supabase_realtime add table public.bids;
exception when others then
  null; -- publication may not exist outside Supabase
end
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('close-auctions', '* * * * *', 'select public.close_due_auctions()');
  end if;
exception when others then
  null; -- pg_cron not enabled: lazy close on read still keeps state honest
end
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- END supabase/migrations/0013_auctions.sql
-- ──────────────────────────────────────────────────────────────────────────


-- ──────────────────────────────────────────────────────────────────────────
-- BEGIN supabase/migrations/0014_create_auction_listing.sql
-- ──────────────────────────────────────────────────────────────────────────
-- 0014: atomic auction-listing creation. The pairing constraint (0013)
-- demands listing + auction in ONE transaction, which two PostgREST
-- calls can never be — so creation is an RPC. Runs as the caller
-- (security invoker): the normal listing/auction RLS insert policies
-- still apply.

create or replace function public.create_auction_listing(
  p_input jsonb,
  p_starting_price numeric,
  p_reserve_price numeric,
  p_duration_hours integer
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_listing_id uuid;
  v_currency text := coalesce(nullif(p_input->>'currency', ''), 'USD');
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if p_duration_hours is null or p_duration_hours not in (1, 6, 24, 72, 168) then
    raise exception 'invalid auction duration';
  end if;

  insert into public.listings
    (seller_id, title, game, set_name, card_number, language, condition,
     finish, grade_company, grade_value, price, currency, quantity,
     description, sale_type)
  values
    (auth.uid(),
     p_input->>'title',
     (p_input->>'game')::public.game_type,
     coalesce(p_input->>'set_name', ''),
     coalesce(p_input->>'card_number', ''),
     coalesce(nullif(p_input->>'language', ''), 'English'),
     (p_input->>'condition')::public.condition_type,
     coalesce(nullif(p_input->>'finish', ''), 'normal')::public.finish_type,
     nullif(p_input->>'grade_company', ''),
     nullif(p_input->>'grade_value', ''),
     -- the listing price mirrors the current bid; it starts at the floor
     p_starting_price,
     v_currency,
     1,
     coalesce(p_input->>'description', ''),
     'auction')
  returning id into v_listing_id;

  insert into public.auctions
    (listing_id, seller_id, starting_price, reserve_price, currency, ends_at)
  values
    (v_listing_id, auth.uid(), p_starting_price, p_reserve_price, v_currency,
     now() + make_interval(hours => p_duration_hours));

  return v_listing_id;
end;
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- END supabase/migrations/0014_create_auction_listing.sql
-- ──────────────────────────────────────────────────────────────────────────


-- ──────────────────────────────────────────────────────────────────────────
-- BEGIN supabase/migrations/0015_auction_no_shows.sql
-- ──────────────────────────────────────────────────────────────────────────
-- 0015: auction accountability. Non-binding bids plus no payment rail
-- means winners can vanish — after a closed auction the seller can mark
-- the winner as a no-show (and the winner can mirror it for an
-- unresponsive seller). Three winner no-shows within 90 days blocks an
-- account from BIDDING — listings and chat are unaffected. Every report
-- also lands in the existing report queue.

create table public.auction_no_shows (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.auctions (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reported_id uuid not null references public.profiles (id) on delete cascade,
  -- who failed to follow through
  role text not null check (role in ('winner', 'seller')),
  created_at timestamptz not null default now(),
  constraint one_report_per_side unique (auction_id, reporter_id)
);

create index auction_no_shows_reported
  on public.auction_no_shows (reported_id, role, created_at desc);

alter table public.auction_no_shows enable row level security;

-- Accountability is public reading; writing goes through the function.
create policy "no-shows are public"
  on public.auction_no_shows for select
  using (true);

create or replace function public.report_auction_no_show(p_auction_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  a record;
  v_reported uuid;
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  select * into a from auctions where id = p_auction_id;
  if not found then
    raise exception 'auction not found';
  end if;
  if a.status <> 'closed' or a.winner_id is null then
    raise exception 'no-shows can only be reported on a closed auction with a winner';
  end if;
  if auth.uid() = a.seller_id then
    v_reported := a.winner_id;
    v_role := 'winner';
  elsif auth.uid() = a.winner_id then
    v_reported := a.seller_id;
    v_role := 'seller';
  else
    raise exception 'only the seller or the winner can report a no-show';
  end if;

  insert into auction_no_shows (auction_id, reporter_id, reported_id, role)
    values (p_auction_id, auth.uid(), v_reported, v_role);

  -- Feed the existing report queue so moderation sees the pattern.
  insert into reports (reporter_id, target_type, target_id, reason, detail)
    values (auth.uid(), 'user', v_reported::text, 'other',
      'Auction no-show (' || v_role || ') on auction ' || p_auction_id);
end;
$$;

-- Replace the 0013 placeholder: three winner no-shows in 90 days block
-- an account from bidding.
create or replace function public.is_bid_banned(p_user uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select count(*) >= 3
  from auction_no_shows
  where reported_id = p_user
    and role = 'winner'
    and created_at > now() - interval '90 days';
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- END supabase/migrations/0015_auction_no_shows.sql
-- ──────────────────────────────────────────────────────────────────────────


-- ──────────────────────────────────────────────────────────────────────────
-- BEGIN supabase/migrations/0016_no_show_grace.sql
-- ──────────────────────────────────────────────────────────────────────────
-- 0016: no-shows need time to actually happen, and a misfile needs an
-- undo. Reporting one seconds after the close was possible (and read as
-- an accusation the UI offered immediately) — it now requires a grace
-- period, and the reporter can retract their own report.

-- Nobody has failed to follow through within a day of winning.
create or replace function public.report_auction_no_show(p_auction_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  a record;
  v_reported uuid;
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  select * into a from auctions where id = p_auction_id;
  if not found then
    raise exception 'auction not found';
  end if;
  if a.status <> 'closed' or a.winner_id is null then
    raise exception 'no-shows can only be reported on a closed auction with a winner';
  end if;
  if now() < a.ends_at + interval '24 hours' then
    raise exception 'give them a day — no-shows can be reported 24 hours after the auction closes';
  end if;
  if auth.uid() = a.seller_id then
    v_reported := a.winner_id;
    v_role := 'winner';
  elsif auth.uid() = a.winner_id then
    v_reported := a.seller_id;
    v_role := 'seller';
  else
    raise exception 'only the seller or the winner can report a no-show';
  end if;

  insert into auction_no_shows (auction_id, reporter_id, reported_id, role)
    values (p_auction_id, auth.uid(), v_reported, v_role);

  insert into reports (reporter_id, target_type, target_id, reason, detail)
    values (auth.uid(), 'user', v_reported::text, 'other',
      'Auction no-show (' || v_role || ') on auction ' || p_auction_id);
end;
$$;

-- Retract your own report: the strike and its queue entry both go, so a
-- misfiled accusation leaves no trace on the other person's record.
create or replace function public.retract_auction_no_show(p_auction_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auction_no_shows
    where auction_id = p_auction_id and reporter_id = auth.uid()
    returning role into v_role;
  if v_role is null then
    raise exception 'nothing to retract';
  end if;
  delete from reports
    where reporter_id = auth.uid()
      and target_type = 'user'
      and detail = 'Auction no-show (' || v_role || ') on auction ' || p_auction_id;
end;
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- END supabase/migrations/0016_no_show_grace.sql
-- ──────────────────────────────────────────────────────────────────────────

