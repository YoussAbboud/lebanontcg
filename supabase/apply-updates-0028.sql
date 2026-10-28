-- ==========================================================================
-- LebanonTCG — UPDATE script: migration 0028 (share a phone number in chat)
--
-- Adds the 'phone' message kind: one E.164 number per message, sent with
-- the same rules as any message. Apply after 0027. Run ONCE.
--
-- HOW TO USE: Supabase dashboard → SQL Editor → New query → paste this
-- entire file → Run.
-- ==========================================================================


-- ──────────────────────────────────────────────────────────────────────────
-- BEGIN supabase/migrations/0028_phone_messages.sql
-- ──────────────────────────────────────────────────────────────────────────
-- 0028: share a phone number in chat.
--
-- A 'phone' message carries one phone number, in E.164 form (+96170123456),
-- as its body. It is an ordinary message in every other way: only the two
-- people in the conversation can read it, moderators see it only if it is
-- reported (0016), it counts as unread, and it notifies the other party.
-- The number is never copied onto the profile: sharing it in one chat does
-- not show it anywhere else.

alter table public.messages drop constraint messages_kind_check;
alter table public.messages
  add constraint messages_kind_check check (kind in ('user', 'system', 'offer', 'phone')),
  add constraint phone_shape check (kind <> 'phone' or body ~ '^\+[1-9][0-9]{6,14}$');

-- Sending: same rules as text and offers (participant, not suspended, not
-- blocked), now with 'phone' allowed. Keeps 0018's offer guard.
drop policy "participants send messages" on public.messages;
create policy "participants send messages"
  on public.messages for insert
  with check (
    kind in ('user', 'offer', 'phone')
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

-- Unread counts look at 'user' and 'phone' messages; widen the partial index.
drop index if exists public.messages_unread;
create index messages_unread on public.messages (conversation_id)
  where read_at is null and kind in ('user', 'phone');

-- The notification says a number was shared without repeating it.
create or replace function public.notify_message()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  conv record;
  other uuid;
  l record;
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
      case when new.kind = 'phone' then 'Shared their phone number' else left(new.body, 140) end,
      '/chat/' || new.conversation_id, new.sender_id,
      'conv:' || new.conversation_id);
  end if;
  return new;
end;
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- END supabase/migrations/0028_phone_messages.sql
-- ──────────────────────────────────────────────────────────────────────────

-- Tell the API (PostgREST) to reload the schema now, so the app sees the
-- new columns and kinds at once instead of failing with "could not find
-- the column … in the schema cache" until its cache refreshes.
notify pgrst, 'reload schema';
