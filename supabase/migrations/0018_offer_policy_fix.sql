-- 0018: restore offer sending.
--
-- 0016 (admin) rewrote "participants send messages" to add the
-- suspension check, but narrowed the allowed kinds to 'user' only —
-- 0008 had deliberately allowed 'offer' (with offer_status forced to
-- 'proposed' at insert). The effect was that nobody could send an offer
-- any more: the insert failed the policy. This restores 0008's kinds
-- and guard while keeping 0016's suspension rule.

drop policy "participants send messages" on public.messages;
create policy "participants send messages"
  on public.messages for insert
  with check (
    kind in ('user', 'offer')
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
