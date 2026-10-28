-- ==========================================================================
-- LebanonTCG — UPDATE script: migration 0032 (suspension lock-out and
-- listing cooldown)
--
-- A suspended account can no longer do anything but read and contact
-- support, effective immediately; two flagged listings in a row (or within
-- five minutes) pause listing for ten minutes. Apply after 0031. Run ONCE.
--
-- HOW TO USE: Supabase dashboard → SQL Editor → New query → paste this
-- entire file → Run.
-- ==========================================================================


-- ──────────────────────────────────────────────────────────────────────────
-- BEGIN supabase/migrations/0032_suspension_and_cooldown.sql
-- ──────────────────────────────────────────────────────────────────────────
-- 0032: a suspended account can do nothing; repeated junk listings cool down.
--
-- 1. SUSPENSION. Until now a suspension stopped new listings, messages
--    and bids (0016). It now stops every action: messaging (offers,
--    phone numbers and locations included), opening chats, liking,
--    reporting, reviewing, blocking, editing or removing listings and
--    photos, auctions, no-show reports, Pre-Grade, and editing the
--    profile. One trigger, on every table a member writes to, refuses any
--    write made by a suspended account, so no path is forgotten.
--
--    Still allowed, on purpose: reading, marking notifications read and
--    messages read, and support tickets — that is how a suspended account
--    appeals, and the Terms promise it.
--
--    It takes effect at once. The database refuses the next action the
--    moment a moderator suspends; profiles joins the realtime feed so the
--    open app hears about it and locks itself without a reload; and the
--    member is notified when a suspension starts and when it is lifted.
--
-- 2. LISTING COOLDOWN. When the photo check (0031) flags two of a
--    seller's listings one after the other, or two within five minutes,
--    the seller can't list (or add photos) for ten minutes from the second
--    flag. "Flagged" means the check said "not a card" or "unsure"; a
--    check that failed to run doesn't count, and nor does a listing a
--    moderator has since approved.

-- ---------------------------------------------------------------------------
-- 1. Suspension
-- ---------------------------------------------------------------------------

create or replace function public.forbid_suspended_actor()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is not null and public.is_suspended(auth.uid()) then
    raise exception 'Your account is suspended. You can still contact support.'
      using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'listings', 'listing_images', 'conversations', 'favorites', 'reviews',
    'reports', 'blocks', 'auctions', 'auction_no_shows', 'listing_screens',
    'pregrade_reports', 'pregrade_captures', 'pregrade_outcomes', 'pregrade_calls',
    'subscriptions', 'listing_credit_packs'
  ] loop
    execute format(
      'create trigger %I before insert or update or delete on public.%I
         for each row execute function public.forbid_suspended_actor()',
      t || '_not_suspended', t);
  end loop;
end
$$;

-- Messages: sending anything, and answering an offer. Marking a message
-- read stays allowed.
create trigger messages_not_suspended
  before insert or update of offer_status or delete on public.messages
  for each row execute function public.forbid_suspended_actor();

-- Profiles: a member editing their own. Moderators lift suspensions and
-- other people's reviews roll up ratings as themselves, so neither is
-- caught.
create trigger profiles_not_suspended
  before update on public.profiles
  for each row execute function public.forbid_suspended_actor();

do $$
begin
  alter publication supabase_realtime add table public.profiles;
exception when others then
  null;
end
$$;

