-- Suspension lock-out and the listing cooldown (0032). Run after all
-- migrations and the seed on a fresh database, WITHOUT
-- legacy-autoapprove.sql.
\set ON_ERROR_STOP off
\set QUIET on
\pset tuples_only on

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'seller@lock.dev'),
  ('00000000-0000-0000-0000-0000000000c2', 'buyer@lock.dev'),
  ('00000000-0000-0000-0000-0000000000c3', 'admin@lock.dev');
insert into public.listing_credit_packs (user_id, credits, status)
  select id, 1000, 'active' from auth.users where email like '%@lock.dev';
set app.admin_action = '1';
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-0000000000c3';
set app.admin_action = '0';

-- A public listing from the seller and a chat about it.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
insert into public.listings (id, seller_id, title, game, condition, price)
  values ('c0000000-0000-0000-0000-000000000001', auth.uid(), 'Pikachu', 'pokemon', 'NM', 20);
reset role;
set app.listing_review = '1';
update public.listings set review_state = 'approved' where id = 'c0000000-0000-0000-0000-000000000001';
set app.listing_review = '';
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c2';
select (public.open_conversation('c0000000-0000-0000-0000-000000000001')).id as conv \gset
insert into public.messages (conversation_id, sender_id, kind, body, amount, offer_status)
  values (:'conv', auth.uid(), 'offer', 'Cash?', 15, 'proposed');
reset role;
select id as offer from public.messages where conversation_id = :'conv' and kind = 'offer' \gset

-- Suspend the buyer.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c3';
select public.admin_set_suspended('00000000-0000-0000-0000-0000000000c2', true, 'Spam');

set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c2';
select 'S01 the member is told at once: ' || (count(*) = 1)::text
  from public.notifications where title = 'Your account is suspended';

insert into public.messages (conversation_id, sender_id, kind, body)
  values (:'conv', auth.uid(), 'user', 'still here');
select '(expect error above: no messages)';
insert into public.messages (conversation_id, sender_id, kind, body)
  values (:'conv', auth.uid(), 'phone', '+96170123456');
select '(expect error above: no phone numbers)';
insert into public.favorites (user_id, listing_id)
  values (auth.uid(), 'c0000000-0000-0000-0000-000000000001');
select '(expect error above: no likes)';
insert into public.reports (reporter_id, target_type, target_id, reason)
  values (auth.uid(), 'listing', 'c0000000-0000-0000-0000-000000000001', 'other');
select '(expect error above: no reports)';
insert into public.blocks (blocker_id, blocked_id)
  values (auth.uid(), '00000000-0000-0000-0000-0000000000c1');
select '(expect error above: no blocking)';
update public.profiles set bio = 'hi' where id = auth.uid();
select '(expect error above: no profile edits)';
select public.request_purchase('monthly', '');
select '(expect error above: no purchases)';

set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select 'S02 the seller can still answer the suspended buyer''s offer: '
  || (count(*) = 1)::text from public.messages where id = :'offer';
update public.messages set offer_status = 'declined' where id = :'offer';
select 'S03 ...and did: ' || (offer_status = 'declined')::text from public.messages where id = :'offer';

set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c2';
select 'S04 the suspended member can still read their chat: ' || (count(*) >= 1)::text
  from public.messages where conversation_id = :'conv';
select 'S05 ...mark notifications read: ' || (public.mark_notifications_read() >= 0)::text;
select 'S06 ...and open a support ticket to appeal: '
  || (public.open_support_ticket('Appeal', 'appeal', 'Please review my suspension') is not null)::text;
select 'S07 nothing they tried got through: ' || (
  (select count(*) from public.messages where sender_id = auth.uid() and kind <> 'offer') = 0
  and (select count(*) from public.favorites where user_id = auth.uid()) = 0
)::text;

-- Lifting it works and says so.
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c3';
select public.admin_set_suspended('00000000-0000-0000-0000-0000000000c2', false, '');
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c2';
select 'S08 lifting is announced: ' || (count(*) = 1)::text
  from public.notifications where title = 'Your suspension was lifted';
insert into public.favorites (user_id, listing_id)
  values (auth.uid(), 'c0000000-0000-0000-0000-000000000001');
select 'S09 and actions work again: ' || (count(*) = 1)::text
  from public.favorites where user_id = auth.uid();

-- A suspended seller can't touch their listings either.
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c3';
select public.admin_set_suspended('00000000-0000-0000-0000-0000000000c1', true, 'Junk listings');
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
update public.listings set price = 1 where id = 'c0000000-0000-0000-0000-000000000001';
select '(expect error above: no listing edits)';
delete from public.listings where id = 'c0000000-0000-0000-0000-000000000001';
select '(expect error above: no listing removal)';
select 'S10 the listing is untouched: ' || (price = 20)::text
  from public.listings where id = 'c0000000-0000-0000-0000-000000000001';
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c3';
select public.admin_set_suspended('00000000-0000-0000-0000-0000000000c1', false, '');
select 'S11 a third warning suspends with one notification, not two: ' || (
  public.admin_warn_user('00000000-0000-0000-0000-0000000000c2', 'One') = 1
  and public.admin_warn_user('00000000-0000-0000-0000-0000000000c2', 'Two') = 2
  and public.admin_warn_user('00000000-0000-0000-0000-0000000000c2', 'Three') = 3
)::text;
reset role;
select 'S12 ...' || ((select count(*) from public.notifications
  where user_id = '00000000-0000-0000-0000-0000000000c2' and title = 'Your account is suspended') = 2)::text
  || ' (one per suspension)';

