-- RLS + trigger behavior smoke test. Uses two fake users.
\set ON_ERROR_STOP off
\set QUIET on
\pset tuples_only on

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'maya@test.dev'),
  ('00000000-0000-0000-0000-000000000002', 'karim@test.dev');

select 'T01 profiles auto-created: ' || (count(*) = 2)::text from public.profiles;

-- claim usernames
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
update public.profiles set username = 'maya' where id = auth.uid();
select 'T02 username claimed: ' || (username = 'maya')::text
  from public.profiles where id = auth.uid();

-- immutability
update public.profiles set username = 'maya2' where id = auth.uid();
select 'T03 (expect error above: username cannot be changed)';

-- cannot edit someone else's profile (0 rows)
update public.profiles set display_name = 'hax'
  where id = '00000000-0000-0000-0000-000000000002';
select 'T04 other profile untouched: ' || (display_name <> 'hax')::text
  from public.profiles where id = '00000000-0000-0000-0000-000000000002';

-- rating fields are locked
update public.profiles set rating_avg = 5, rating_count = 99 where id = auth.uid();
select 'T05 (expect error above: rating fields are system-maintained)';

-- listing lifecycle
insert into public.listings (id, seller_id, title, game, condition, price)
values ('10000000-0000-0000-0000-000000000001', auth.uid(),
        'RLS Test Charizard', 'pokemon', 'LP', 100);
select 'T06 listing inserted: ' || (count(*) = 1)::text
  from public.listings where title = 'RLS Test Charizard';

-- other user cannot mutate it
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
update public.listings set price = 1 where id = '10000000-0000-0000-0000-000000000001';
select 'T07 foreign update blocked: ' || (price = 100)::text
  from public.listings where id = '10000000-0000-0000-0000-000000000001';

-- buyer opens a conversation via RPC
select 'T08 conversation opened: ' ||
  (open_conversation('10000000-0000-0000-0000-000000000001')).id is not null;

-- seller cannot open one on their own listing
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select open_conversation('10000000-0000-0000-0000-000000000001');
select 'T09 (expect error above: cannot message yourself)';

-- messaging
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
insert into public.messages (conversation_id, sender_id, body)
select c.id, auth.uid(), 'is this available?' from public.conversations c limit 1;
select 'T10 message sent: ' || (count(*) = 1)::text
  from public.messages where kind = 'user';

-- forging sender is blocked
insert into public.messages (conversation_id, sender_id, body)
select c.id, '00000000-0000-0000-0000-000000000001', 'forged' from public.conversations c limit 1;
select 'T11 (expect error above: RLS violation for forged sender)';

-- recipient can mark read but not edit the body
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
update public.messages set read_at = now() where sender_id <> auth.uid() and read_at is null;
select 'T12 read receipt set: ' || (count(*) = 1)::text
  from public.messages where read_at is not null;
update public.messages set body = 'tampered' where true;
select 'T13 (expect error above: no update grant on body)';

-- outsider sees nothing
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000099';
select 'T14 outsider sees no messages: ' || (count(*) = 0)::text from public.messages;
select 'T15 outsider sees no conversations: ' || (count(*) = 0)::text from public.conversations;

-- status change inserts a system message (as seller)
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
update public.listings set status = 'reserved',
  reserved_for_conversation_id = (select id from public.conversations limit 1)
  where id = '10000000-0000-0000-0000-000000000001';
select 'T16 system msg on reserve: ' || (count(*) = 1)::text
  from public.messages where kind = 'system'
  and body = 'Seller reserved this listing for this conversation.';

-- review before sold is rejected
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
insert into public.reviews (conversation_id, listing_id, reviewer_id, reviewee_id, rating, body)
select c.id, c.listing_id, auth.uid(), c.seller_id, 5, 'great'
  from public.conversations c limit 1;
select 'T17 (expect error above: review before sold rejected)';

-- sell, then review works and rolls up the rating
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
update public.listings set status = 'sold'
  where id = '10000000-0000-0000-0000-000000000001';
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
insert into public.reviews (conversation_id, listing_id, reviewer_id, reviewee_id, rating, body)
select c.id, c.listing_id, auth.uid(), c.seller_id, 4, 'good deal'
  from public.conversations c limit 1;
select 'T18 review accepted: ' || (count(*) = 1)::text from public.reviews;
select 'T19 rating rolled up: ' || (rating_avg = 4.00 and rating_count = 1)::text
  from public.profiles where id = '00000000-0000-0000-0000-000000000001';

