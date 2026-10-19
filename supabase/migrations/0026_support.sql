-- 0026: support tickets.
--
-- The contact mailbox is replaced by something we can actually track: a
-- person opens a ticket (subject, category, first message), moderators
-- see the queue, reply in a thread, and close it. A suspended account
-- can still open one — that is who most needs to appeal. Tickets are
-- the appeal and data-request channel the Terms and Privacy Policy
-- promise, so nothing here depends on an email address.

create type public.support_category as enum
  ('account', 'listing', 'deal', 'payment', 'appeal', 'privacy', 'bug', 'other');
create type public.support_status as enum ('open', 'closed');

alter type public.notification_kind add value if not exists 'support';

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  subject text not null,
  category public.support_category not null default 'other',
  status public.support_status not null default 'open',
  created_at timestamptz not null default now(),
  /** Last activity, for ordering the queue. */
  updated_at timestamptz not null default now(),
  /** Who last wrote: 'user' means staff owe a reply. */
  last_from text not null default 'user' check (last_from in ('user', 'staff')),
  closed_at timestamptz,
  closed_by uuid references public.profiles (id) on delete set null,
  constraint subject_length check (char_length(subject) between 3 and 140)
);

create index support_tickets_queue on public.support_tickets (status, updated_at desc);
create index support_tickets_user on public.support_tickets (user_id, updated_at desc);

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  /** True when a moderator wrote it; the thread shows the badge. */
  from_staff boolean not null default false,
  /** Null sender + from_staff = a system line (closed, reopened). */
  body text not null,
  created_at timestamptz not null default now(),
  constraint body_length check (char_length(body) between 1 and 4000)
);

create index support_messages_ticket on public.support_messages (ticket_id, created_at);

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;

create policy "users read own tickets, admins read all"
  on public.support_tickets for select
  using (user_id = auth.uid() or public.is_admin());
create policy "ticket messages follow the ticket"
  on public.support_messages for select
  using (exists (
    select 1 from public.support_tickets t
    where t.id = ticket_id and (t.user_id = auth.uid() or public.is_admin())
  ));
-- No write policies: the functions below are the only door, so a
-- suspended account can open a ticket while RLS elsewhere keeps it out.

/** Everyone on the moderation team hears about queue activity. */
create or replace function public.notify_staff(
  p_kind public.notification_kind,
  p_title text,
  p_body text,
  p_href text,
  p_actor uuid,
  p_dedupe text
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  a uuid;
begin
  for a in select id from profiles where is_admin loop
    perform public.notify(a, p_kind, p_title, p_body, p_href, p_actor, p_dedupe);
  end loop;
end;
$$;
revoke execute on function public.notify_staff(public.notification_kind, text, text, text, uuid, text)
  from public, anon, authenticated;

create or replace function public.open_support_ticket(
  p_subject text,
  p_category public.support_category,
  p_body text
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if p_subject is null or length(trim(p_subject)) < 3 then
    raise exception 'give the ticket a subject';
  end if;
  if p_body is null or length(trim(p_body)) < 1 then
    raise exception 'say what you need';
  end if;
  -- A little rate limit: five open tickets is plenty.
  if (select count(*) from support_tickets where user_id = auth.uid() and status = 'open') >= 5 then
    raise exception 'you already have five open tickets — add to one of those';
  end if;
  insert into support_tickets (user_id, subject, category)
    values (auth.uid(), trim(p_subject), coalesce(p_category, 'other'))
    returning id into v_id;
  insert into support_messages (ticket_id, sender_id, from_staff, body)
    values (v_id, auth.uid(), false, trim(p_body));
  perform public.notify_staff('support',
    'New ticket — ' || trim(p_subject),
    public.handle_of(auth.uid()) || ': ' || left(trim(p_body), 140),
    '/admin?tab=support&ticket=' || v_id, auth.uid(), 'ticket:' || v_id);
  return v_id;
end;
$$;

create or replace function public.reply_support_ticket(p_ticket uuid, p_body text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  t record;
  v_staff boolean := public.is_admin();
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if p_body is null or length(trim(p_body)) < 1 then
    raise exception 'write something first';
  end if;
  select * into t from support_tickets where id = p_ticket;
  if not found then
    raise exception 'ticket not found';
  end if;
  if t.user_id <> auth.uid() and not v_staff then
    raise exception 'not your ticket';
  end if;
  if t.status = 'closed' and not v_staff then
    raise exception 'this ticket is closed — open a new one';
  end if;
  insert into support_messages (ticket_id, sender_id, from_staff, body)
    values (p_ticket, auth.uid(), v_staff, trim(p_body))
    returning id into v_id;
  update support_tickets
    set updated_at = now(),
        last_from = case when v_staff then 'staff' else 'user' end,
        -- A staff reply on a closed ticket reopens the conversation.
        status = case when v_staff and t.status = 'closed' then 'open' else t.status end,
        closed_at = case when v_staff and t.status = 'closed' then null else closed_at end
    where id = p_ticket;
  if v_staff then
    perform public.notify(t.user_id, 'support',
      'Support replied — ' || t.subject, left(trim(p_body), 140),
      '/support/' || p_ticket, auth.uid(), 'ticket:' || p_ticket);
  else
    perform public.notify_staff('support',
      'Reply on ticket — ' || t.subject,
      public.handle_of(auth.uid()) || ': ' || left(trim(p_body), 140),
      '/admin?tab=support&ticket=' || p_ticket, auth.uid(), 'ticket:' || p_ticket);
  end if;
  return v_id;
end;
$$;

create or replace function public.admin_close_support_ticket(p_ticket uuid, p_note text default '')
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_actor uuid := public.require_admin();
  t record;
begin
  select * into t from support_tickets where id = p_ticket and status = 'open';
  if not found then
    raise exception 'no open ticket with that id';
  end if;
  if nullif(trim(p_note), '') is not null then
    insert into support_messages (ticket_id, sender_id, from_staff, body)
      values (p_ticket, v_actor, true, trim(p_note));
  end if;
  insert into support_messages (ticket_id, sender_id, from_staff, body)
    values (p_ticket, null, true, 'Ticket closed by ' || public.handle_of(v_actor) || '.');
  update support_tickets
    set status = 'closed', closed_at = now(), closed_by = v_actor, updated_at = now(),
        last_from = 'staff'
    where id = p_ticket;
  perform public.notify(t.user_id, 'support',
    'Ticket closed — ' || t.subject,
    coalesce(nullif(trim(p_note), ''), 'If anything is still unresolved, open a new ticket.'),
    '/support/' || p_ticket, v_actor, 'ticket:' || p_ticket);
end;
$$;

/** The queue, with who wrote last and when. */
create or replace function public.admin_list_support_tickets(p_status public.support_status default 'open')
returns table (
  id uuid,
  user_id uuid,
  username text,
  display_name text,
  subject text,
  category public.support_category,
  status public.support_status,
  last_from text,
  created_at timestamptz,
  updated_at timestamptz,
  message_count bigint
)
language sql
stable
security definer set search_path = public
as $$
  select t.id, t.user_id, p.username, p.display_name, t.subject, t.category, t.status,
         t.last_from, t.created_at, t.updated_at,
         (select count(*) from support_messages m where m.ticket_id = t.id)
    from support_tickets t
    join profiles p on p.id = t.user_id
   where public.is_admin() and t.status = p_status
   order by (t.last_from = 'user') desc, t.updated_at desc;
$$;

do $$
begin
  alter publication supabase_realtime add table public.support_messages;
  alter publication supabase_realtime add table public.support_tickets;
exception when others then
  null;
end
$$;
