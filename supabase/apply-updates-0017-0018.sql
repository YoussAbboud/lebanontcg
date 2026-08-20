-- ==========================================================================
-- LebanonTCG — UPDATE script: migrations 0017 + 0018
-- 0017 no-show grace period + withdrawal.
-- 0018 restores offer sending (0016 narrowed the message policy to
--      kind='user', which silently blocked offers).
-- Apply after 0016 (admin).
--
-- HOW TO USE: Supabase dashboard → SQL Editor → New query → paste this
-- entire file → Run. Run it ONCE.
-- ==========================================================================


-- ──────────────────────────────────────────────────────────────────────────
-- BEGIN supabase/migrations/0017_no_show_grace.sql
-- ──────────────────────────────────────────────────────────────────────────
-- 0016: no-shows need time to actually happen, and a misfile needs an
-- undo. Reporting one seconds after the close was possible (and read as
-- an accusation the UI offered immediately) — it now requires a grace
-- period, and the reporter can retract their own report.

-- Nobody has failed to follow through within a day of winning.
create or replace function public.report_auction_no_show(p_auction_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  a record;
  v_reported uuid;
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  select * into a from auctions where id = p_auction_id;
  if not found then
    raise exception 'auction not found';
  end if;
  if a.status <> 'closed' or a.winner_id is null then
    raise exception 'no-shows can only be reported on a closed auction with a winner';
  end if;
  if now() < a.ends_at + interval '24 hours' then
    raise exception 'give them a day — no-shows can be reported 24 hours after the auction closes';
  end if;
  if auth.uid() = a.seller_id then
    v_reported := a.winner_id;
    v_role := 'winner';
  elsif auth.uid() = a.winner_id then
    v_reported := a.seller_id;
    v_role := 'seller';
  else
    raise exception 'only the seller or the winner can report a no-show';
  end if;

  insert into auction_no_shows (auction_id, reporter_id, reported_id, role)
    values (p_auction_id, auth.uid(), v_reported, v_role);

  insert into reports (reporter_id, target_type, target_id, reason, detail)
    values (auth.uid(), 'user', v_reported::text, 'other',
      'Auction no-show (' || v_role || ') on auction ' || p_auction_id);
end;
$$;

-- Retract your own report: the strike and its queue entry both go, so a
-- misfiled accusation leaves no trace on the other person's record.
create or replace function public.retract_auction_no_show(p_auction_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auction_no_shows
    where auction_id = p_auction_id and reporter_id = auth.uid()
    returning role into v_role;
  if v_role is null then
    raise exception 'nothing to retract';
  end if;
  delete from reports
    where reporter_id = auth.uid()
      and target_type = 'user'
      and detail = 'Auction no-show (' || v_role || ') on auction ' || p_auction_id;
end;
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- END supabase/migrations/0017_no_show_grace.sql
-- ──────────────────────────────────────────────────────────────────────────


-- ──────────────────────────────────────────────────────────────────────────
-- BEGIN supabase/migrations/0018_offer_policy_fix.sql
-- ──────────────────────────────────────────────────────────────────────────
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

-- ──────────────────────────────────────────────────────────────────────────
-- END supabase/migrations/0018_offer_policy_fix.sql
-- ──────────────────────────────────────────────────────────────────────────

