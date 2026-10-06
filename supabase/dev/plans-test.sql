-- Plans, listing quota and the Pre-Grade gate (0019). Every rule the
-- paywall rests on is checked here against the database, because the UI
-- can be bypassed and the API cannot. Run after all migrations on a
-- fresh database; ids are distinct from rls-test.sql and auction-test.sql.
\set ON_ERROR_STOP off
\set QUIET on
\pset tuples_only on

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'free@plan.dev'),
  ('00000000-0000-0000-0000-0000000000b2', 'buyer@plan.dev'),
  ('00000000-0000-0000-0000-0000000000b3', 'sub@plan.dev'),
  ('00000000-0000-0000-0000-0000000000b4', 'boss@plan.dev'),
  ('00000000-0000-0000-0000-0000000000b5', 'lapsed@plan.dev');

-- b4 is the admin. Privileged profile fields announce themselves.
set app.admin_action = '1';
update public.profiles set is_admin = true
  where id = '00000000-0000-0000-0000-0000000000b4';
set app.admin_action = '0';

select 'P01 the four plans are seeded: ' || (count(*) = 4)::text from public.plans;
select 'P02 monthly is $5 and yearly $45: '
  || ((select price_usd from public.plans where code = 'monthly') = 5.00
      and (select price_usd from public.plans where code = 'yearly') = 45.00)::text;
select 'P03 the free allowance is three: ' || (public.free_listing_allowance() = 3)::text;

-- ---------------------------------------------------------------------------
-- The free allowance
-- ---------------------------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b1';

insert into public.listings (seller_id, title, game, condition, price)
  select auth.uid(), 'Free ' || n, 'pokemon', 'NM', 10 from generate_series(1, 3) n;
select 'P04 three free listings go through: ' || (public.listings_created() = 3)::text;
select 'P05 the fourth is not allowed: ' || (public.can_create_listing() = false)::text;

insert into public.listings (seller_id, title, game, condition, price)
  values (auth.uid(), 'Over the line', 'pokemon', 'NM', 10);
select 'P06 (expect error above: listing limit reached)';
select 'P07 the blocked listing did not land: ' || (public.listings_created() = 3)::text;

select 'P08 entitlements explain the wall: '
  || ((public.my_entitlements()->>'free_allowance') = '3'
      and (public.my_entitlements()->>'listings_created') = '3'
      and (public.my_entitlements()->>'credits_remaining') = '0'
      and (public.my_entitlements()->>'can_create_listing') = 'false'
      and (public.my_entitlements()->>'subscribed') = 'false')::text;

-- Deleting a listing does not hand the slot back: the allowance is a
-- trial, not a concurrency cap.
delete from public.listings where seller_id = auth.uid() and title = 'Free 1';
select 'P09 deleting does not refund the allowance: '
  || (public.can_create_listing() = false)::text;

-- ---------------------------------------------------------------------------
-- Buying listings: request, approve, spend
-- ---------------------------------------------------------------------------
select 'P10 a request is recorded: '
  || (public.request_purchase('credits_5', 'OMT ref 12345') is not null)::text;
select 'P11 a pending request grants nothing yet: '
  || (public.can_create_listing() = false and public.listing_credits_remaining() = 0)::text;
select 'P12 entitlements count the pending request: '
  || ((public.my_entitlements()->>'pending_requests') = '1')::text;

-- Users cannot write the tables directly — the functions are the only door.
insert into public.listing_credit_packs (user_id, credits, status)
  values (auth.uid(), 99, 'active');
select 'P13 (expect error above: no insert policy on credit packs)';
select 'P14 self-granted credits rejected: '
  || (public.listing_credits_remaining() = 0)::text;

update public.listing_credit_packs set status = 'active' where user_id = auth.uid();
select 'P15 users cannot activate their own request: '
  || (public.listing_credits_remaining() = 0)::text;

-- A non-admin cannot grant credits either.
select public.admin_grant_credits('00000000-0000-0000-0000-0000000000b1', 50);
select 'P16 (expect error above: admin only)';

-- The admin approves it.
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b4';
select 'P17 the queue shows the pending request: '
  || (count(*) = 1)::text
  from public.admin_list_purchases('pending')
  where user_id = '00000000-0000-0000-0000-0000000000b1' and kind = 'credits';
select public.admin_review_purchase('credits', id, true, 'payment confirmed')
  from public.listing_credit_packs
  where user_id = '00000000-0000-0000-0000-0000000000b1' and status = 'pending';

set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b1';
select 'P18 approval hands over five listings: '
  || (public.listing_credits_remaining() = 5
      and public.can_create_listing())::text;

insert into public.listings (seller_id, title, game, condition, price)
  select auth.uid(), 'Bought ' || n, 'pokemon', 'NM', 10 from generate_series(1, 5) n;
select 'P19 five bought listings go through: ' || (count(*) = 5)::text
  from public.listings where seller_id = auth.uid() and title like 'Bought %';
select 'P20 the pack is spent: ' || (public.listing_credits_remaining() = 0)::text;

insert into public.listings (seller_id, title, game, condition, price)
  values (auth.uid(), 'One too many', 'pokemon', 'NM', 10);
select 'P21 (expect error above: out of credits)';
select 'P22 the wall is back: ' || (public.can_create_listing() = false)::text;

-- Two packs: the oldest one drains first.
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b4';
select public.admin_grant_credits('00000000-0000-0000-0000-0000000000b1', 2, 'first pack');
select public.admin_grant_credits('00000000-0000-0000-0000-0000000000b1', 4, 'second pack');
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b1';
insert into public.listings (seller_id, title, game, condition, price)
  values (auth.uid(), 'Drain the old pack', 'pokemon', 'NM', 10);
