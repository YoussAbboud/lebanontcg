-- Auction schema + place_bid rule test. Every rule in the spec fails
-- when violated via direct DB call. Run after all migrations on a fresh
-- database (rls-test.sql may share it — ids here are distinct).
\set ON_ERROR_STOP off
\set QUIET on
\pset tuples_only on

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'seller@auc.dev'),
  ('00000000-0000-0000-0000-0000000000a2', 'bidder1@auc.dev'),
  ('00000000-0000-0000-0000-0000000000a3', 'bidder2@auc.dev'),
  ('00000000-0000-0000-0000-0000000000a4', 'blocked@auc.dev');

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';

-- A fixed listing with an auction row is rejected at the DB.
begin;
insert into public.listings (id, seller_id, title, game, condition, price, sale_type)
values ('20000000-0000-0000-0000-000000000001', auth.uid(),
        'Fixed Card', 'pokemon', 'NM', 50, 'fixed');
insert into public.auctions (listing_id, seller_id, starting_price, currency, ends_at)
values ('20000000-0000-0000-0000-000000000001', auth.uid(), 10, 'USD', now() + interval '1 day');
commit;
select 'A01 (expect error above: fixed listing cannot have an auction)';
select 'A02 no auction row leaked: ' || (count(*) = 0)::text
  from public.auctions where listing_id = '20000000-0000-0000-0000-000000000001';

-- An auction listing without an auctions row is rejected at commit.
begin;
insert into public.listings (id, seller_id, title, game, condition, price, sale_type)
values ('20000000-0000-0000-0000-000000000002', auth.uid(),
        'Orphan Auction', 'pokemon', 'NM', 10, 'auction');
commit;
select 'A03 (expect error above: auction listing needs its auction row)';
select 'A04 orphan auction listing rejected: ' || (count(*) = 0)::text
  from public.listings where id = '20000000-0000-0000-0000-000000000002';

-- The real thing: listing + auction in one transaction.
begin;
insert into public.listings (id, seller_id, title, game, condition, price, sale_type)
values ('20000000-0000-0000-0000-000000000003', auth.uid(),
        'Auction Charizard', 'pokemon', 'NM', 10, 'auction');
insert into public.auctions (id, listing_id, seller_id, starting_price, currency, ends_at)
values ('30000000-0000-0000-0000-000000000001',
        '20000000-0000-0000-0000-000000000003', auth.uid(), 10, 'USD',
        now() + interval '1 day');
commit;
select 'A05 auction listing created in one txn: ' || (count(*) = 1)::text
  from public.auctions where id = '30000000-0000-0000-0000-000000000001';

-- Auctions are single-card.
begin;
insert into public.listings (id, seller_id, title, game, condition, price, quantity, sale_type)
values ('20000000-0000-0000-0000-000000000009', auth.uid(),
        'Multi Auction', 'pokemon', 'NM', 10, 3, 'auction');
commit;
select 'A06 (expect error above: auction quantity must be 1)';

-- sale_type is immutable.
update public.listings set sale_type = 'fixed'
  where id = '20000000-0000-0000-0000-000000000003';
select 'A07 (expect error above: sale_type immutable)';

-- An auction listing's price cannot be edited directly, even by its seller.
update public.listings set price = 999
  where id = '20000000-0000-0000-0000-000000000003';
select 'A08 (expect error above: auction price is set by bidding)';

-- Sellers cannot bid on their own auction.
select public.place_bid('30000000-0000-0000-0000-000000000001', 10);
select 'A09 (expect error above: seller bidding own auction)';

-- A bid one unit under the starting price fails; at it, succeeds.
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a2';
select public.place_bid('30000000-0000-0000-0000-000000000001', 9);
select 'A10 (expect error above: below starting price)';
select 'A11 first bid at starting price accepted: '
  || ((public.place_bid('30000000-0000-0000-0000-000000000001', 10)->>'amount')::numeric = 10)::text;

