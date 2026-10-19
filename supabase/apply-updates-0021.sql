-- ==========================================================================
-- LebanonTCG — UPDATE script: migration 0021 (listing cap switched off)
--
-- Listings are unlimited for everyone until payments exist. The quota
-- machinery stays in place behind listing_quota_enabled(); flipping it
-- back on later is a one-line migration. Pre-Grade stays subscriber-only.
-- Apply after 0020. Run ONCE.
--
-- HOW TO USE: Supabase dashboard → SQL Editor → New query → paste this
-- entire file → Run.
-- ==========================================================================


-- ──────────────────────────────────────────────────────────────────────────
-- BEGIN supabase/migrations/0021_quota_off.sql
-- ──────────────────────────────────────────────────────────────────────────
-- 0021: the listing quota is switched OFF until payments exist.
--
-- Nothing is sold through the app yet, so walling sellers at three
-- listings would only cost us listings. The quota machinery from 0019
-- stays exactly as it is — the trigger, the counters, the plans — behind
-- one switch. Turning it back on later is a one-line migration:
--
--   create or replace function public.listing_quota_enabled()
--   returns boolean language sql immutable as $$ select true $$;
--
-- Listings created meanwhile ARE still counted (listing_counters), so
-- when the day comes we decide on purpose — grandfather, grant credits,
-- or let the allowance stand — rather than by accident.
--
-- The Pre-Grade gate is NOT part of this switch: each estimate spends a
-- vision-model call, so it stays with subscriptions and admins.

create or replace function public.listing_quota_enabled()
returns boolean
language sql
immutable
as $$ select false $$;

create or replace function public.can_create_listing(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select not public.listing_quota_enabled()
      or public.is_admin(p_user)
      or public.has_active_subscription(p_user)
      or public.listings_created(p_user) < public.free_listing_allowance()
      or public.listing_credits_remaining(p_user) > 0;
$$;
-- Keep the 0020 lockdown: internal helper, not an RPC.
revoke execute on function public.can_create_listing(uuid) from public, anon, authenticated;

create or replace function public.enforce_listing_quota()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_pack uuid;
  v_created integer;
begin
  -- Seed the tally from whatever the account already has, then lock it:
  -- two listings posted at once must not both see the same count.
  insert into listing_counters (user_id, created)
    values (new.seller_id,
            (select count(*) from listings where seller_id = new.seller_id))
    on conflict (user_id) do nothing;
  select created into v_created
    from listing_counters where user_id = new.seller_id for update;

  if public.listing_quota_enabled()
     and not (public.is_admin(new.seller_id)
              or public.has_active_subscription(new.seller_id))
     and v_created >= public.free_listing_allowance() then
    -- Spend the oldest pack with room left.
    select id into v_pack
      from listing_credit_packs
      where user_id = new.seller_id and status = 'active' and used < credits
      order by created_at asc
      limit 1
      for update;
    if v_pack is null then
      raise exception 'listing limit reached: your % free listings are used — buy listings or subscribe',
        public.free_listing_allowance();
    end if;
    update listing_credit_packs set used = used + 1 where id = v_pack;
  end if;

  update listing_counters set created = created + 1 where user_id = new.seller_id;
  return new;
end;
$$;

/** Everything the UI needs to explain where someone stands — now
    including whether there is a wall at all. */
create or replace function public.my_entitlements()
returns jsonb
language sql
stable
security definer set search_path = public
as $$
  select jsonb_build_object(
    'quota_enabled', public.listing_quota_enabled(),
    'is_admin', public.is_admin(),
    'subscribed', public.has_active_subscription(),
    'tier', (select s.tier from subscriptions s
             where s.user_id = auth.uid() and s.status = 'active'
             order by s.created_at desc limit 1),
    'period_end', (select s.period_end from subscriptions s
                   where s.user_id = auth.uid() and s.status = 'active'
                   order by s.created_at desc limit 1),
    'free_allowance', public.free_listing_allowance(),
    'listings_created', public.listings_created(),
    'credits_remaining', public.listing_credits_remaining(),
    'can_create_listing', public.can_create_listing(),
    'can_use_pregrade', public.can_use_pregrade(),
    'pending_requests', (select count(*) from subscriptions s
                         where s.user_id = auth.uid() and s.status = 'pending')
                      + (select count(*) from listing_credit_packs p
                         where p.user_id = auth.uid() and p.status = 'pending')
  );
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- END supabase/migrations/0021_quota_off.sql
-- ──────────────────────────────────────────────────────────────────────────
