-- Listing review (0031). A member's new listing is hidden until screening
-- or a moderator approves it; only the screening secret can approve from
-- a check; new photos send it back to review; a moderator's rejection
-- can only be undone by a moderator; auctions wait without losing time.
-- Run after all migrations and the seed on a fresh database, WITHOUT
-- legacy-autoapprove.sql.
\set ON_ERROR_STOP off
\set QUIET on
\pset tuples_only on

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'seller@review.dev'),
  ('00000000-0000-0000-0000-0000000000e2', 'stranger@review.dev'),
  ('00000000-0000-0000-0000-0000000000e3', 'admin@review.dev');
insert into public.listing_credit_packs (user_id, credits, status)
  select id, 1000, 'active' from auth.users where email like '%@review.dev';
set app.admin_action = '1';
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-0000000000e3';
set app.admin_action = '0';

select private.rotate_listing_screen_secret() as secret \gset

select 'R00 the seed''s listings (no signed-in user) stay public: '
  || (count(*) > 0 and bool_and(review_state = 'approved'))::text
  from public.listings;

-- ---------------------------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
insert into public.listings (id, seller_id, title, game, condition, price, review_state)
  values ('e0000000-0000-0000-0000-000000000001', auth.uid(), 'Junk', 'pokemon', 'NM', 10, 'approved');
insert into public.listing_images (listing_id, storage_path)
  values ('e0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000e1/x/1.jpg');
select 'R01 a member''s listing starts pending even when it asks to be approved: '
  || (review_state = 'pending' and review_requested_at is not null)::text
  from public.listings where id = 'e0000000-0000-0000-0000-000000000001';

update public.listings set review_state = 'approved' where id = 'e0000000-0000-0000-0000-000000000001';
select '(expect error above: a seller cannot approve their own listing)';

set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e2';
select 'R02 a stranger cannot see a pending listing: ' || (count(*) = 0)::text
  from public.listings where id = 'e0000000-0000-0000-0000-000000000001';
select 'R03 ...or its photos: ' || (count(*) = 0)::text
  from public.listing_images where listing_id = 'e0000000-0000-0000-0000-000000000001';
select public.open_conversation('e0000000-0000-0000-0000-000000000001');
select '(expect error above: no chat about a pending listing)';
insert into public.favorites (user_id, listing_id)
  values (auth.uid(), 'e0000000-0000-0000-0000-000000000001');
select '(expect error above: no watching a pending listing)';
select public.claim_listing_screen('e0000000-0000-0000-0000-000000000001');
select '(expect error above: only the seller can ask for a check)';
select private.rotate_listing_screen_secret();
select '(expect error above: members cannot touch the screening secret)';

reset role;
reset request.jwt.claim.sub;
set role anon;
select 'R04 nor can a visitor: ' || (count(*) = 0)::text
  from public.listings where id = 'e0000000-0000-0000-0000-000000000001';

reset role;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e3';
select 'R05 a moderator can: ' || (count(*) = 1)::text
  from public.listings where id = 'e0000000-0000-0000-0000-000000000001';

-- ---------------------------------------------------------------------------
-- Screening
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
select 'R06 the seller sees their own pending listing: ' || (count(*) = 1)::text
  from public.listings where id = 'e0000000-0000-0000-0000-000000000001';
select public.claim_listing_screen('e0000000-0000-0000-0000-000000000001') as s1 \gset
select public.record_listing_screen(:'s1', 'not-the-secret', 'card', 'looks fine');
select '(expect error above: a check without the secret is refused)';
select 'R07 ...and changed nothing: ' || (review_state = 'pending')::text
  from public.listings where id = 'e0000000-0000-0000-0000-000000000001';
select 'R08 a "not a card" check leaves it pending: '
  || (public.record_listing_screen(:'s1', :'secret', 'not_card', 'A photo of a sandwich') = 'pending')::text;
select public.record_listing_screen(:'s1', :'secret', 'card', '');
select '(expect error above: a check is recorded once)';
select public.claim_listing_screen('e0000000-0000-0000-0000-000000000001') \gset
select public.claim_listing_screen('e0000000-0000-0000-0000-000000000001') \gset
select public.claim_listing_screen('e0000000-0000-0000-0000-000000000001');
select '(expect error above: three checks per listing, then moderators decide)';

reset role;
select 'R09 moderators heard about it: ' || (count(*) = 1)::text
  from public.notifications
  where user_id = '00000000-0000-0000-0000-0000000000e3' and dedupe_key = 'review:e0000000-0000-0000-0000-000000000001';
select 'R10 the seller can read their checks: ' || (count(*) = 3)::text
  from public.listing_screens where listing_id = 'e0000000-0000-0000-0000-000000000001';

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
insert into public.listings (id, seller_id, title, game, condition, price)
  values ('e0000000-0000-0000-0000-000000000002', auth.uid(), 'Charizard', 'pokemon', 'NM', 300);
insert into public.listing_images (listing_id, storage_path)
  values ('e0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000e1/y/1.jpg');
select public.claim_listing_screen('e0000000-0000-0000-0000-000000000002') as s2 \gset
select 'R11 a "card" check approves it: '
  || (public.record_listing_screen(:'s2', :'secret', 'card', 'A Charizard card') = 'approved')::text;

set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e2';
select 'R12 ...and everyone can see it: ' || (count(*) = 1)::text
  from public.listings where id = 'e0000000-0000-0000-0000-000000000002';
select 'R13 ...and open a chat: '
  || ((public.open_conversation('e0000000-0000-0000-0000-000000000002')).id is not null)::text;