-- Minimum increment: 5% rounded up, floor 1 → current 10 needs 11.
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a3';
select public.place_bid('30000000-0000-0000-0000-000000000001', 10.5);
select 'A12 (expect error above: under the minimum increment)';
select 'A13 bid at the exact minimum accepted: '
  || ((public.place_bid('30000000-0000-0000-0000-000000000001', 11)->>'amount')::numeric = 11)::text;

-- The listing price mirrors the top bid.
select 'A14 listing price mirrors top bid: ' || (price = 11)::text
  from public.listings where id = '20000000-0000-0000-0000-000000000003';

-- Blocked users cannot bid.
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
insert into public.blocks (blocker_id, blocked_id)
values (auth.uid(), '00000000-0000-0000-0000-0000000000a4');
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a4';
select public.place_bid('30000000-0000-0000-0000-000000000001', 20);
select 'A15 (expect error above: blocked user bidding)';

-- Bids are append-only.
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a2';
update public.bids set amount = 1 where auction_id = '30000000-0000-0000-0000-000000000001';
select 'A16 (expect error above: bids immutable)';

-- Anti-snipe: with under a minute left, a bid pushes ends_at out 60s.
reset role;
update public.auctions set ends_at = now() + interval '30 seconds'
  where id = '30000000-0000-0000-0000-000000000001';
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a2';
select 'A17 final-minute bid extends the clock: '
  || (((public.place_bid('30000000-0000-0000-0000-000000000001', 12))->>'extended')::boolean)::text;
select 'A18 ends_at pushed past a minute out: ' || (ends_at > now() + interval '60 seconds')::text
  from public.auctions where id = '30000000-0000-0000-0000-000000000001';
select 'A19 extension recorded on the bid: ' || (count(*) = 1)::text
  from public.bids
  where auction_id = '30000000-0000-0000-0000-000000000001' and extended;

-- Only the seller can end early / cancel.
select public.end_auction_early('30000000-0000-0000-0000-000000000001');
select 'A20 (expect error above: only seller ends early)';

-- Seller ends early: highest bid wins, conversation + system message,
-- listing reserved.
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
select public.end_auction_early('30000000-0000-0000-0000-000000000001');
select 'A21 closed with the top bidder as winner: '
  || (status = 'closed' and winner_id = '00000000-0000-0000-0000-0000000000a2'
      and winning_bid = 12)::text
  from public.auctions where id = '30000000-0000-0000-0000-000000000001';
select 'A22 winner conversation exists: ' || (count(*) = 1)::text
  from public.conversations
  where listing_id = '20000000-0000-0000-0000-000000000003'
    and buyer_id = '00000000-0000-0000-0000-0000000000a2';
select 'A23 handoff system message posted: ' || (count(*) = 1)::text
  from public.messages m
  join public.conversations c on c.id = m.conversation_id
  where c.listing_id = '20000000-0000-0000-0000-000000000003'
    and m.kind = 'system' and m.body like '%won this auction at USD 12.00%';
select 'A24 listing reserved for the winner: '
  || (status = 'reserved' and reserved_for_conversation_id is not null)::text
  from public.listings where id = '20000000-0000-0000-0000-000000000003';

-- Bidding on a closed auction fails.
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a3';
select public.place_bid('30000000-0000-0000-0000-000000000001', 50);
select 'A25 (expect error above: auction has ended)';

-- Reserve not met: close produces no winner and frees the card.
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
begin;
insert into public.listings (id, seller_id, title, game, condition, price, sale_type)
values ('20000000-0000-0000-0000-000000000004', auth.uid(),
        'Reserve Auction', 'magic', 'NM', 10, 'auction');
insert into public.auctions (id, listing_id, seller_id, starting_price, reserve_price, currency, ends_at)
values ('30000000-0000-0000-0000-000000000002',
        '20000000-0000-0000-0000-000000000004', auth.uid(), 10, 100, 'USD',
        now() + interval '1 day');
