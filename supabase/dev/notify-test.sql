-- Notifications (0024). Every trigger fires for the right person and
-- never for the actor; only the recipient can read or mark their rows.
-- Run after all migrations on a fresh database; ids are distinct from
-- the other suites.
\set ON_ERROR_STOP off
\set QUIET on
\pset tuples_only on

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'seller@ntf.dev'),
  ('00000000-0000-0000-0000-0000000000c2', 'buyer@ntf.dev'),
  ('00000000-0000-0000-0000-0000000000c3', 'bidder@ntf.dev'),
  ('00000000-0000-0000-0000-0000000000c4', 'watcher@ntf.dev');
insert into public.listing_credit_packs (user_id, credits, status)
  select id, 1000, 'active' from auth.users where email like '%@ntf.dev';
update public.profiles set username = 'ntf_seller' where id = '00000000-0000-0000-0000-0000000000c1';
update public.profiles set username = 'ntf_buyer' where id = '00000000-0000-0000-0000-0000000000c2';

-- A fixed listing and a conversation.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
insert into public.listings (id, seller_id, title, game, condition, price)
  values ('40000000-0000-0000-0000-000000000001', auth.uid(), 'Notify Card', 'pokemon', 'NM', 100);
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c2';
select (public.open_conversation('40000000-0000-0000-0000-000000000001')).id as conv \gset
insert into public.messages (conversation_id, sender_id, kind, body)
  values (:'conv', auth.uid(), 'user', 'Still available?');
select 'N01 the buyer hears nothing about their own message: ' || (count(*) = 0)::text
  from public.notifications;

set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select 'N02 the seller is told, with the card named: ' || (count(*) = 1)::text
  from public.notifications where kind = 'message' and title like '@ntf_buyer%Notify Card%';
select 'N03 and the row points at the thread: ' || (href = '/chat/' || :'conv')::text
  from public.notifications where kind = 'message';

-- A second message refreshes the live row instead of stacking.
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c2';
insert into public.messages (conversation_id, sender_id, kind, body)
  values (:'conv', auth.uid(), 'user', 'Would you take 90?');
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select 'N04 two messages, one unread row: ' || (count(*) = 1)::text
  from public.notifications where kind = 'message' and read_at is null;
select 'N05 which carries the latest body: ' || (body = 'Would you take 90?')::text
  from public.notifications where kind = 'message';

-- Mark read; the next message makes a fresh row.
select 'N06 mark read reports one row: ' || (public.mark_notifications_read() = 1)::text;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c2';
insert into public.messages (conversation_id, sender_id, kind, body)
  values (:'conv', auth.uid(), 'user', 'Hello again');
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select 'N07 after reading, a new message is a new row: ' || (count(*) = 2)::text
  from public.notifications where kind = 'message';

-- Offers: proposed to the seller, the answer back to the buyer.
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c2';
insert into public.messages (id, conversation_id, sender_id, kind, body, amount, offer_status)
  values ('50000000-0000-0000-0000-000000000001', :'conv', auth.uid(), 'offer', 'Offer', 90, 'proposed');
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select 'N08 the seller hears about the offer: ' || (count(*) = 1)::text
  from public.notifications where kind = 'offer' and title like '@ntf_buyer offered 90%';
update public.messages set offer_status = 'accepted' where id = '50000000-0000-0000-0000-000000000001';
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c2';
select 'N09 the buyer hears it was accepted: ' || (count(*) = 1)::text
  from public.notifications where kind = 'offer' and title like 'Your offer of 90%accepted';

-- Nobody reads anyone else's inbox, and nobody can forge a row.
select 'N10 the buyer sees only their own rows: ' || bool_and(user_id = auth.uid())::text
  from public.notifications;
insert into public.notifications (user_id, kind, title, href)
  values ('00000000-0000-0000-0000-0000000000c1', 'message', 'forged', '/chat/x');
select 'N11 (expect error above: notifications cannot be inserted by clients)';
update public.notifications set read_at = now() where user_id <> auth.uid();
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select 'N12 another user could not mark the seller''s rows: ' || (count(*) >= 1)::text
  from public.notifications where read_at is null;

-- Reviews.
reset role;
update public.listings set status = 'sold' where id = '40000000-0000-0000-0000-000000000001';
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c2';
insert into public.reviews (conversation_id, listing_id, reviewer_id, reviewee_id, rating, body)
  values (:'conv', '40000000-0000-0000-0000-000000000001', auth.uid(),
          '00000000-0000-0000-0000-0000000000c1', 5, 'Smooth deal.');
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select 'N13 the seller hears about the review: ' || (count(*) = 1)::text
  from public.notifications where kind = 'review' and title like '%5-star review';

-- The watchlist: a sale and a price drop reach watchers, not the seller.
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
insert into public.listings (id, seller_id, title, game, condition, price)
  values ('40000000-0000-0000-0000-000000000002', auth.uid(), 'Watched Card', 'pokemon', 'NM', 200);
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c4';
insert into public.favorites (user_id, listing_id)
  values (auth.uid(), '40000000-0000-0000-0000-000000000002');
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
update public.listings set price = 150 where id = '40000000-0000-0000-0000-000000000002';
update public.listings set status = 'sold' where id = '40000000-0000-0000-0000-000000000002';
select 'N14 the seller is not told about their own changes: ' || (count(*) = 0)::text
  from public.notifications where kind = 'watch';
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c4';
select 'N15 the watcher hears about the price drop and the sale: '
  || (count(*) filter (where title like 'Price drop%') = 1
      and count(*) filter (where title like 'Sold%') = 1)::text
  from public.notifications where kind = 'watch';

-- Auctions: a bid tells the seller, a higher bid tells the one it beat,
-- the close tells the winner and the seller.
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select public.create_auction_listing(
  '{"title":"Notify Auction","game":"pokemon","condition":"NM"}'::jsonb, 10, null, 24) as alisting \gset
select id as auc from public.auctions where listing_id = :'alisting' \gset
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c2';
select public.place_bid(:'auc', 10);
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c3';
select public.place_bid(:'auc', 20);
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select 'N16 the seller has one live bid row carrying the latest bid: '
  || (count(*) = 1 and bool_and(body like '%20 USD'))::text
  from public.notifications where kind = 'bid' and read_at is null;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c2';
select 'N17 the first bidder was told they were outbid: ' || (count(*) = 1)::text
  from public.notifications where kind = 'outbid' and body like '%20 USD';
reset role;
update public.auctions set ends_at = now() - interval '1 minute' where id = :'auc';
select public.close_due_auctions();
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c3';
select 'N18 the winner is told they won: ' || (count(*) = 1)::text
  from public.notifications where kind = 'auction' and title like 'You won%';
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select 'N19 the seller is told who won: ' || (count(*) = 1)::text
  from public.notifications where kind = 'auction' and body like 'Won by%20 USD';
reset role;
