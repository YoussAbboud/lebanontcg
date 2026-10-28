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
-- Cooldown (0033: every listing that goes to review counts, however it got there)
reset role;
set app.listing_review = '1';
update public.listings set review_state = 'approved' where seller_id = '00000000-0000-0000-0000-0000000000c1';
set app.listing_review = '';
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select 'C01 no cooldown to start with: ' || (public.my_listing_cooldown() = 0)::text;

insert into public.listings (id, seller_id, title, game, condition, price)
  values ('c1000000-0000-0000-0000-000000000001', auth.uid(), 'Fan one', 'pokemon', 'NM', 10);
insert into public.listing_images (listing_id, storage_path)
  values ('c1000000-0000-0000-0000-000000000001', 'x/1.jpg');
select 'C02 one listing in review (check failed or never ran): no cooldown, its photos went in: '
  || (public.my_listing_cooldown() = 0
      and (select count(*) from public.listing_images where listing_id = 'c1000000-0000-0000-0000-000000000001') = 1)::text;

insert into public.listings (id, seller_id, title, game, condition, price)
  values ('c1000000-0000-0000-0000-000000000002', auth.uid(), 'Fan two', 'pokemon', 'NM', 10);
insert into public.listing_images (listing_id, storage_path)
  values ('c1000000-0000-0000-0000-000000000002', 'x/2.jpg');
select 'C03 the second listing''s own photos still go in: '
  || ((select count(*) from public.listing_images where listing_id = 'c1000000-0000-0000-0000-000000000002') = 1)::text;
select 'C04 two in review one after the other: ten minutes: '
  || (public.my_listing_cooldown() between 590 and 600)::text;
insert into public.listings (seller_id, title, game, condition, price)
  values (auth.uid(), 'Fan three', 'pokemon', 'NM', 10);
select '(expect error above: You can''t list at the moment. Try again in 10 minutes.)';
insert into public.listing_images (listing_id, storage_path)
  values ('c0000000-0000-0000-0000-000000000001', 'x/y.jpg');
select '(expect error above: no new photos on another listing either)';
select 'C05 the third never landed: ' || (count(*) = 0)::text
  from public.listings where title = 'Fan three';

-- Removing them doesn't help.
update public.listings set status = 'removed'
  where id in ('c1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002');
select 'C06 removing the listings keeps the cooldown: ' || (public.my_listing_cooldown() > 0)::text;

-- A moderator approving one takes it back.
reset role;
set app.listing_review = '1';
update public.listings set review_state = 'approved' where id = 'c1000000-0000-0000-0000-000000000002';
set app.listing_review = '';
set role authenticated;
select 'C07 an approved listing no longer counts: ' || (public.my_listing_cooldown() = 0)::text;

-- In review, approved, in review — within five minutes: still a cooldown.
reset role;
set app.listing_review = '1';
update public.listings set review_requested_at = now() - interval '4 minutes'
  where id = 'c1000000-0000-0000-0000-000000000001';
update public.listings set review_requested_at = now() - interval '3 minutes'
  where id = 'c1000000-0000-0000-0000-000000000002';
insert into public.listings (id, seller_id, title, game, condition, price, review_state, review_requested_at)
  values ('c1000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000c1', 'Fan four',
          'pokemon', 'NM', 10, 'pending', now() - interval '1 minute');
set app.listing_review = '';
set role authenticated;
select 'C08 two in review within five minutes, a good one between: cooldown: '
  || (public.my_listing_cooldown() between 530 and 541)::text;

-- ...but seven minutes apart with a good one between: none.
reset role;
set app.listing_review = '1';
update public.listings set review_requested_at = now() - interval '8 minutes'
  where id = 'c1000000-0000-0000-0000-000000000001';
update public.listings set review_requested_at = now() - interval '5 minutes'
  where id = 'c1000000-0000-0000-0000-000000000002';
set app.listing_review = '';
set role authenticated;
select 'C09 far apart with a good one between: none: ' || (public.my_listing_cooldown() = 0)::text;

-- Ten minutes after the second, it's over.
reset role;
set app.listing_review = '1';
update public.listings set review_state = 'pending', review_requested_at = now() - interval '12 minutes'
  where id = 'c1000000-0000-0000-0000-000000000002';
update public.listings set review_requested_at = now() - interval '11 minutes'
  where id = 'c1000000-0000-0000-0000-000000000003';
update public.listings set review_requested_at = now() - interval '13 minutes'
  where id = 'c1000000-0000-0000-0000-000000000001';
set app.listing_review = '';
set role authenticated;
select 'C10 ten minutes after the second it lifts: ' || (public.my_listing_cooldown() = 0)::text;
insert into public.listings (id, seller_id, title, game, condition, price)
  values ('c2000000-0000-0000-0000-000000000001', auth.uid(), 'Back again', 'pokemon', 'NM', 10);
select 'C11 ...and listing works: ' || (count(*) = 1)::text
  from public.listings where id = 'c2000000-0000-0000-0000-000000000001';
select 'C12 the wait reads naturally: ' || (
  public.format_wait(539) = '8 minutes 59 seconds' and public.format_wait(60) = '1 minute'
  and public.format_wait(61) = '1 minute 1 second' and public.format_wait(9) = '9 seconds')::text;
reset role;