reset role;
select 'P23 the oldest pack is spent first: '
  || ((select used from public.listing_credit_packs
        where user_id = '00000000-0000-0000-0000-0000000000b1' and note = 'first pack') = 1
      and (select used from public.listing_credit_packs
        where user_id = '00000000-0000-0000-0000-0000000000b1' and note = 'second pack') = 0)::text;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b1';
select 'P24 credits across packs add up: ' || (public.listing_credits_remaining() = 5)::text;

-- ---------------------------------------------------------------------------
-- Subscriptions: unlimited listings
-- ---------------------------------------------------------------------------
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b3';
insert into public.listings (seller_id, title, game, condition, price)
  select auth.uid(), 'Sub free ' || n, 'pokemon', 'NM', 10 from generate_series(1, 3) n;
select 'P25 a free seller hits the wall before subscribing: '
  || (public.can_create_listing() = false)::text;
select public.request_purchase('monthly', 'Whish');
select public.request_purchase('monthly', 'again');
select 'P26 (expect error above: one subscription request at a time)';

set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b4';
select public.admin_review_purchase('subscription', id, true, '')
  from public.subscriptions
  where user_id = '00000000-0000-0000-0000-0000000000b3' and status = 'pending';

set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b3';
select 'P27 the subscription is live: '
  || (public.has_active_subscription()
      and (public.my_entitlements()->>'tier') = 'monthly')::text;
insert into public.listings (seller_id, title, game, condition, price)
  select auth.uid(), 'Sub paid ' || n, 'pokemon', 'NM', 10 from generate_series(1, 12) n;
select 'P28 a subscriber lists without limit: ' || (count(*) = 12)::text
  from public.listings where seller_id = auth.uid() and title like 'Sub paid %';
select 'P29 no credits are consumed by a subscriber: '
  || (public.listing_credits_remaining() = 0)::text;

-- Admins are never walled.
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b4';
insert into public.listings (seller_id, title, game, condition, price)
  select auth.uid(), 'Admin ' || n, 'pokemon', 'NM', 10 from generate_series(1, 5) n;
select 'P30 admins list without limit: ' || (public.can_create_listing())::text;

-- ---------------------------------------------------------------------------
-- The Pre-Grade gate
-- ---------------------------------------------------------------------------
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b1';
select 'P31 credits alone do not unlock Pre-Grade: '
  || (public.can_use_pregrade() = false)::text;
insert into public.pregrade_reports
  (user_id, standards_version, era, centering_method, front_lr, front_tb,
   base_grade, confidence, recommendation, findings)
  values (auth.uid(), 'v1', 'modern', 'manual', 55, 52, 9, 'high', 'submit', '{}'::jsonb);
select 'P32 (expect error above: Pre-Grade is for subscribers)';
reset role;
select 'P33 no report was written for the free user: ' || (count(*) = 0)::text
  from public.pregrade_reports where user_id = '00000000-0000-0000-0000-0000000000b1';

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b3';
select 'P34 subscribers may use Pre-Grade: ' || (public.can_use_pregrade())::text;
insert into public.pregrade_reports
  (user_id, standards_version, era, centering_method, front_lr, front_tb,
   base_grade, confidence, recommendation, findings)
  values (auth.uid(), 'v1', 'modern', 'manual', 55, 52, 9, 'high', 'submit', '{}'::jsonb);
select 'P35 the subscriber report lands: ' || (count(*) = 1)::text
  from public.pregrade_reports where user_id = auth.uid();

set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b4';
select 'P36 admins may use Pre-Grade: ' || (public.can_use_pregrade())::text;

-- ---------------------------------------------------------------------------
-- Lapsing
-- ---------------------------------------------------------------------------
select public.admin_activate_subscription('00000000-0000-0000-0000-0000000000b5', 'monthly', '');
reset role;
update public.subscriptions set period_end = now() - interval '1 day'
  where user_id = '00000000-0000-0000-0000-0000000000b5';
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b5';
select 'P37 a lapsed period grants nothing, sweep or no sweep: '
  || (public.has_active_subscription() = false
      and public.can_use_pregrade() = false)::text;
reset role;
select 'P38 the sweep marks it expired: ' || (public.expire_subscriptions() >= 1)::text;
select 'P39 the row now reads expired: ' || (status = 'expired')::text
  from public.subscriptions where user_id = '00000000-0000-0000-0000-0000000000b5';

-- Re-subscribing supersedes rather than colliding with the unique index.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b4';
select public.admin_activate_subscription('00000000-0000-0000-0000-0000000000b3', 'yearly', 'upgrade');
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b3';
select 'P40 upgrading leaves exactly one active subscription: '
  || (count(*) = 1)::text
  from public.subscriptions where user_id = auth.uid() and status = 'active';
select 'P41 the new tier is live: ' || ((public.my_entitlements()->>'tier') = 'yearly')::text;

-- Rejection closes a request without granting anything.
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b2';
select public.request_purchase('credits_15', 'bad transfer');
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b4';
select public.admin_review_purchase('credits', id, false, 'no payment found')
  from public.listing_credit_packs
  where user_id = '00000000-0000-0000-0000-0000000000b2' and status = 'pending';
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b2';
select 'P42 a rejected request grants nothing: '
  || (public.listing_credits_remaining() = 0)::text;
select 'P43 and it leaves the pending queue: '
  || ((public.my_entitlements()->>'pending_requests') = '0')::text;
reset role;