-- ---------------------------------------------------------------------------
-- Cooldown
reset role;
create temp table t_flag (n int, listing uuid);
insert into public.listings (id, seller_id, title, game, condition, price, review_state)
  select ('c1000000-0000-0000-0000-00000000000' || n)::uuid, '00000000-0000-0000-0000-0000000000c1',
         'Card ' || n, 'pokemon', 'NM', 10, 'pending'
  from generate_series(1, 6) n;

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select 'C01 no cooldown to start with: ' || (public.my_listing_cooldown() = 0)::text;

reset role;
-- one flag: no cooldown
insert into public.listing_screens (listing_id, seller_id, verdict, finished_at)
  values ('c1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', 'not_card', now() - interval '20 minutes'),
         ('c1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000c1', 'card', now() - interval '19 minutes'),
         ('c1000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000c1', 'not_card', now() - interval '2 minutes');
set role authenticated;
select 'C02 one recent flag, after a good listing: no cooldown: ' || (public.my_listing_cooldown() = 0)::text;

reset role;
-- a check that failed doesn't count either
insert into public.listing_screens (listing_id, seller_id, verdict, finished_at)
  values ('c1000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-0000000000c1', 'error', now() - interval '90 seconds');
set role authenticated;
select 'C03 a failed check is not a flag: ' || (public.my_listing_cooldown() = 0)::text;

reset role;
insert into public.listing_screens (listing_id, seller_id, verdict, finished_at)
  values ('c1000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-0000000000c1', 'unsure', now() - interval '1 minute');
set role authenticated;
select 'C04 two flags in a row: about nine minutes left: '
  || (public.my_listing_cooldown() between 530 and 541)::text;
insert into public.listings (seller_id, title, game, condition, price)
  values (auth.uid(), 'Another', 'pokemon', 'NM', 10);
select '(expect error above: You can''t list at the moment. Try again in 9 minutes.)';
insert into public.listing_images (listing_id, storage_path)
  values ('c0000000-0000-0000-0000-000000000001', 'x/y.jpg');
select '(expect error above: no new photos either)';

-- A moderator approving one of the flagged listings lifts it.
reset role;
set app.listing_review = '1';
update public.listings set review_state = 'approved', reviewed_by = '00000000-0000-0000-0000-0000000000c3'
  where id = 'c1000000-0000-0000-0000-000000000005';
set app.listing_review = '';
set role authenticated;
select 'C05 a moderator''s approval takes a flag back: ' || (public.my_listing_cooldown() = 0)::text;

-- Two flags five minutes apart with a good one between still count.
reset role;
delete from public.listing_screens where seller_id = '00000000-0000-0000-0000-0000000000c1';
insert into public.listing_screens (listing_id, seller_id, verdict, finished_at)
  values ('c1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', 'not_card', now() - interval '6 minutes'),
         ('c1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000c1', 'card', now() - interval '4 minutes'),
         ('c1000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000c1', 'not_card', now() - interval '3 minutes');
set role authenticated;
select 'C06 two flags within five minutes: cooldown: '
  || (public.my_listing_cooldown() between 410 and 421)::text;

-- ...but the same listing flagged twice is one listing.
reset role;
delete from public.listing_screens where seller_id = '00000000-0000-0000-0000-0000000000c1';
insert into public.listing_screens (listing_id, seller_id, verdict, finished_at)
  values ('c1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', 'not_card', now() - interval '3 minutes'),
         ('c1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', 'not_card', now() - interval '2 minutes');
set role authenticated;
select 'C07 one listing checked twice is not two listings: ' || (public.my_listing_cooldown() = 0)::text;

-- Flags 7 minutes apart with a good listing between: no cooldown.
reset role;
delete from public.listing_screens where seller_id = '00000000-0000-0000-0000-0000000000c1';
insert into public.listing_screens (listing_id, seller_id, verdict, finished_at)
  values ('c1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', 'not_card', now() - interval '8 minutes'),
         ('c1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000c1', 'card', now() - interval '5 minutes'),
         ('c1000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000c1', 'not_card', now() - interval '1 minutes');
set role authenticated;
select 'C08 flags far apart with a good listing between: none: ' || (public.my_listing_cooldown() = 0)::text;

-- Once ten minutes have passed, it's over.
reset role;
delete from public.listing_screens where seller_id = '00000000-0000-0000-0000-0000000000c1';
insert into public.listing_screens (listing_id, seller_id, verdict, finished_at)
  values ('c1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', 'not_card', now() - interval '12 minutes'),
         ('c1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000c1', 'not_card', now() - interval '11 minutes');
set role authenticated;
select 'C09 ten minutes after the second flag it lifts: ' || (public.my_listing_cooldown() = 0)::text;
insert into public.listings (id, seller_id, title, game, condition, price)
  values ('c2000000-0000-0000-0000-000000000001', auth.uid(), 'Back again', 'pokemon', 'NM', 10);
select 'C10 ...and listing works: ' || (count(*) = 1)::text
  from public.listings where id = 'c2000000-0000-0000-0000-000000000001';
select 'C11 the wait reads naturally: ' || (
  public.format_wait(539) = '8 minutes 59 seconds' and public.format_wait(60) = '1 minute'
  and public.format_wait(61) = '1 minute 1 second' and public.format_wait(9) = '9 seconds')::text;
reset role;
