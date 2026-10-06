-- ==========================================================================
-- LebanonTCG — UPDATE script: migration 0019 (plans and the paywall)
--
-- Three listings are free; after that a seller buys a pack of listings or
-- subscribes. Subscriptions also unlock the Pre-Grade estimator, which
-- costs real money to run.
--
-- Nothing here charges a card: a purchase is REQUESTED by the user and
-- switched on by an admin (Admin → Billing), which is the same function a
-- payment webhook would call later. That keeps bank transfer / OMT /
-- Whish first-class.
--
-- Apply after 0018. Run it ONCE.
--
-- HOW TO USE: Supabase dashboard → SQL Editor → New query → paste this
-- entire file → Run.
-- ==========================================================================


-- ───────────────────────────────────────────────────────────────────────
-- BEGIN supabase/migrations/0019_plans.sql
-- ───────────────────────────────────────────────────────────────────────
-- 0019: plans, listing quota and the Pre-Grade gate.
--
-- Listing a card is free for the first few; past that a seller either
-- buys a pack of listings or subscribes. Subscriptions also unlock the
-- Pre-Grade estimator, which costs real money to run (vision model
-- calls) and is the clearest thing to put behind the paywall.
--
-- Payment capture is deliberately NOT modelled as a card processor
-- here: a purchase is REQUESTED by the user and ACTIVATED by an admin
-- (or by a future webhook calling the same activation function). That
-- keeps bank transfer / OMT / Whish — how money actually moves in
-- Lebanon — first-class, and leaves one seam for a processor later.

create type public.plan_tier as enum ('free', 'monthly', 'yearly');
create type public.purchase_kind as enum ('subscription', 'credits');
create type public.purchase_status as enum ('pending', 'active', 'rejected', 'expired', 'cancelled');

-- Prices live in a table so they change without a deploy.
create table public.plans (
  code text primary key,
  kind public.purchase_kind not null,
  tier public.plan_tier,
  /** Credits granted — subscriptions are unlimited and leave this null. */
  credits integer,
  /** Billing period in months (subscriptions only). */
  period_months integer,
  price_usd numeric(10, 2) not null check (price_usd >= 0),
  label text not null,
  blurb text not null default '',
  sort_order integer not null default 0,
  active boolean not null default true,
  constraint subscription_shape check (
    (kind = 'subscription' and tier is not null and period_months > 0 and credits is null)
    or (kind = 'credits' and credits > 0 and tier is null and period_months is null)
  )
);

alter table public.plans enable row level security;
create policy "plans are public" on public.plans for select using (true);

insert into public.plans (code, kind, tier, credits, period_months, price_usd, label, blurb, sort_order) values
  ('monthly', 'subscription', 'monthly', null, 1, 5.00, 'Monthly',
   'Unlimited listings and the Pre-Grade estimator, billed monthly.', 1),
  ('yearly', 'subscription', 'yearly', null, 12, 45.00, 'Yearly',
   'Unlimited listings and Pre-Grade — two months cheaper than monthly.', 2),
  ('credits_5', 'credits', null, 5, null, 5.00, '5 listings',
   'Five extra listings. They never expire.', 3),
  ('credits_15', 'credits', null, 15, null, 12.00, '15 listings',
   'Fifteen extra listings. They never expire.', 4);

-- How many listings a brand-new account gets before paying.
create or replace function public.free_listing_allowance()
returns integer language sql immutable as $$ select 3 $$;

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan_code text not null references public.plans (code),
  tier public.plan_tier not null check (tier <> 'free'),
  status public.purchase_status not null default 'pending',
  period_start timestamptz,
  period_end timestamptz,
  /** What the buyer told us about their payment (reference, method). */
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_user on public.subscriptions (user_id, status);
-- One live subscription per account; history stays.
create unique index subscriptions_one_active
  on public.subscriptions (user_id) where status = 'active';

