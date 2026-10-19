-- 0025: warnings.
--
-- A moderator can warn an account — usually because a listing broke
-- the rules and was removed — as many times as it takes. The third
-- ACTIVE warning suspends the account automatically, through the same
-- admin_set_suspended path a manual suspension uses, so the audit log
-- and every "suspended accounts cannot post" rule apply unchanged.
-- Lifting the suspension does not erase warnings: a moderator who means
-- to wipe the slate revokes them, one by one, with a reason. The person
-- sees their own warnings (Settings → Account standing) and is told
-- about each one as it lands.

alter type public.admin_action_kind add value if not exists 'user_warn';
alter type public.admin_action_kind add value if not exists 'warning_revoke';

create table public.user_warnings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  issued_by uuid references public.profiles (id) on delete set null,
  /** The listing it concerns, if any. The title is copied so the
      warning still reads sensibly after the listing is deleted. */
  listing_id uuid references public.listings (id) on delete set null,
  listing_title text,
  reason text not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id) on delete set null,
  revoke_reason text,
  constraint warning_reason_length check (char_length(reason) between 3 and 1000),
  constraint revoke_reason_length check (revoke_reason is null or char_length(revoke_reason) <= 1000)
);

create index user_warnings_user on public.user_warnings (user_id, created_at desc);
create index user_warnings_active on public.user_warnings (user_id) where revoked_at is null;

alter table public.user_warnings enable row level security;

create policy "users read own warnings"
  on public.user_warnings for select
  using (user_id = auth.uid() or public.is_admin());
-- No write policies: the RPCs below are the only door.

/** Warnings that still count against an account. */
create or replace function public.warning_count(p_user uuid)
returns integer
language sql
stable
security definer set search_path = public
as $$
  select count(*)::integer from user_warnings
  where user_id = p_user and revoked_at is null;
$$;
revoke execute on function public.warning_count(uuid) from public, anon, authenticated;

/** How many active warnings it takes to suspend an account. */
create or replace function public.warning_limit()
returns integer language sql immutable as $$ select 3 $$;

/** Issue a warning. Returns the active count afterwards; at the limit
    the account is suspended on the spot. */
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
    perform public.notify(p_user, 'moderation',
      'Your account is suspended',
      'It reached ' || public.warning_limit() || ' warnings. You can still read and message about existing deals; a moderator can lift it.',
      '/settings', null, null);
  end if;
  return v_count;
end;
$$;

/** Withdraw a warning. The account is not unsuspended by this — that
    is a separate, deliberate action. */
create or replace function public.admin_revoke_warning(p_warning uuid, p_reason text default '')
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_actor uuid := public.require_admin();
  v_user uuid;
begin
  update user_warnings
    set revoked_at = now(), revoked_by = v_actor, revoke_reason = nullif(trim(p_reason), '')
    where id = p_warning and revoked_at is null
    returning user_id into v_user;
  if v_user is null then
    raise exception 'no active warning with that id';
  end if;
  perform public.log_admin_action(v_actor, 'warning_revoke', 'user', v_user::text, p_reason,
    jsonb_build_object('warning_id', p_warning));
  perform public.notify(v_user, 'moderation', 'A warning was withdrawn',
    coalesce(nullif(trim(p_reason), ''), ''), '/settings', null, null);
end;
$$;

-- admin_users gains the active warning count.
create or replace function public.admin_users(p_query text default '', p_limit integer default 50)
returns jsonb
language plpgsql
security definer set search_path = public
stable
as $$
declare
  v_q text := '%' || lower(coalesce(trim(p_query), '')) || '%';
  v_out jsonb;
begin
  perform public.require_admin();
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_out
  from (
    select
      p.id,
      p.username,
      p.display_name,
      p.avatar_url,
      p.bio,
      p.rating_avg,
      p.rating_count,
      p.is_admin,
      p.suspended_at,
      p.suspended_reason,
      p.created_at,
      (select count(*) from listings l where l.seller_id = p.id) as listing_count,
      (select count(*) from listings l where l.seller_id = p.id and l.status = 'active') as active_count,
      (select count(*) from listings l where l.seller_id = p.id and l.status = 'sold') as sold_count,
      (select count(*) from reviews r where r.reviewee_id = p.id) as review_count,
      (
        select count(*) from reports r
        where (r.target_type = 'user' and r.target_id = p.id::text)
           or (r.target_type = 'listing' and r.target_id in
                 (select l.id::text from listings l where l.seller_id = p.id))
           or (r.target_type = 'message' and r.target_id in
                 (select m.id::text from messages m where m.sender_id = p.id))
      ) as reports_against,
      (
        select count(*) from auction_no_shows n
        where n.reported_id = p.id and n.role = 'winner'
          and n.created_at > now() - interval '90 days'
      ) as no_show_count,
      public.is_bid_banned(p.id) as bid_banned,
      public.warning_count(p.id) as warning_count
    from profiles p
    where p_query is null or trim(p_query) = ''
       or lower(coalesce(p.username, '')) like v_q
       or lower(p.display_name) like v_q
       or p.id::text = trim(p_query)
    order by p.created_at desc
    limit greatest(1, least(p_limit, 200))
  ) t;
  return v_out;
end;
$$;