commit;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a2';
select public.place_bid('30000000-0000-0000-0000-000000000002', 15);
reset role;
update public.auctions set ends_at = now() - interval '1 second'
  where id = '30000000-0000-0000-0000-000000000002';
select public.close_due_auctions();
select 'A26 below-reserve close has no winner: '
  || (status = 'closed' and winner_id is null)::text
  from public.auctions where id = '30000000-0000-0000-0000-000000000002';
select 'A27 unsold listing leaves browse: ' || (status = 'removed')::text
  from public.listings where id = '20000000-0000-0000-0000-000000000004';

-- Cancel requires a reason and notifies every bidder.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
begin;
insert into public.listings (id, seller_id, title, game, condition, price, sale_type)
values ('20000000-0000-0000-0000-000000000005', auth.uid(),
        'Cancelled Auction', 'yugioh', 'NM', 10, 'auction');
insert into public.auctions (id, listing_id, seller_id, starting_price, currency, ends_at)
values ('30000000-0000-0000-0000-000000000003',
        '20000000-0000-0000-0000-000000000005', auth.uid(), 10, 'USD',
        now() + interval '1 day');
commit;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a2';
select public.place_bid('30000000-0000-0000-0000-000000000003', 10);
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a3';
select public.place_bid('30000000-0000-0000-0000-000000000003', 11);
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
select public.cancel_auction('30000000-0000-0000-0000-000000000003', ' ');
select 'A28 (expect error above: cancel needs a reason)';
select public.cancel_auction('30000000-0000-0000-0000-000000000003', 'Card got damaged');
select 'A29 cancelled with reason recorded: '
  || (status = 'cancelled' and cancel_reason = 'Card got damaged')::text
  from public.auctions where id = '30000000-0000-0000-0000-000000000003';
select 'A30 every bidder notified: ' || (count(distinct c.buyer_id) = 2)::text
  from public.messages m
  join public.conversations c on c.id = m.conversation_id
  where c.listing_id = '20000000-0000-0000-0000-000000000005'
    and m.kind = 'system' and m.body like 'The seller cancelled this auction%';

reset role;

-- 0014: atomic creation RPC makes both rows; bad duration rejected.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
select 'A31 create_auction_listing returns a listing: '
  || (public.create_auction_listing(
        '{"title":"RPC Auction Card","game":"pokemon","condition":"NM","description":""}'::jsonb,
        25, null, 24) is not null)::text;
select 'A32 rpc made the pair: ' || (count(*) = 1)::text
  from public.listings l join public.auctions a on a.listing_id = l.id
  where l.title = 'RPC Auction Card' and l.sale_type = 'auction'
    and l.price = 25 and a.starting_price = 25;
select public.create_auction_listing(
  '{"title":"Bad Duration","game":"pokemon","condition":"NM"}'::jsonb, 25, null, 5);
select 'A33 (expect error above: invalid duration)';
reset role;

-- 0015/0016: no-show accountability, behind a 24h grace period.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
select public.report_auction_no_show('30000000-0000-0000-0000-000000000001');
select 'A33b (expect error above: inside the 24h grace period)';
-- Age the close so the rest of the accountability rules are reachable.
reset role;
update public.auctions set ends_at = now() - interval '2 days'
  where id = '30000000-0000-0000-0000-000000000001';
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a3';
select public.report_auction_no_show('30000000-0000-0000-0000-000000000001');
select 'A34 (expect error above: only seller or winner report no-shows)';
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
select public.report_auction_no_show('30000000-0000-0000-0000-000000000001');
select 'A35 seller reported the winner no-show: ' || (count(*) = 1)::text
  from public.auction_no_shows
  where auction_id = '30000000-0000-0000-0000-000000000001'
    and reported_id = '00000000-0000-0000-0000-0000000000a2' and role = 'winner';
