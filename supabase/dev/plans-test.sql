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

-- The quota ships switched OFF (0021). Flip it on for this suite so the
-- paywall rules are exercised; the last section turns it off again and
-- proves a free seller past the allowance still lists.
create or replace function public.listing_quota_enabled()
returns boolean language sql immutable as $$ select true $$;

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
select 'P04 three free listings go through: ' || ((public.my_entitlements()->>'listings_created')::int = 3)::text;
select 'P05 the fourth is not allowed: ' || ((public.my_entitlements()->>'can_create_listing')::boolean = false)::text;

insert into public.listings (seller_id, title, game, condition, price)
  values (auth.uid(), 'Over the line', 'pokemon', 'NM', 10);
select 'P06 (expect error above: listing limit reached)';
select 'P07 the blocked listing did not land: ' || ((public.my_entitlements()->>'listings_created')::int = 3)::text;

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
  || ((public.my_entitlements()->>'can_create_listing')::boolean = false)::text;

-- ---------------------------------------------------------------------------
-- Buying listings: request, approve, spend
-- ---------------------------------------------------------------------------
select 'P10 a request is recorded: '
  || (public.request_purchase('credits_5', 'Whish ref 12345') is not null)::text;
select 'P11 a pending request grants nothing yet: '
  || ((public.my_entitlements()->>'can_create_listing')::boolean = false and (public.my_entitlements()->>'credits_remaining')::int = 0)::text;
select 'P12 entitlements count the pending request: '
  || ((public.my_entitlements()->>'pending_requests') = '1')::text;

-- Users cannot write the tables directly — the functions are the only door.
insert into public.listing_credit_packs (user_id, credits, status)
  values (auth.uid(), 99, 'active');
select 'P13 (expect error above: no insert policy on credit packs)';
select 'P14 self-granted credits rejected: '
  || ((public.my_entitlements()->>'credits_remaining')::int = 0)::text;

update public.listing_credit_packs set status = 'active' where user_id = auth.uid();
select 'P15 users cannot activate their own request: '
  || ((public.my_entitlements()->>'credits_remaining')::int = 0)::text;

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
  || ((public.my_entitlements()->>'credits_remaining')::int = 5
      and (public.my_entitlements()->>'can_create_listing')::boolean)::text;

insert into public.listings (seller_id, title, game, condition, price)
  select auth.uid(), 'Bought ' || n, 'pokemon', 'NM', 10 from generate_series(1, 5) n;
select 'P19 five bought listings go through: ' || (count(*) = 5)::text
  from public.listings where seller_id = auth.uid() and title like 'Bought %';
select 'P20 the pack is spent: ' || ((public.my_entitlements()->>'credits_remaining')::int = 0)::text;

insert into public.listings (seller_id, title, game, condition, price)
  values (auth.uid(), 'One too many', 'pokemon', 'NM', 10);
select 'P21 (expect error above: out of credits)';
select 'P22 the wall is back: ' || ((public.my_entitlements()->>'can_create_listing')::boolean = false)::text;

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
select 'P24 credits across packs add up: ' || ((public.my_entitlements()->>'credits_remaining')::int = 5)::text;

-- ---------------------------------------------------------------------------
-- Subscriptions: unlimited listings
-- ---------------------------------------------------------------------------
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b3';
insert into public.listings (seller_id, title, game, condition, price)
  select auth.uid(), 'Sub free ' || n, 'pokemon', 'NM', 10 from generate_series(1, 3) n;
select 'P25 a free seller hits the wall before subscribing: '
  || ((public.my_entitlements()->>'can_create_listing')::boolean = false)::text;
select public.request_purchase('monthly', 'Whish');
select public.request_purchase('monthly', 'again');
select 'P26 (expect error above: one subscription request at a time)';

set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b4';
select public.admin_review_purchase('subscription', id, true, '')
  from public.subscriptions
  where user_id = '00000000-0000-0000-0000-0000000000b3' and status = 'pending';

set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b3';
select 'P27 the subscription is live: '
  || ((public.my_entitlements()->>'subscribed')::boolean
      and (public.my_entitlements()->>'tier') = 'monthly')::text;
