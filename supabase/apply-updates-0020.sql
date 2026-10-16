-- ==========================================================================
-- LebanonTCG — UPDATE script: migration 0020 (pre-launch hardening)
--
-- Closes the direct RPC door on the internal entitlement helpers, meters
-- Pre-Grade model calls per user, caps free-text lengths, and keeps the
-- subscription sweep for the scheduler only. Apply after 0019. Run ONCE.
--
-- HOW TO USE: Supabase dashboard → SQL Editor → New query → paste this
-- entire file → Run.
-- ==========================================================================


-- ──────────────────────────────────────────────────────────────────────────
-- BEGIN supabase/migrations/0020_hardening.sql
-- ──────────────────────────────────────────────────────────────────────────
-- 0020: pre-launch hardening.
--
-- 1. The entitlement helpers that take a p_user were reachable by anyone
--    through PostgREST, so anyone could ask whether a given account is
--    subscribed or how many credits it holds. They are internal; only
--    my_entitlements() answers, and only about the caller.
-- 2. can_use_pregrade() loses its p_user parameter for the same reason.
--    The row policy and the endpoint only ever ask about the caller.
-- 3. Pre-Grade model calls are metered per user in the database, not by
--    counting saved reports — a report is saved AFTER the call, so an
--    abandoned wizard cost money and counted nothing.
-- 4. Free-text columns that had no length cap get one. `not valid` so
--    rows already present are left alone; only new writes are checked.
-- 5. expire_subscriptions() is for the scheduler, not clients.

-- ---------------------------------------------------------------------------
-- 1. Internal helpers stay internal
-- ---------------------------------------------------------------------------
-- Security-definer functions keep working when called from other
-- security-definer functions and triggers (those run as the owner); this
-- only closes the direct RPC door.
revoke execute on function public.has_active_subscription(uuid) from public, anon, authenticated;
revoke execute on function public.listing_credits_remaining(uuid) from public, anon, authenticated;
revoke execute on function public.listings_created(uuid) from public, anon, authenticated;
revoke execute on function public.can_create_listing(uuid) from public, anon, authenticated;
revoke execute on function public.expire_subscriptions() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. can_use_pregrade() asks only about the caller
-- ---------------------------------------------------------------------------
-- The policy depends on the function, so it goes first and comes back last.
drop policy "owners insert own reports" on public.pregrade_reports;
drop function public.can_use_pregrade(uuid);

create or replace function public.can_use_pregrade()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select public.is_admin() or public.has_active_subscription(auth.uid());
$$;

create policy "owners insert own reports" on public.pregrade_reports
  for insert with check (user_id = auth.uid() and public.can_use_pregrade());

-- ---------------------------------------------------------------------------
-- 3. Metered Pre-Grade calls
-- ---------------------------------------------------------------------------
create table public.pregrade_calls (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  called_at timestamptz not null default now()
);
create index pregrade_calls_user_recent on public.pregrade_calls (user_id, called_at desc);

alter table public.pregrade_calls enable row level security;
create policy "users read own pregrade calls" on public.pregrade_calls for select
  using (user_id = auth.uid() or public.is_admin());
-- No insert policy: the function below is the only writer.

/** Reserve one Pre-Grade model call for the signed-in user against a
    rolling 24-hour window. Returns how many calls remain AFTER this one,
    or -1 when the window is already full (and then records nothing). The
    endpoint calls this before spending anything, so a call that is never
    saved as a report still counts. */
create or replace function public.consume_pregrade_call(p_limit integer default 10)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_used integer;
  v_limit integer := greatest(1, least(coalesce(p_limit, 10), 200));
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if not public.can_use_pregrade() then
    raise exception 'Pre-Grade is part of a subscription';
  end if;
  -- Serialise per user so two simultaneous calls cannot both squeeze in.
  perform 1 from profiles where id = auth.uid() for update;
  select count(*) into v_used
    from pregrade_calls
    where user_id = auth.uid() and called_at > now() - interval '24 hours';
  if v_used >= v_limit then
    return -1;
  end if;
  insert into pregrade_calls (user_id) values (auth.uid());
  return v_limit - v_used - 1;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Length caps on free text
-- ---------------------------------------------------------------------------
alter table public.subscriptions
  add constraint subscription_note_length check (char_length(note) <= 500) not valid;
alter table public.listing_credit_packs
  add constraint credit_pack_note_length check (char_length(note) <= 500) not valid;
alter table public.reports
  add constraint report_detail_length check (char_length(detail) <= 2000) not valid;
alter table public.admin_actions
  add constraint admin_reason_length check (char_length(reason) <= 1000) not valid;

-- ──────────────────────────────────────────────────────────────────────────
-- END supabase/migrations/0020_hardening.sql
-- ──────────────────────────────────────────────────────────────────────────
