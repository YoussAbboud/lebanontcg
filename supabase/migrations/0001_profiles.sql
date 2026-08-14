-- 0001: profiles + auth bootstrap
-- Every table ships with its RLS in the same migration.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user. username is claimed once and immutable.
-- rating_avg / rating_count are denormalized from reviews (trigger in 0005).
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text,
  display_name text not null default '',
  avatar_url text,
  bio text not null default '',
  rating_avg numeric(3, 2),
  rating_count integer not null default 0,
  created_at timestamptz not null default now(),
  constraint username_format check (
    username is null or username ~ '^[a-z0-9_]{3,20}$'
  ),
  constraint bio_length check (char_length(bio) <= 400),
  constraint display_name_length check (char_length(display_name) <= 50)
);

create unique index profiles_username_unique on public.profiles (lower(username))
  where username is not null;

-- Create a profile row automatically for each new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(split_part(new.email, '@', 1), 'collector'));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Username is immutable once set.
create or replace function public.enforce_username_immutable()
returns trigger
language plpgsql
as $$
begin
  if old.username is not null and new.username is distinct from old.username then
    raise exception 'username cannot be changed once set';
  end if;
  -- Rating fields are system-maintained (reviews trigger runs as definer).
  if new.rating_avg is distinct from old.rating_avg
     or new.rating_count is distinct from old.rating_count then
    if current_setting('app.allow_rating_write', true) is distinct from '1' then
      raise exception 'rating fields are system-maintained';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_username_immutable
  before update on public.profiles
  for each row execute function public.enforce_username_immutable();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy "profiles are publicly readable"
  on public.profiles for select
  using (true);

create policy "users update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- No insert/delete policies: rows are created by the auth trigger and die
-- with the auth user (cascade).