create table public.listing_credit_packs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan_code text references public.plans (code),
  credits integer not null check (credits > 0),
  used integer not null default 0 check (used >= 0),
  status public.purchase_status not null default 'pending',
  note text not null default '',
  created_at timestamptz not null default now(),
  constraint used_within_credits check (used <= credits)
);
create index credit_packs_user on public.listing_credit_packs (user_id, status);

alter table public.subscriptions enable row level security;
alter table public.listing_credit_packs enable row level security;

create policy "users read own subscriptions" on public.subscriptions for select
  using (user_id = auth.uid() or public.is_admin());
create policy "users read own credit packs" on public.listing_credit_packs for select
  using (user_id = auth.uid() or public.is_admin());
-- No insert/update policies: everything goes through the functions below.

-- Listings created, ever. A count of live rows would hand the free slot
-- back on every delete, so the tally lives on its own and only grows.
create table public.listing_counters (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  created integer not null default 0
);
alter table public.listing_counters enable row level security;
create policy "users read own counter" on public.listing_counters for select
  using (user_id = auth.uid() or public.is_admin());
-- No write policies: only the definer trigger below touches this.

-- Accounts that listed before this migration keep what they have used.
insert into public.listing_counters (user_id, created)
  select seller_id, count(*) from public.listings group by seller_id
  on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- Entitlements
-- ---------------------------------------------------------------------------

create or replace function public.has_active_subscription(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from subscriptions s
    where s.user_id = p_user
      and s.status = 'active'
      and (s.period_end is null or s.period_end > now())
  );
$$;

create or replace function public.listing_credits_remaining(p_user uuid default auth.uid())
returns integer
language sql
stable
security definer set search_path = public
as $$
  select coalesce(sum(p.credits - p.used), 0)::integer
  from listing_credit_packs p
  where p.user_id = p_user and p.status = 'active';
$$;

create or replace function public.listings_created(p_user uuid default auth.uid())
returns integer
language sql
stable
security definer set search_path = public
as $$
  -- Lifetime: the free allowance is a trial, not a concurrency cap, so
  -- removing a listing doesn't hand the slot back. The live count is the
  -- floor, for any account whose counter was never seeded.
  select greatest(
    coalesce((select c.created from listing_counters c where c.user_id = p_user), 0),
    (select count(*)::integer from listings l where l.seller_id = p_user)
  );
$$;

/** Admins and subscribers list without limit; everyone else spends the
    free allowance first, then bought credits. */