insert into public.listings (seller_id, title, game, condition, price)
  select auth.uid(), 'Sub paid ' || n, 'pokemon', 'NM', 10 from generate_series(1, 12) n;
select 'P28 a subscriber lists without limit: ' || (count(*) = 12)::text
  from public.listings where seller_id = auth.uid() and title like 'Sub paid %';
select 'P29 no credits are consumed by a subscriber: '
  || ((public.my_entitlements()->>'credits_remaining')::int = 0)::text;

-- Admins are never walled.
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b4';
insert into public.listings (seller_id, title, game, condition, price)
  select auth.uid(), 'Admin ' || n, 'pokemon', 'NM', 10 from generate_series(1, 5) n;
select 'P30 admins list without limit: ' || ((public.my_entitlements()->>'can_create_listing')::boolean)::text;

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
  || ((public.my_entitlements()->>'subscribed')::boolean = false
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
  || ((public.my_entitlements()->>'credits_remaining')::int = 0)::text;
select 'P43 and it leaves the pending queue: '
  || ((public.my_entitlements()->>'pending_requests') = '0')::text;
reset role;

-- ---------------------------------------------------------------------------
-- 0020: the helpers are internal, calls are metered, notes are capped
-- ---------------------------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b1';
select public.has_active_subscription('00000000-0000-0000-0000-0000000000b3');
select 'P44 (expect error above: subscription status of others is not readable)';
select public.listing_credits_remaining('00000000-0000-0000-0000-0000000000b3');
select 'P45 (expect error above: credit balance of others is not readable)';
select public.expire_subscriptions();
select 'P46 (expect error above: the sweep is not a client call)';
select 'P47 my own standing still answers: '
  || ((public.my_entitlements()->>'listings_created')::int >= 3)::text;

-- A free account cannot even reserve a Pre-Grade call.
select public.consume_pregrade_call(10);
select 'P48 (expect error above: Pre-Grade is part of a subscription)';

-- A subscriber gets exactly the window, then -1, and every call counts
-- whether or not a report is ever saved.
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b3';
select 'P49 the first reserved call leaves two: ' || (public.consume_pregrade_call(3) = 2)::text;
select public.consume_pregrade_call(3);
select 'P50 the third reserved call leaves none: ' || (public.consume_pregrade_call(3) = 0)::text;
select 'P51 the fourth is refused without a row: ' || (public.consume_pregrade_call(3) = -1)::text;
select 'P52 exactly three calls were recorded: ' || (count(*) = 3)::text
  from public.pregrade_calls where user_id = auth.uid();

-- Notes have a ceiling.
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b2';
select public.request_purchase('credits_5', repeat('x', 501));
select 'P53 (expect error above: note too long)';
select 'P54 a reasonable note is fine: '
  || (public.request_purchase('credits_5', repeat('x', 500)) is not null)::text;
reset role;

-- ---------------------------------------------------------------------------
-- 0021: with the switch off there is no wall, and the tally still runs
-- ---------------------------------------------------------------------------
create or replace function public.listing_quota_enabled()
returns boolean language sql immutable as $$ select false $$;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b1';
select 'P55 switched off, the wall is gone for a used-up free seller: '
  || ((public.my_entitlements()->>'can_create_listing')::boolean
      and (public.my_entitlements()->>'quota_enabled') = 'false')::text;
insert into public.listings (seller_id, title, game, condition, price)
  select auth.uid(), 'Free period ' || n, 'pokemon', 'NM', 10 from generate_series(1, 4) n;
select 'P56 four more listings go through without credits: ' || (count(*) = 4)::text
  from public.listings where seller_id = auth.uid() and title like 'Free period %';
select 'P57 no credit was spent on them: '
  || ((public.my_entitlements()->>'credits_remaining')::int = 5)::text;
select 'P58 the tally kept counting for the day the switch flips back: '
  || ((public.my_entitlements()->>'listings_created')::int >= 13)::text;
select 'P59 Pre-Grade is untouched by the switch: '
  || (public.can_use_pregrade() = false)::text;
reset role;