-- Suspending and lifting now tell the member, whoever does it.
create or replace function public.admin_set_suspended(
  p_user uuid,
  p_suspended boolean,
  p_reason text default ''
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_actor uuid := public.require_admin();
  v_was timestamptz;
begin
  if p_user = v_actor then
    raise exception 'you cannot suspend your own account';
  end if;
  if p_suspended and (p_reason is null or length(trim(p_reason)) < 3) then
    raise exception 'a suspension reason is required';
  end if;
  if p_suspended and public.is_admin(p_user) then
    raise exception 'demote this admin before suspending the account';
  end if;

  select suspended_at into v_was from profiles where id = p_user;
  if not found then
    raise exception 'user not found';
  end if;

  perform set_config('app.admin_action', '1', true);
  update profiles set
    suspended_at = case when p_suspended then now() else null end,
    suspended_reason = case when p_suspended then trim(p_reason) else null end
  where id = p_user;

  perform public.log_admin_action(
    v_actor,
    case when p_suspended then 'user_suspend' else 'user_unsuspend' end::public.admin_action_kind,
    'user', p_user::text, p_reason);

  if p_suspended then
    perform public.notify(p_user, 'moderation', 'Your account is suspended',
      trim(p_reason) || '. You can still read, and contact support to appeal.',
      '/support', null, null);
  elsif v_was is not null then
    perform public.notify(p_user, 'moderation', 'Your suspension was lifted',
      'Your account works normally again.', '/settings', null, null);
  end if;
end;
$$;

-- Same as 0025, minus its own "suspended" notification: the suspension
-- now sends it.
create or replace function public.admin_warn_user(
  p_user uuid,
  p_reason text,
  p_listing uuid default null
)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_actor uuid := public.require_admin();
  v_title text;
  v_count integer;
  v_id uuid;
begin
  if p_user = v_actor then
    raise exception 'you cannot warn your own account';
  end if;
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'a reason is required for a warning';
  end if;
  if public.is_admin(p_user) then
    raise exception 'demote this admin before warning the account';
  end if;
  if not exists (select 1 from profiles where id = p_user) then
    raise exception 'user not found';
  end if;
  if p_listing is not null then
    select title into v_title from listings where id = p_listing;
  end if;

  insert into user_warnings (user_id, issued_by, listing_id, listing_title, reason)
    values (p_user, v_actor, p_listing, v_title, trim(p_reason))
    returning id into v_id;
  v_count := public.warning_count(p_user);

  perform public.log_admin_action(v_actor, 'user_warn', 'user', p_user::text, p_reason,
    jsonb_build_object('warning_id', v_id, 'listing_id', p_listing, 'warning_count', v_count));

  perform public.notify(p_user, 'moderation',
    'Warning ' || least(v_count, public.warning_limit()) || ' of ' || public.warning_limit()
      || case when v_title is not null then ' — ' || v_title else '' end,
    trim(p_reason) || case when v_count >= public.warning_limit() then ''
      else ' At ' || public.warning_limit() || ' warnings the account is suspended.' end,
    '/settings', null, null);

  if v_count >= public.warning_limit()
     and not exists (select 1 from profiles where id = p_user and suspended_at is not null) then
    perform public.admin_set_suspended(p_user, true,
      public.warning_limit() || ' warnings — ' || trim(p_reason));
  end if;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Listing cooldown
-- ---------------------------------------------------------------------------

-- When the seller may list again, or null when they may now.
create or replace function public.listing_cooldown_until(p_user uuid)
returns timestamptz
language sql
security definer set search_path = public
stable
as $$
  with done as (
    select
      s.listing_id,
      s.finished_at,
      (s.verdict in ('not_card', 'unsure')
        and not (l.review_state = 'approved' and l.reviewed_by is not null)) as flagged
    from listing_screens s
    join listings l on l.id = s.listing_id
    where s.seller_id = p_user
      and s.verdict in ('card', 'not_card', 'unsure')
      and s.finished_at > now() - interval '1 day'
  ),
  ordered as (
    select d.*,
      lag(d.listing_id) over (order by d.finished_at) as prev_listing,
      lag(d.flagged) over (order by d.finished_at) as prev_flagged
    from done d
  )
  select max(o.finished_at) + interval '10 minutes'
  from ordered o
  where o.flagged
    and o.finished_at > now() - interval '10 minutes'
    and (
      (o.prev_flagged and o.prev_listing <> o.listing_id)
      or exists (
        select 1 from done e
        where e.flagged
          and e.listing_id <> o.listing_id
          and e.finished_at >= o.finished_at - interval '5 minutes'
          and e.finished_at < o.finished_at
      )
    );
$$;
revoke execute on function public.listing_cooldown_until(uuid) from public, anon, authenticated;

/** Seconds until the signed-in seller can list again; 0 when they can. */
create or replace function public.my_listing_cooldown()
returns integer
language sql
security definer set search_path = public
stable
as $$
  select coalesce(
    greatest(0, ceil(extract(epoch from public.listing_cooldown_until(auth.uid()) - now())))::integer,
    0);
$$;
revoke execute on function public.my_listing_cooldown() from public, anon;
grant execute on function public.my_listing_cooldown() to authenticated;

create or replace function public.format_wait(p_seconds integer)
returns text
language sql
immutable
as $$
  select case
    when p_seconds >= 60 then
      (p_seconds / 60) || ' minute' || case when p_seconds / 60 = 1 then '' else 's' end
      || case when p_seconds % 60 > 0
           then ' ' || (p_seconds % 60) || ' second' || case when p_seconds % 60 = 1 then '' else 's' end
           else '' end
    else p_seconds || ' second' || case when p_seconds = 1 then '' else 's' end
  end;
$$;

create or replace function public.enforce_listing_cooldown()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_left integer;
begin
  if auth.uid() is null then
    return new;
  end if;
  v_left := public.my_listing_cooldown();
  if v_left > 0 then
    raise exception 'You can''t list at the moment. Try again in %.', public.format_wait(v_left)
      using hint = 'listing_cooldown:' || v_left;
  end if;
  return new;
end;
$$;

create trigger listings_cooldown
  before insert on public.listings
  for each row execute function public.enforce_listing_cooldown();

create trigger listing_images_cooldown
  before insert on public.listing_images
  for each row execute function public.enforce_listing_cooldown();

-- ──────────────────────────────────────────────────────────────────────────
-- END supabase/migrations/0032_suspension_and_cooldown.sql
-- ──────────────────────────────────────────────────────────────────────────

-- Tell the API (PostgREST) to reload the schema now, so the app sees the
-- new columns and kinds at once instead of failing with "could not find
-- the column … in the schema cache" until its cache refreshes.
notify pgrst, 'reload schema';