insert into public.favorites (user_id, listing_id)
  values (auth.uid(), 'e0000000-0000-0000-0000-000000000002');
select 'R14 ...and watch it: ' || (count(*) = 1)::text
  from public.favorites where listing_id = 'e0000000-0000-0000-0000-000000000002';

-- New photos go back to review.
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
insert into public.listing_images (listing_id, storage_path, sort_order)
  values ('e0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000e1/y/2.jpg', 1);
select 'R15 a new photo sends an approved listing back to review: ' || (review_state = 'pending')::text
  from public.listings where id = 'e0000000-0000-0000-0000-000000000002';
reset role;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000e4', 'other@review.dev');
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e4';
select 'R16 ...hidden from new people: ' || (count(*) = 0)::text
  from public.listings where id = 'e0000000-0000-0000-0000-000000000002';
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e2';
select 'R17 ...but the buyer already chatting still sees it: ' || (count(*) = 1)::text
  from public.listings where id = 'e0000000-0000-0000-0000-000000000002';

-- ---------------------------------------------------------------------------
-- Moderators
select public.admin_review_listing('e0000000-0000-0000-0000-000000000001', false, 'Not a card');
select '(expect error above: members cannot review listings)';

set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e3';
select public.admin_review_listing('e0000000-0000-0000-0000-000000000001', false, '');
select '(expect error above: rejecting needs a reason)';
select public.admin_review_listing('e0000000-0000-0000-0000-000000000001', false, 'Not a trading card');
select 'R18 a moderator rejects with a reason: '
  || (review_state = 'rejected' and review_note = 'Not a trading card' and reviewed_by is not null)::text
  from public.listings where id = 'e0000000-0000-0000-0000-000000000001';
select 'R19 ...logged: ' || (count(*) = 1)::text
  from public.admin_actions where kind = 'listing_reject';

set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
select 'R20 the seller sees why: ' || (review_note = 'Not a trading card')::text
  from public.listings where id = 'e0000000-0000-0000-0000-000000000001';
select 'R21 ...and was told: ' || (count(*) = 1)::text
  from public.notifications where kind = 'moderation' and title like 'Your listing wasn%';

-- Trying again with new photos goes to a moderator, whatever the check says.
insert into public.listing_images (listing_id, storage_path, sort_order)
  values ('e0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000e1/x/2.jpg', 1);
select 'R22 new photos on a rejected listing put it back in the queue: ' || (review_state = 'pending')::text
  from public.listings where id = 'e0000000-0000-0000-0000-000000000001';
reset role;
delete from public.listing_screens where listing_id = 'e0000000-0000-0000-0000-000000000001';
set role authenticated;
select public.claim_listing_screen('e0000000-0000-0000-0000-000000000001') as s3 \gset
select 'R23 ...where a "card" check cannot overrule the moderator: '
  || (public.record_listing_screen(:'s3', :'secret', 'card', '') = 'pending')::text;

set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e3';
select public.admin_review_listing('e0000000-0000-0000-0000-000000000001', true, '');
select 'R24 a moderator approves: ' || (review_state = 'approved' and review_note is null)::text
  from public.listings where id = 'e0000000-0000-0000-0000-000000000001';
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
select 'R25 ...and the seller hears it''s live: ' || (count(*) = 1)::text
  from public.notifications where kind = 'moderation' and title = 'Your listing is live';

-- ---------------------------------------------------------------------------
-- Auctions wait without losing time
select public.create_auction_listing(
  '{"title": "Auction card", "game": "magic", "condition": "NM"}'::jsonb, 10, null, 1) as auc_listing \gset
select 'R26 an auction listing starts pending: ' || (review_state = 'pending')::text
  from public.listings where id = :'auc_listing';
reset role;
select id as auc from public.auctions where listing_id = :'auc_listing' \gset
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e2';
select 'R27 nobody else sees its auction: ' || (count(*) = 0)::text
  from public.auctions where id = :'auc';
select public.place_bid(:'auc', 20);
select '(expect error above: this listing is waiting for review — no bids while it waits)';

reset role;
-- pretend it has been waiting two hours, past its one-hour end
update public.auctions set ends_at = now() - interval '1 hour' where id = :'auc';
set app.listing_review = '1';
update public.listings set review_requested_at = now() - interval '2 hours' where id = :'auc_listing';
set app.listing_review = '';
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e2';
select 'R28 the closing sweep leaves it alone: ' || (public.close_due_auctions() = 0)::text;
reset role;
select 'R29 ...still live: ' || (status = 'live')::text from public.auctions where id = :'auc';

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e3';
select public.admin_review_listing(:'auc_listing', true, '');
reset role;
select 'R30 approval gives the waiting time back: '
  || (ends_at between now() + interval '55 minutes' and now() + interval '65 minutes')::text
  from public.auctions where id = :'auc';

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e2';
select 'R31 ...and bidding opens: ' || (((public.place_bid(:'auc', 20))->>'amount')::numeric = 20)::text;

-- A rejected auction is cancelled.
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
select public.create_auction_listing(
  '{"title": "Auction junk", "game": "magic", "condition": "NM"}'::jsonb, 10, null, 24) as auc2_listing \gset
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e3';
select public.admin_review_listing(:'auc2_listing', false, 'Not a card');
select 'R32 rejecting an auction cancels it: ' || (status = 'cancelled')::text
  from public.auctions where listing_id = :'auc2_listing';
select 'R33 the overview counts the queue: '
  || ((public.admin_stats())->>'listingsPending' = '1')::text;
reset role;
