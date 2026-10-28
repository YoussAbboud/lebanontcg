-- ==========================================================================
-- LebanonTCG — UPDATE script: migration 0033 (the listing cooldown counts
-- every listing that goes to review)
--
-- Two listings in review in a row, or two within five minutes — however
-- they got there — now pause listing for ten minutes. Apply after 0032.
-- Run ONCE.
--
-- HOW TO USE: Supabase dashboard → SQL Editor → New query → paste this
-- entire file → Run.
-- ==========================================================================


-- ──────────────────────────────────────────────────────────────────────────
-- BEGIN supabase/migrations/0033_cooldown_counts_every_review.sql
-- ──────────────────────────────────────────────────────────────────────────
-- 0033: the listing cooldown counts every listing that goes to review.
--
-- 0032 counted only listings the photo check itself flagged ("not a card"
-- or "unsure"). A listing that reached review any other way — the check
-- failed, never ran, or its result never came back — didn't count, so a
-- seller could post three fan photos in a minute. Now a listing counts
-- the moment it is in review (pending or rejected), whatever sent it
-- there, and stops counting only when it's approved — by the check or by
-- a moderator. Removing it doesn't take the flag back.
--
-- The rule is otherwise the same: two such listings one after the other,
-- or two within five minutes, stop the seller listing or adding photos
-- for ten minutes from the second. In practice the third listing inside
-- five minutes is refused. A listing's time is when it went to review
-- (created, or given new photos).
--
-- The photos of the listing being created are not held against it: the
-- check behind the cooldown leaves out the listing they're being added to.

drop function if exists public.my_listing_cooldown();
drop function if exists public.listing_cooldown_until(uuid);

create or replace function public.listing_cooldown_until(p_user uuid, p_exclude uuid default null)
returns timestamptz
language sql
security definer set search_path = public
stable
as $$
  with seq as (
    select
      l.id,
      l.review_requested_at as at,
      l.review_state <> 'approved' as flagged
    from listings l
    where l.seller_id = p_user
      and l.review_requested_at is not null
      and l.review_requested_at > now() - interval '1 day'
      and l.id is distinct from p_exclude
  ),
  ordered as (
    select s.*, lag(s.flagged) over (order by s.at, s.id) as prev_flagged
    from seq s
  )
  select max(o.at) + interval '10 minutes'
  from ordered o
  where o.flagged
    and o.at > now() - interval '10 minutes'
    and (
      o.prev_flagged
      or exists (
        select 1 from seq e
        where e.flagged and e.id <> o.id
          and e.at >= o.at - interval '5 minutes' and e.at <= o.at
      )
    );
$$;
revoke execute on function public.listing_cooldown_until(uuid, uuid) from public, anon, authenticated;

/** Seconds until the signed-in seller can list again; 0 when they can.
    p_exclude leaves one listing out (the one photos are being added to). */
create or replace function public.my_listing_cooldown(p_exclude uuid default null)
returns integer
language sql
security definer set search_path = public
stable
as $$
  select coalesce(
    greatest(0, ceil(extract(epoch from
      public.listing_cooldown_until(auth.uid(), p_exclude) - now())))::integer,
    0);
$$;
revoke execute on function public.my_listing_cooldown(uuid) from public, anon;
grant execute on function public.my_listing_cooldown(uuid) to authenticated;

create or replace function public.enforce_listing_cooldown()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_left integer;
  v_exclude uuid;
begin
  if auth.uid() is null then
    return new;
  end if;
  if tg_table_name = 'listing_images' then
    v_exclude := new.listing_id;
  end if;
  v_left := public.my_listing_cooldown(v_exclude);
  if v_left > 0 then
    raise exception 'You can''t list at the moment. Try again in %.', public.format_wait(v_left)
      using hint = 'listing_cooldown:' || v_left;
  end if;
  return new;
end;
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- END supabase/migrations/0033_cooldown_counts_every_review.sql
-- ──────────────────────────────────────────────────────────────────────────

-- Tell the API (PostgREST) to reload the schema now, so the app sees the
-- new columns and kinds at once instead of failing with "could not find
-- the column … in the schema cache" until its cache refreshes.
notify pgrst, 'reload schema';
