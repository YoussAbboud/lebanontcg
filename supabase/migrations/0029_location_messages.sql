-- 0029: share a location in chat.
--
-- A 'location' message carries a point (latitude, longitude) and, as its
-- body, a short place name ("ABC Mall, Dbayeh") or 'Location' when none was
-- given. Like a phone number it is an ordinary message otherwise: only the
-- two people in the conversation can read it, moderators see it only if it
-- is reported (0016), it counts as unread and it notifies the other party.
-- Points are stored to 5 decimals (about a metre); the app sends no more.

alter table public.messages
  add column latitude numeric(8, 5),
  add column longitude numeric(8, 5);

alter table public.messages drop constraint messages_kind_check;
alter table public.messages
  add constraint messages_kind_check
    check (kind in ('user', 'system', 'offer', 'phone', 'location')),
  add constraint location_shape check (
    -- (explicit not-nulls: a NULL check passes, and NULL between … is NULL)
    (kind = 'location'
      and latitude is not null and longitude is not null
      and latitude between -90 and 90
      and longitude between -180 and 180
      and char_length(body) <= 120)
    or (kind <> 'location' and latitude is null and longitude is null)
  );

-- Sending: same rules as every other kind (participant, not suspended, not
-- blocked), now with 'location' allowed. Keeps 0018's offer guard.
drop policy "participants send messages" on public.messages;
create policy "participants send messages"
  on public.messages for insert
  with check (
    kind in ('user', 'offer', 'phone', 'location')
    and sender_id = auth.uid()
    and (kind <> 'offer' or offer_status = 'proposed')
    and public.is_conversation_participant(conversation_id)
    and not public.is_suspended()
    and not exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and public.is_blocked_between(c.buyer_id, c.seller_id)
    )
  );

drop index if exists public.messages_unread;
create index messages_unread on public.messages (conversation_id)
  where read_at is null and kind in ('user', 'phone', 'location');

create or replace function public.notify_message()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  conv record;
  other uuid;
begin
  if new.kind = 'system' or new.sender_id is null then
    return new;
  end if;
  select c.*, li.title as listing_title, li.currency into conv
    from conversations c join listings li on li.id = c.listing_id
    where c.id = new.conversation_id;
  other := case when new.sender_id = conv.buyer_id then conv.seller_id else conv.buyer_id end;
  if new.kind = 'offer' then
    perform public.notify(other, 'offer',
      public.handle_of(new.sender_id) || ' offered ' || to_char(new.amount, 'FM999,999,990') || ' ' || conv.currency,
      conv.listing_title, '/chat/' || new.conversation_id, new.sender_id, null);
  else
    perform public.notify(other, 'message',
      public.handle_of(new.sender_id) || ' · ' || conv.listing_title,
      case new.kind
        when 'phone' then 'Shared their phone number'
        when 'location' then 'Shared a location'
        else left(new.body, 140)
      end,
      '/chat/' || new.conversation_id, new.sender_id,
      'conv:' || new.conversation_id);
  end if;
  return new;
end;
$$;
