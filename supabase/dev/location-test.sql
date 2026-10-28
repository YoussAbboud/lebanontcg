-- Location messages (0029). Only the two people in the chat can send or
-- read them, the point must be a real coordinate, other kinds cannot carry
-- one, they count as unread, and the notification does not repeat the
-- place. Run after all migrations on a fresh database; ids are distinct
-- from the other suites.
\set ON_ERROR_STOP off
\set QUIET on
\pset tuples_only on

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f5', 'seller@loc.dev'),
  ('00000000-0000-0000-0000-0000000000f6', 'buyer@loc.dev'),
  ('00000000-0000-0000-0000-0000000000f7', 'stranger@loc.dev');
insert into public.listing_credit_packs (user_id, credits, status)
  select id, 1000, 'active' from auth.users where email like '%@loc.dev';

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f5';
insert into public.listings (id, seller_id, title, game, condition, price)
  values ('b0000000-0000-0000-0000-000000000001', auth.uid(), 'Location Card', 'pokemon', 'NM', 100);
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f6';
select (public.open_conversation('b0000000-0000-0000-0000-000000000001')).id as conv \gset

insert into public.messages (conversation_id, sender_id, kind, body, latitude, longitude)
  values (:'conv', auth.uid(), 'location', 'ABC Mall, Dbayeh', 33.93212, 35.58934);
select 'L01 a participant can share a place: ' || (count(*) = 1)::text
  from public.messages where kind = 'location';

insert into public.messages (conversation_id, sender_id, kind, body, latitude, longitude)
  values (:'conv', auth.uid(), 'location', 'Nowhere', 95, 35.5);
select '(expect error above: latitude out of range)';
insert into public.messages (conversation_id, sender_id, kind, body)
  values (:'conv', auth.uid(), 'location', 'No point');
select '(expect error above: a location needs a point)';
insert into public.messages (conversation_id, sender_id, kind, body, latitude, longitude)
  values (:'conv', auth.uid(), 'user', 'hi', 33.9, 35.5);
select '(expect error above: only location messages carry a point)';
select 'L02 none of those were stored: ' || (count(*) = 1)::text
  from public.messages where latitude is not null;

set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f5';
select 'L03 the other party reads the point: '
  || (latitude = 33.93212 and longitude = 35.58934 and body = 'ABC Mall, Dbayeh')::text
  from public.messages where kind = 'location';
select 'L04 it counts as unread for them: ' || (count(*) = 1)::text
  from public.messages where kind in ('user', 'phone', 'location') and read_at is null
   and sender_id <> auth.uid();
select 'L05 they are notified without the place: ' || (body = 'Shared a location')::text
  from public.notifications where kind = 'message';

set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f7';
select 'L06 a stranger cannot read it: ' || (count(*) = 0)::text
  from public.messages where kind = 'location';

reset role;
