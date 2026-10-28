-- Account deletion (0030). Deleting someone who has chatted succeeds, and
-- their conversations go with it, for both people: every message, phone
-- number and location shared there is gone. Run after all
-- migrations on a fresh database; ids are distinct from the other suites.
\set ON_ERROR_STOP off
\set QUIET on
\pset tuples_only on

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f8', 'seller@del.dev'),
  ('00000000-0000-0000-0000-0000000000f9', 'leaver@del.dev');
insert into public.listing_credit_packs (user_id, credits, status)
  select id, 1000, 'active' from auth.users where email like '%@del.dev';

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f8';
insert into public.listings (id, seller_id, title, game, condition, price)
  values ('d0000000-0000-0000-0000-000000000001', auth.uid(), 'Deletion Card', 'pokemon', 'NM', 100);
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f9';
select (public.open_conversation('d0000000-0000-0000-0000-000000000001')).id as conv \gset
insert into public.messages (conversation_id, sender_id, kind, body)
  values (:'conv', auth.uid(), 'user', 'Is it still available?');
insert into public.messages (conversation_id, sender_id, kind, body)
  values (:'conv', auth.uid(), 'phone', '+96170123456');
insert into public.messages (conversation_id, sender_id, kind, body, latitude, longitude)
  values (:'conv', auth.uid(), 'location', 'ABC Mall, Dbayeh', 33.93212, 35.58934);
reset role;

delete from auth.users where id = '00000000-0000-0000-0000-0000000000f9';
select 'D01 the account is deleted: ' || (count(*) = 0)::text
  from public.profiles where id = '00000000-0000-0000-0000-0000000000f9';

select 'D02 the conversation is gone for the other person too: ' || (count(*) = 0)::text
  from public.conversations where id = :'conv';
select 'D03 with every message in it: ' || (count(*) = 0)::text
  from public.messages where conversation_id = :'conv';
select 'D04 including the phone number and location: ' || (count(*) = 0)::text
  from public.messages where kind in ('phone', 'location');

-- New messages still need a sender: the insert policy requires sender_id = auth.uid().
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000fa', 'buyer@del.dev');
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000fa';
select (public.open_conversation('d0000000-0000-0000-0000-000000000001')).id as conv2 \gset
insert into public.messages (conversation_id, sender_id, kind, body)
  values (:'conv2', null, 'user', 'ghost');
select '(expect error above: a new message must come from the caller)';
select 'D05 no sender-less message was added: ' || (count(*) = 0)::text
  from public.messages where sender_id is null and kind <> 'system';
reset role;
