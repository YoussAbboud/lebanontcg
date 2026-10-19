-- Support tickets (0026): anyone signed in — suspended included — opens
-- one; only the owner and moderators see it; replies go both ways and
-- notify the other side; closing is a moderator's call.
\set ON_ERROR_STOP off
\set QUIET on
\pset tuples_only on

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'mod@sup.dev'),
  ('00000000-0000-0000-0000-0000000000e2', 'user@sup.dev'),
  ('00000000-0000-0000-0000-0000000000e3', 'other@sup.dev');
set app.admin_action = '1';
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-0000000000e1';
update public.profiles set suspended_at = now(), suspended_reason = 'test'
  where id = '00000000-0000-0000-0000-0000000000e2';
set app.admin_action = '0';
update public.profiles set username = 'sup_user' where id = '00000000-0000-0000-0000-0000000000e2';

set role authenticated;
set request.jwt.claim.sub = '';
select public.open_support_ticket('Help', 'other', 'x');
select 'S01 (expect error above: not signed in)';

-- A suspended account can still appeal.
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e2';
select public.open_support_ticket('ab', 'appeal', 'Please reconsider');
select 'S02 (expect error above: subject too short)';
select public.open_support_ticket('My suspension', 'appeal', 'I think this was a mistake') as t \gset
select 'S03 a suspended user opened a ticket: ' || (count(*) = 1)::text
  from public.support_tickets where id = :'t' and status = 'open';
select 'S04 the first message is theirs, not staff: ' || (count(*) = 1)::text
  from public.support_messages where ticket_id = :'t' and from_staff = false;
insert into public.support_tickets (user_id, subject) values (auth.uid(), 'forged');
select 'S05 (expect error above: tickets are opened through the function)';

-- Staff hear about it; a stranger sees nothing.
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
select 'S06 the moderator was notified of the new ticket: ' || (count(*) = 1)::text
  from public.notifications where kind = 'support' and title like 'New ticket — My suspension';
select 'S07 the queue lists it with the user owing nothing: ' || (count(*) = 1)::text
  from public.admin_list_support_tickets('open') where id = :'t' and last_from = 'user';
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e3';
select 'S08 another user sees no ticket and no messages: ' || (count(*) = 0)::text
  from public.support_tickets;
select public.reply_support_ticket(:'t', 'me too');
select 'S09 (expect error above: not your ticket)';
select public.admin_list_support_tickets('open');
select 'S10 (expect error above or empty: queue is admin-only)';

-- The moderator replies; the user is told and replies back.
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
select public.reply_support_ticket(:'t', 'Looking into it now.') as reply \gset
select 'S11 a staff reply lands flagged as staff: ' || from_staff::text
  from public.support_messages where id = :'reply';
select 'S12 the ticket now waits on the user: ' || (last_from = 'staff')::text
  from public.support_tickets where id = :'t';
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e2';
select 'S13 the user was told support replied: ' || (count(*) = 1)::text
  from public.notifications where kind = 'support' and title like 'Support replied%';
select public.reply_support_ticket(:'t', 'Thank you.');
select 'S14 the user reads the whole thread: ' || (count(*) = 3)::text
  from public.support_messages where ticket_id = :'t';
select public.admin_close_support_ticket(:'t', 'no');
select 'S15 (expect error above: closing is for moderators)';

-- Closing.
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
select public.admin_close_support_ticket(:'t', 'Lifted the suspension — welcome back.');
select 'S16 the ticket is closed by the moderator: '
  || (status = 'closed' and closed_by = '00000000-0000-0000-0000-0000000000e1')::text
  from public.support_tickets where id = :'t';
select 'S17 a system line marks the close: ' || (count(*) = 1)::text
  from public.support_messages where ticket_id = :'t' and sender_id is null;
select public.admin_close_support_ticket(:'t', '');
select 'S18 (expect error above: already closed)';
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e2';
select public.reply_support_ticket(:'t', 'One more thing');
select 'S19 (expect error above: closed tickets take no user replies)';
select 'S20 the user was told it was closed, with the note: ' || (count(*) = 1)::text
  from public.notifications where kind = 'support' and title like 'Ticket closed%'
    and body like 'Lifted the suspension%';
-- A staff reply reopens.
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
select public.reply_support_ticket(:'t', 'Actually, one question.');
select 'S21 a staff reply reopens a closed ticket: ' || (status = 'open')::text
  from public.support_tickets where id = :'t';
reset role;
