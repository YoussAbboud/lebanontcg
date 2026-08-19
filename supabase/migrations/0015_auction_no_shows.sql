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
