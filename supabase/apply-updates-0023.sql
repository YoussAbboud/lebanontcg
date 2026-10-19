-- ==========================================================================
-- LebanonTCG — UPDATE script: migration 0023 (listing_likes view)
--
-- Clears the "view defined with SECURITY DEFINER" advisory. Like counts
-- move to a public, trigger-maintained table and listing_likes becomes a
-- security_invoker view with the same shape. Apply after 0022. Run ONCE.
--
-- HOW TO USE: Supabase dashboard → SQL Editor → New query → paste this
-- entire file → Run.
-- ==========================================================================


-- ──────────────────────────────────────────────────────────────────────────
-- BEGIN supabase/migrations/0023_like_counts.sql
-- ──────────────────────────────────────────────────────────────────────────
-- 0023: listing_likes without SECURITY DEFINER.
--
-- 0008 made listing_likes an owner-rights view on purpose: favorites RLS
-- hides who liked what, and the view leaked only the aggregate. Supabase's
-- advisor flags every such view, and rightly — a view that runs as its
-- creator is one careless column away from leaking the table behind it.
--
-- The aggregate now lives in its own table, kept current by a trigger on
-- favorites. The table is public to read (it holds nothing but a count),
-- nobody can write it directly, and listing_likes becomes an ordinary
-- security_invoker view over it with the same shape, so the client does
-- not change.

create table public.listing_like_counts (
  listing_id uuid primary key references public.listings (id) on delete cascade,
  likes integer not null default 0 check (likes >= 0)
);

alter table public.listing_like_counts enable row level security;
create policy "like counts are public"
  on public.listing_like_counts for select
  using (true);
-- No insert/update/delete policies: the trigger below is the only writer.

insert into public.listing_like_counts (listing_id, likes)
  select listing_id, count(*) from public.favorites group by listing_id
  on conflict (listing_id) do update set likes = excluded.likes;

create or replace function public.bump_like_count()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into listing_like_counts (listing_id, likes)
      values (new.listing_id, 1)
      on conflict (listing_id) do update set likes = listing_like_counts.likes + 1;
    return new;
  else
    update listing_like_counts
      set likes = greatest(0, likes - 1)
      where listing_id = old.listing_id;
    return old;
  end if;
end;
$$;

create trigger favorites_like_count
  after insert or delete on public.favorites
  for each row execute function public.bump_like_count();

drop view public.listing_likes;
create view public.listing_likes
  with (security_invoker = true)
as
  select listing_id, likes
  from public.listing_like_counts
  where likes > 0;

grant select on public.listing_likes to anon, authenticated;

-- ──────────────────────────────────────────────────────────────────────────
-- END supabase/migrations/0023_like_counts.sql
-- ──────────────────────────────────────────────────────────────────────────
