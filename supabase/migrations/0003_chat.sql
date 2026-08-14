-- 0003: conversations + messages + blocks + system messages on status change
-- (blocks live here because message policies depend on them)

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint no_self_block check (blocker_id <> blocked_id)
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  unique (listing_id, buyer_id),
  constraint buyer_is_not_seller check (buyer_id <> seller_id)
);

create index conversations_buyer on public.conversations (buyer_id, last_message_at desc);
create index conversations_seller on public.conversations (seller_id, last_message_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  -- null sender = system message
  sender_id uuid references public.profiles (id) on delete set null,
  kind text not null default 'user' check (kind in ('user', 'system')),
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint body_length check (char_length(body) between 1 and 2000),
  constraint system_has_no_sender check (
    (kind = 'system' and sender_id is null) or (kind = 'user' and sender_id is not null)
  )
);

create index messages_conversation on public.messages (conversation_id, created_at);
create index messages_unread on public.messages (conversation_id)
  where read_at is null and kind = 'user';

-- Now that conversations exists, wire the deferred FK on listings.
alter table public.listings
  add constraint listings_reserved_for_fk
  foreign key (reserved_for_conversation_id)
  references public.conversations (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Helpers (security definer so RLS policies can check blocks both ways
-- without exposing who-blocked-whom to the blocked party)
-- ---------------------------------------------------------------------------
create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from blocks
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  );
$$;

create or replace function public.is_conversation_participant(c_id uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from conversations c
    where c.id = c_id and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
  );
$$;

-- Atomic buyer-side conversation open: validates listing state and blocks,
-- returns the existing conversation if one is already open.
create or replace function public.open_conversation(p_listing_id uuid)
returns public.conversations
language plpgsql
security definer set search_path = public
as $$
declare
  l record;
  conv public.conversations;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  select id, seller_id, status into l from listings where id = p_listing_id;
  if not found then
    raise exception 'listing not found';
  end if;
  if l.seller_id = auth.uid() then
    raise exception 'you cannot message yourself';
  end if;
  if l.status in ('removed') then
    raise exception 'this listing is no longer available';
  end if;
  if public.is_blocked_between(auth.uid(), l.seller_id) then
    raise exception 'you cannot message this seller';
  end if;

  select * into conv from conversations
    where listing_id = p_listing_id and buyer_id = auth.uid();
  if found then
    return conv;
  end if;

  insert into conversations (listing_id, buyer_id, seller_id)
    values (p_listing_id, auth.uid(), l.seller_id)
    returning * into conv;
  return conv;
end;
$$;

-- Keep conversations.last_message_at fresh.
create or replace function public.bump_conversation()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update conversations set last_message_at = new.created_at
    where id = new.conversation_id;
  return new;
end;
$$;

create trigger messages_bump_conversation
  after insert on public.messages
  for each row execute function public.bump_conversation();

-- System message into every conversation when a listing's status changes,
-- mirroring statusChangeSystemMessage() in src/lib/status.ts.
create or replace function public.announce_listing_status()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  conv record;
  msg text;
begin
  if new.status is distinct from old.status then
    for conv in select id from conversations where listing_id = new.id loop
      msg := case new.status
        when 'reserved' then
          case when new.reserved_for_conversation_id = conv.id
            then 'Seller reserved this listing for this conversation.'
            else 'Seller marked this listing as reserved.'
          end
        when 'sold' then 'Seller marked this listing as sold.'
        when 'active' then 'Seller relisted this card — it is available again.'
        when 'removed' then 'Seller removed this listing.'
      end;
      insert into messages (conversation_id, sender_id, kind, body)
        values (conv.id, null, 'system', msg);
    end loop;
  end if;
  return new;
end;
$$;

create trigger listings_announce_status
  after update on public.listings
  for each row execute function public.announce_listing_status();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

-- Deferred from 0002: listings visibility depends on conversations.
-- Active/reserved/sold rows are publicly readable (sold stays visible so
-- conversations and reviews keep their subject); removed rows are visible
-- only to the seller and to conversation participants.
create or replace function public.is_conversation_party_for_listing(l_id uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from conversations c
    where c.listing_id = l_id
      and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
  );
$$;

create policy "listings readable unless removed"
  on public.listings for select
  using (
    status <> 'removed'
    or seller_id = auth.uid()
    or public.is_conversation_party_for_listing(id)
  );

alter table public.blocks enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

create policy "users see own blocks"
  on public.blocks for select
  using (blocker_id = auth.uid());

create policy "users create own blocks"
  on public.blocks for insert
  with check (blocker_id = auth.uid());

create policy "users remove own blocks"
  on public.blocks for delete
  using (blocker_id = auth.uid());

create policy "participants read conversations"
  on public.conversations for select
  using (buyer_id = auth.uid() or seller_id = auth.uid());

-- Conversation creation goes through open_conversation() (security
-- definer), which performs listing/block validation atomically. A direct
-- insert path is still allowed for the buyer with equivalent checks.
create policy "buyers open conversations"
  on public.conversations for insert
  with check (
    buyer_id = auth.uid()
    and buyer_id <> seller_id
    and exists (
      select 1 from public.listings l
      where l.id = listing_id
        and l.seller_id = conversations.seller_id
        and l.status <> 'removed'
    )
    and not public.is_blocked_between(buyer_id, seller_id)
  );

create policy "participants read messages"
  on public.messages for select
  using (public.is_conversation_participant(conversation_id));

create policy "participants send messages"
  on public.messages for insert
  with check (
    kind = 'user'
    and sender_id = auth.uid()
    and public.is_conversation_participant(conversation_id)
    and not exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and public.is_blocked_between(c.buyer_id, c.seller_id)
    )
  );

-- Read receipts: recipients may flip read_at on messages sent to them.
-- Column-level grant keeps body/sender immutable even under this policy.
create policy "recipients mark messages read"
  on public.messages for update
  using (
    public.is_conversation_participant(conversation_id)
    and (sender_id is distinct from auth.uid())
  )
  with check (
    public.is_conversation_participant(conversation_id)
  );

revoke update on public.messages from authenticated;
grant update (read_at) on public.messages to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: chat + live listing status changes
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.listings;
alter publication supabase_realtime add table public.conversations;
