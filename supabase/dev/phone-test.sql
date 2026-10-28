-- Phone-number messages (0028). Only the two people in the chat can send
-- or read them, the body must be one E.164 number, they count as unread,
-- and the notification does not repeat the number. Run after all
-- migrations on a fresh database; ids are distinct from the other suites.
\set ON_ERROR_STOP off
\set QUIET on
\pset tuples_only on

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'seller@phone.dev'),
  ('00000000-0000-0000-0000-0000000000f2', 'buyer@phone.dev'),
  ('00000000-0000-0000-0000-0000000000f3', 'stranger@phone.dev'),
  ('00000000-0000-0000-0000-0000000000f4', 'admin@phone.dev');
insert into public.listing_credit_packs (user_id, credits, status)
  select id, 1000, 'active' from auth.users where email like '%@phone.dev';
update public.profiles set username = 'ph_buyer' where id = '00000000-0000-0000-0000-0000000000f2';
set app.admin_action = '1';
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-0000000000f4';
set app.admin_action = '0';

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f1';
insert into public.listings (id, seller_id, title, game, condition, price)
  values ('80000000-0000-0000-0000-000000000001', auth.uid(), 'Phone Card', 'pokemon', 'NM', 100);
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f2';
select (public.open_conversation('80000000-0000-0000-0000-000000000001')).id as conv \gset

insert into public.messages (id, conversation_id, sender_id, kind, body)
  values ('90000000-0000-0000-0000-000000000001', :'conv', auth.uid(), 'phone', '+96170123456');
select 'P01 a participant can share a number: ' || (count(*) = 1)::text
  from public.messages where kind = 'phone';

insert into public.messages (conversation_id, sender_id, kind, body)
  values (:'conv', auth.uid(), 'phone', 'call me on 70 123 456');
select '(expect error above: a phone message must be one E.164 number)';
insert into public.messages (conversation_id, sender_id, kind, body)
  values (:'conv', auth.uid(), 'phone', '+96170');
select '(expect error above: too short)';
select 'P02 neither malformed number was stored: ' || (count(*) = 1)::text
  from public.messages where kind = 'phone';

set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f1';
select 'P03 the other party reads it: ' || (body = '+96170123456')::text
  from public.messages where kind = 'phone';
select 'P04 it counts as unread for them: ' || (count(*) = 1)::text
  from public.messages where kind in ('user', 'phone') and read_at is null
   and sender_id <> auth.uid();
select 'P05 they are notified without the number: ' || (body = 'Shared their phone number')::text
  from public.notifications where kind = 'message';

set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f3';
select 'P06 a stranger cannot read it: ' || (count(*) = 0)::text
  from public.messages where kind = 'phone';
insert into public.messages (conversation_id, sender_id, kind, body)
  values (:'conv', auth.uid(), 'phone', '+96171000000');
select '(expect error above: only participants can send)';

set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f4';
select 'P07 an admin cannot read an unreported number: ' || (count(*) = 0)::text
  from public.messages where kind = 'phone';
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f1';
insert into public.reports (reporter_id, target_type, target_id, reason)
  values (auth.uid(), 'message', '90000000-0000-0000-0000-000000000001', 'spam');
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f4';
select 'P08 once reported, the admin sees that message: ' || (count(*) = 1)::text
  from public.messages where kind = 'phone';

reset role;
