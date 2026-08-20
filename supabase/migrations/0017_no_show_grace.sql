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