create or replace function public.can_create_listing(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select public.is_admin(p_user)
      or public.has_active_subscription(p_user)
      or public.listings_created(p_user) < public.free_listing_allowance()
      or public.listing_credits_remaining(p_user) > 0;
$$;

/** The Pre-Grade estimator runs paid vision-model calls — subscribers
    and admins only. */
create or replace function public.can_use_pregrade(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select public.is_admin(p_user) or public.has_active_subscription(p_user);
$$;

/** Everything the UI needs to explain where someone stands. */
create or replace function public.my_entitlements()
returns jsonb
language sql
stable
security definer set search_path = public
as $$
  select jsonb_build_object(
    'is_admin', public.is_admin(),
    'subscribed', public.has_active_subscription(),
    'tier', (select s.tier from subscriptions s
             where s.user_id = auth.uid() and s.status = 'active'
             order by s.created_at desc limit 1),
    'period_end', (select s.period_end from subscriptions s
                   where s.user_id = auth.uid() and s.status = 'active'
                   order by s.created_at desc limit 1),
    'free_allowance', public.free_listing_allowance(),
    'listings_created', public.listings_created(),
    'credits_remaining', public.listing_credits_remaining(),
    'can_create_listing', public.can_create_listing(),
    'can_use_pregrade', public.can_use_pregrade(),
    'pending_requests', (select count(*) from subscriptions s
                         where s.user_id = auth.uid() and s.status = 'pending')
                      + (select count(*) from listing_credit_packs p
                         where p.user_id = auth.uid() and p.status = 'pending')
  );
$$;

-- ---------------------------------------------------------------------------
-- The quota, enforced where listings are born
-- ---------------------------------------------------------------------------

create or replace function public.enforce_listing_quota()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_pack uuid;
  v_created integer;
begin
  -- Seed the tally from whatever the account already has, then lock it:
  -- two listings posted at once must not both see the same count.
  insert into listing_counters (user_id, created)
    values (new.seller_id,
            (select count(*) from listings where seller_id = new.seller_id))
    on conflict (user_id) do nothing;
  select created into v_created
    from listing_counters where user_id = new.seller_id for update;

  if not (public.is_admin(new.seller_id)
          or public.has_active_subscription(new.seller_id))
     and v_created >= public.free_listing_allowance() then
    -- Spend the oldest pack with room left.
    select id into v_pack
      from listing_credit_packs
      where user_id = new.seller_id and status = 'active' and used < credits
      order by created_at asc
      limit 1
      for update;
    if v_pack is null then
      raise exception 'listing limit reached: your % free listings are used — buy listings or subscribe',
        public.free_listing_allowance();
    end if;
    update listing_credit_packs set used = used + 1 where id = v_pack;
  end if;

  update listing_counters set created = created + 1 where user_id = new.seller_id;
  return new;
end;
$$;

create trigger listings_quota
  before insert on public.listings
  for each row execute function public.enforce_listing_quota();

-- Pre-grade reports are a paid feature: gate them at the row level too,
-- so the entitlement can't be bypassed by calling the API directly.
drop policy "owners insert own reports" on public.pregrade_reports;
create policy "owners insert own reports" on public.pregrade_reports
  for insert with check (user_id = auth.uid() and public.can_use_pregrade());

-- ---------------------------------------------------------------------------
-- Buying: request now, activate on confirmation
-- ---------------------------------------------------------------------------

create or replace function public.request_purchase(p_plan_code text, p_note text default '')
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  pl record;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if public.is_suspended() then
    raise exception 'suspended accounts cannot buy';
  end if;
  select * into pl from plans where code = p_plan_code and active;
  if not found then
    raise exception 'unknown plan';
  end if;
  if pl.kind = 'subscription' then
    if exists (select 1 from subscriptions
               where user_id = auth.uid() and status = 'pending') then
      raise exception 'you already have a subscription request waiting';
    end if;
    insert into subscriptions (user_id, plan_code, tier, note)
      values (auth.uid(), pl.code, pl.tier, coalesce(p_note, ''))
      returning id into v_id;
  else
    insert into listing_credit_packs (user_id, plan_code, credits, note)
      values (auth.uid(), pl.code, pl.credits, coalesce(p_note, ''))
      returning id into v_id;
  end if;
  return v_id;
end;
$$;

/** Activate a subscription for a user — the seam a payment webhook
    would call. Admin-only today. */
create or replace function public.admin_activate_subscription(
  p_user uuid,
  p_plan_code text,
  p_reason text default ''
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  pl record;
begin
  perform public.require_admin();
  select * into pl from plans where code = p_plan_code and kind = 'subscription';
  if not found then
    raise exception 'unknown subscription plan';
  end if;
  -- Supersede any current subscription, then open the new period.
  update subscriptions set status = 'cancelled', updated_at = now()
    where user_id = p_user and status in ('active', 'pending');
  insert into subscriptions (user_id, plan_code, tier, status, period_start, period_end, note)
    values (p_user, pl.code, pl.tier, 'active', now(),
            now() + make_interval(months => pl.period_months), coalesce(p_reason, ''));
  perform public.log_admin_action(auth.uid(), 'user_promote', 'user', p_user::text,
    'Subscription activated: ' || pl.code
    || case when p_reason <> '' then ' — ' || p_reason else '' end);
end;
$$;

create or replace function public.admin_end_subscription(p_user uuid, p_reason text default '')
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.require_admin();
  update subscriptions set status = 'cancelled', updated_at = now()
    where user_id = p_user and status in ('active', 'pending');
  perform public.log_admin_action(auth.uid(), 'user_demote', 'user', p_user::text,
    'Subscription ended' || case when p_reason <> '' then ' — ' || p_reason else '' end);
end;
$$;

create or replace function public.admin_grant_credits(
  p_user uuid,
  p_credits integer,
  p_reason text default ''
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.require_admin();
  if p_credits is null or p_credits <= 0 then
    raise exception 'credits must be positive';
  end if;
  insert into listing_credit_packs (user_id, credits, status, note)
    values (p_user, p_credits, 'active', coalesce(p_reason, ''));
  perform public.log_admin_action(auth.uid(), 'user_promote', 'user', p_user::text,
    p_credits || ' listing credits granted'
    || case when p_reason <> '' then ' — ' || p_reason else '' end);
end;
$$;

/** Approve or reject a pending request (subscription or credit pack). */
create or replace function public.admin_review_purchase(
  p_kind public.purchase_kind,
  p_id uuid,
  p_approve boolean,
  p_reason text default ''
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_user uuid;
  v_plan text;
begin
  perform public.require_admin();
  if p_kind = 'subscription' then
    select user_id, plan_code into v_user, v_plan from subscriptions
      where id = p_id and status = 'pending';
    if v_user is null then
      raise exception 'no pending subscription request with that id';
    end if;
    if p_approve then
      -- Activation supersedes the request itself.
      perform public.admin_activate_subscription(v_user, v_plan, p_reason);
    else
      update subscriptions set status = 'rejected', updated_at = now() where id = p_id;
    end if;
  else
    select user_id into v_user from listing_credit_packs
      where id = p_id and status = 'pending';
    if v_user is null then
      raise exception 'no pending credit request with that id';
    end if;
    update listing_credit_packs
      set status = (case when p_approve then 'active' else 'rejected' end)::public.purchase_status
      where id = p_id;
  end if;
  perform public.log_admin_action(auth.uid(), 'report_resolve', 'user', v_user::text,
    (case when p_approve then 'Approved ' else 'Rejected ' end) || p_kind::text || ' purchase'
    || case when p_reason <> '' then ' — ' || p_reason else '' end);
end;
$$;

/** Pending requests for the admin billing queue. */
create or replace function public.admin_list_purchases(p_status public.purchase_status default 'pending')
returns table (
  kind public.purchase_kind,
  id uuid,
  user_id uuid,
  username text,
  display_name text,
  plan_code text,
  credits integer,
  price_usd numeric,
  status public.purchase_status,
  note text,
  created_at timestamptz
)
language sql
stable
security definer set search_path = public
as $$
  select 'subscription'::public.purchase_kind, s.id, s.user_id, p.username, p.display_name,
         s.plan_code, null::integer, pl.price_usd, s.status, s.note, s.created_at
    from subscriptions s
    join profiles p on p.id = s.user_id
    left join plans pl on pl.code = s.plan_code
   where public.is_admin() and s.status = p_status
  union all
  select 'credits'::public.purchase_kind, c.id, c.user_id, p.username, p.display_name,
         c.plan_code, c.credits, pl.price_usd, c.status, c.note, c.created_at
    from listing_credit_packs c
    join profiles p on p.id = c.user_id
    left join plans pl on pl.code = c.plan_code
   where public.is_admin() and c.status = p_status
  order by created_at desc;
$$;

-- Subscriptions lapse on their own; a sweep keeps status honest for the
-- unique index and the admin views (entitlement checks already compare
-- period_end, so a late sweep never grants access it shouldn't).
create or replace function public.expire_subscriptions()
returns integer
language sql
security definer set search_path = public
as $$
  with done as (
    update subscriptions set status = 'expired', updated_at = now()
    where status = 'active' and period_end is not null and period_end <= now()
    returning 1
  )
  select count(*)::integer from done;
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('expire-subscriptions', '7 * * * *',
      'select public.expire_subscriptions()');
  end if;
exception when others then
  null;
end
$$;

-- ───────────────────────────────────────────────────────────────────────
-- END supabase/migrations/0019_plans.sql
-- ───────────────────────────────────────────────────────────────────────
