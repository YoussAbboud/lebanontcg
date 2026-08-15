-- 0008: offers in chat + public like counts
-- (design round R2: offer bubbles with accept/decline, ♡ counts on cards)

-- ---------------------------------------------------------------------------
-- Offers are messages with kind='offer', an amount, and a negotiation state
-- the RECIPIENT mutates (proposed -> accepted | declined).
-- ---------------------------------------------------------------------------
alter table public.messages drop constraint system_has_no_sender;
alter table public.messages drop constraint messages_kind_check;

alter table public.messages
  add column amount numeric(12, 2),
  add column offer_status text;

alter table public.messages
  add constraint messages_kind_check check (kind in ('user', 'system', 'offer')),
  add constraint system_has_no_sender check (
    (kind = 'system' and sender_id is null) or (kind <> 'system' and sender_id is not null)
  ),
  add constraint offer_shape check (
    (kind = 'offer' and amount is not null and amount > 0
       and offer_status in ('proposed', 'accepted', 'declined'))
    or (kind <> 'offer' and amount is null and offer_status is null)
  );

-- Participants may insert offers exactly like user messages.
drop policy "participants send messages" on public.messages;
create policy "participants send messages"
  on public.messages for insert
  with check (
    kind in ('user', 'offer')
    and sender_id = auth.uid()
    and (kind <> 'offer' or offer_status = 'proposed')
    and public.is_conversation_participant(conversation_id)
    and not exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and public.is_blocked_between(c.buyer_id, c.seller_id)
    )
  );

-- The existing "recipients mark messages read" UPDATE policy already limits
-- updates to participants who are NOT the sender; add the offer_status
-- column to the recipient's column grant.
grant update (offer_status) on public.messages to authenticated;

-- Enforce the offer state machine + system message on acceptance.
create or replace function public.enforce_offer_updates()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.offer_status is distinct from old.offer_status then
    if old.kind <> 'offer' then
      raise exception 'only offers have an offer status';
    end if;
    if old.offer_status <> 'proposed'
       or new.offer_status not in ('accepted', 'declined') then
      raise exception 'invalid offer transition: % -> %', old.offer_status, new.offer_status;
    end if;
    if new.offer_status = 'accepted' then
      insert into messages (conversation_id, sender_id, kind, body)
      values (
        old.conversation_id, null, 'system',
        'Offer accepted. Arrange payment and delivery between yourselves — LebanonTCG is not involved in the transaction.'
      );
    end if;
  end if;
  return new;
end;
$$;

create trigger messages_offer_updates
  before update on public.messages
  for each row execute function public.enforce_offer_updates();

-- ---------------------------------------------------------------------------
-- Public like counts. favorites RLS hides who liked what; this view exposes
-- only the aggregate (owner-rights view, so it bypasses favorites RLS).
-- ---------------------------------------------------------------------------
create view public.listing_likes as
  select listing_id, count(*)::integer as likes
  from public.favorites
  group by listing_id;

grant select on public.listing_likes to anon, authenticated;