-- duplicate review rejected
insert into public.reviews (conversation_id, listing_id, reviewer_id, reviewee_id, rating, body)
select c.id, c.listing_id, auth.uid(), c.seller_id, 1, 'dupe'
  from public.conversations c limit 1;
select 'T20 (expect error above: duplicate review rejected)';

-- sold is terminal
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
update public.listings set status = 'active'
  where id = '10000000-0000-0000-0000-000000000001';
select 'T21 (expect error above: sold is terminal)';

-- blocks stop messaging (either direction)
insert into public.blocks (blocker_id, blocked_id)
values (auth.uid(), '00000000-0000-0000-0000-000000000002');
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
insert into public.messages (conversation_id, sender_id, body)
select c.id, auth.uid(), 'after block' from public.conversations c limit 1;
select 'T22 (expect error above: blocked send rejected)';
select 'T23 blocked cannot see who blocked: ' || (count(*) = 0)::text from public.blocks;

-- second listing: blocked buyer cannot open a conversation
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
insert into public.listings (id, seller_id, title, game, condition, price)
values ('10000000-0000-0000-0000-000000000002', auth.uid(),
        'RLS Test Blastoise', 'pokemon', 'NM', 50);
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
select open_conversation('10000000-0000-0000-0000-000000000002');
select 'T24 (expect error above: blocked buyer rejected)';

-- anon browsing: sees active listings, not removed ones
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
update public.listings set status = 'removed'
  where id = '10000000-0000-0000-0000-000000000002';
reset request.jwt.claim.sub;
set role anon;
select 'T25 anon sees sold listing: ' || (count(*) = 1)::text
  from public.listings where id = '10000000-0000-0000-0000-000000000001';
select 'T26 anon cannot see removed: ' || (count(*) = 0)::text
  from public.listings where id = '10000000-0000-0000-0000-000000000002';
select 'T27 anon cannot insert reports: begin';
reset role;

-- ---- 0008: offers + likes -------------------------------------------------
set role authenticated;
-- undo the block from the T22 section so the two can talk again
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
delete from public.blocks where blocker_id = auth.uid();
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
insert into public.messages (conversation_id, sender_id, kind, body, amount, offer_status)
select c.id, auth.uid(), 'offer', 'cash saturday', 275, 'proposed' from public.conversations c limit 1;
select 'T28 offer inserted: ' || (count(*) = 1)::text
  from public.messages where kind = 'offer';

-- sender cannot settle own offer (update policy: sender is excluded)
update public.messages set offer_status = 'accepted' where kind = 'offer';
select 'T29 sender cannot settle own offer: '
  || (count(*) = 1)::text from public.messages where kind = 'offer' and offer_status = 'proposed';

-- recipient accepts -> status flips + system message appears
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
update public.messages set offer_status = 'accepted' where kind = 'offer';
select 'T30 recipient accepted: ' || (count(*) = 1)::text
  from public.messages where kind = 'offer' and offer_status = 'accepted';
select 'T31 acceptance system msg: ' || (count(*) = 1)::text
  from public.messages where kind = 'system' and body like 'Offer accepted.%';

-- settled offers are immutable
update public.messages set offer_status = 'declined' where kind = 'offer';
select 'T32 (expect error above: settled offer immutable)';

-- like counts view is readable and aggregates anonymously
insert into public.favorites (user_id, listing_id)
values (auth.uid(), '10000000-0000-0000-0000-000000000001');
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000099';
select 'T33 like count visible to others: ' || (likes = 1)::text
  from public.listing_likes where listing_id = '10000000-0000-0000-0000-000000000001';
select 'T34 raw favorites still hidden: ' || (count(*) = 0)::text from public.favorites;
reset role;

-- ---- 0009: profile self-heal ----------------------------------------------
-- (setup as superuser: an auth user whose profile row is missing)
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000042', 'late@test.dev')
  on conflict do nothing;
delete from public.profiles where id = '00000000-0000-0000-0000-000000000042';
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000042';
insert into public.profiles (id, display_name) values (auth.uid(), 'Late Signup');
select 'T35 self-heal insert own profile: ' || (count(*) = 1)::text
  from public.profiles where id = auth.uid();
insert into public.profiles (id, display_name) values ('00000000-0000-0000-0000-000000000043', 'Forged');
select 'T36 (expect error above: cannot insert someone else''s profile)';
reset role;