-- The queue is deliberately not user-readable — assert as the service.
reset role;
select 'A36 no-show feeds the report queue: ' || (count(*) = 1)::text
  from public.reports
  where target_type = 'user' and target_id = '00000000-0000-0000-0000-0000000000a2'
    and detail like 'Auction no-show (winner)%';
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
select public.report_auction_no_show('30000000-0000-0000-0000-000000000001');
select 'A37 (expect error above: duplicate no-show report)';
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a2';
select public.report_auction_no_show('30000000-0000-0000-0000-000000000001');
select 'A38 winner mirrors for an unresponsive seller: ' || (count(*) = 1)::text
  from public.auction_no_shows
  where auction_id = '30000000-0000-0000-0000-000000000001'
    and reported_id = '00000000-0000-0000-0000-0000000000a1' and role = 'seller';

-- Three winner no-shows in 90 days block bidding (two more quick auctions).
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
begin;
insert into public.listings (id, seller_id, title, game, condition, price, sale_type)
values ('20000000-0000-0000-0000-000000000006', auth.uid(), 'NoShow A', 'magic', 'NM', 10, 'auction');
insert into public.auctions (id, listing_id, seller_id, starting_price, currency, ends_at)
values ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000006', auth.uid(), 10, 'USD', now() + interval '1 day');
commit;
begin;
insert into public.listings (id, seller_id, title, game, condition, price, sale_type)
values ('20000000-0000-0000-0000-000000000007', auth.uid(), 'NoShow B', 'magic', 'NM', 10, 'auction');
insert into public.auctions (id, listing_id, seller_id, starting_price, currency, ends_at)
values ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000007', auth.uid(), 10, 'USD', now() + interval '1 day');
commit;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a2';
select public.place_bid('30000000-0000-0000-0000-000000000004', 10);
select public.place_bid('30000000-0000-0000-0000-000000000005', 10);
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
select public.end_auction_early('30000000-0000-0000-0000-000000000004');
select public.end_auction_early('30000000-0000-0000-0000-000000000005');
reset role;
update public.auctions set ends_at = now() - interval '2 days'
  where id in ('30000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000005');
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
select public.report_auction_no_show('30000000-0000-0000-0000-000000000004');
select public.report_auction_no_show('30000000-0000-0000-0000-000000000005');
select 'A39 three strikes recorded: ' || (count(*) = 3)::text
  from public.auction_no_shows
  where reported_id = '00000000-0000-0000-0000-0000000000a2' and role = 'winner';

begin;
insert into public.listings (id, seller_id, title, game, condition, price, sale_type)
values ('20000000-0000-0000-0000-000000000008', auth.uid(), 'Post-ban Auction', 'magic', 'NM', 10, 'auction');
insert into public.auctions (id, listing_id, seller_id, starting_price, currency, ends_at)
values ('30000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000008', auth.uid(), 10, 'USD', now() + interval '1 day');
commit;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a2';
select public.place_bid('30000000-0000-0000-0000-000000000006', 10);
select 'A40 (expect error above: repeated no-shows block bidding)';
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a3';
select 'A41 other bidders unaffected: '
  || ((public.place_bid('30000000-0000-0000-0000-000000000006', 10)->>'amount')::numeric = 10)::text;
reset role;

-- 0016: a misfiled report can be withdrawn, leaving no trace.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
select public.retract_auction_no_show('30000000-0000-0000-0000-000000000004');
select 'A42 retract removes the strike: ' || (count(*) = 0)::text
  from public.auction_no_shows
  where auction_id = '30000000-0000-0000-0000-000000000004'
    and reporter_id = '00000000-0000-0000-0000-0000000000a1';
reset role;
select 'A43 retract removes the queue entry: ' || (count(*) = 0)::text
  from public.reports
  where detail = 'Auction no-show (winner) on auction 30000000-0000-0000-0000-000000000004';
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
select public.retract_auction_no_show('30000000-0000-0000-0000-000000000004');
select 'A44 (expect error above: nothing to retract)';
-- Down to two strikes, so bidding works again.
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a2';
select 'A45 bidding unblocked below three strikes: '
  || ((public.place_bid('30000000-0000-0000-0000-000000000006', 12)->>'amount')::numeric = 12)::text;
reset role;
