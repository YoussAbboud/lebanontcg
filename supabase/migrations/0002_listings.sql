-- 0002: listings + listing_images (+ enums, status transition enforcement)

create type public.game_type as enum
  ('pokemon', 'magic', 'yugioh', 'onepiece', 'lorcana', 'other');
create type public.condition_type as enum ('NM', 'LP', 'MP', 'HP', 'DMG');
create type public.finish_type as enum
  ('normal', 'holo', 'reverse', 'foil', 'etched', 'other');
create type public.listing_status as enum ('active', 'reserved', 'sold', 'removed');

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  game public.game_type not null,
  set_name text not null default '',
  card_number text not null default '',
  language text not null default 'English',
  condition public.condition_type not null,
  finish public.finish_type not null default 'normal',
  grade_company text,
  grade_value text,
  price numeric(12, 2) not null,
  currency text not null default 'USD',
  quantity integer not null default 1,
  description text not null default '',
  status public.listing_status not null default 'active',
  -- set when the seller reserves specifically for one conversation
  reserved_for_conversation_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint title_length check (char_length(title) between 3 and 120),
  constraint price_positive check (price > 0 and price <= 1000000),
  constraint quantity_range check (quantity between 1 and 999),
  constraint description_length check (char_length(description) <= 2000)
);

create index listings_browse on public.listings (status, created_at desc);
create index listings_seller on public.listings (seller_id, status);
create index listings_game on public.listings (game) where status = 'active';

create table public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  storage_path text not null,
  sort_order integer not null default 0,
  constraint sort_order_range check (sort_order between 0 and 7)
);

create index listing_images_listing on public.listing_images (listing_id, sort_order);

-- updated_at bookkeeping
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger listings_touch
  before update on public.listings
  for each row execute function public.touch_updated_at();

-- Status transitions mirror src/lib/status.ts:
--   active   -> reserved | sold | removed
--   reserved -> active | sold | removed
--   sold     -> (terminal)
--   removed  -> active
create or replace function public.enforce_listing_transitions()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    if not (
      (old.status = 'active'   and new.status in ('reserved', 'sold', 'removed')) or
      (old.status = 'reserved' and new.status in ('active', 'sold', 'removed')) or
      (old.status = 'removed'  and new.status = 'active')
    ) then
      raise exception 'invalid listing status transition: % -> %', old.status, new.status;
    end if;
  end if;
  if new.status <> 'reserved' then
    new.reserved_for_conversation_id = null;
  end if;
  return new;
end;
$$;

create trigger listings_transitions
  before update on public.listings
  for each row execute function public.enforce_listing_transitions();

-- ---------------------------------------------------------------------------
-- RLS
-- Listings: active/reserved/sold rows are publicly readable (sold stays
-- visible so conversations and reviews keep their subject); removed rows
-- are visible only to the seller and to conversation participants.
-- Only the seller mutates their listings.
-- ---------------------------------------------------------------------------
alter table public.listings enable row level security;
alter table public.listing_images enable row level security;

-- NOTE: the SELECT policy for listings lives in 0003_chat.sql — its
-- visibility rule references conversations, which doesn't exist yet.

create policy "sellers insert own listings"
  on public.listings for insert
  with check (seller_id = auth.uid() and status = 'active');

create policy "sellers update own listings"
  on public.listings for update
  using (seller_id = auth.uid())
  with check (seller_id = auth.uid());

create policy "sellers delete own listings"
  on public.listings for delete
  using (seller_id = auth.uid());

-- Images follow their listing's visibility (subquery runs under the
-- caller's RLS on listings).
create policy "images follow listing visibility"
  on public.listing_images for select
  using (exists (select 1 from public.listings l where l.id = listing_id));

create policy "sellers manage own listing images"
  on public.listing_images for insert
  with check (exists (
    select 1 from public.listings l
    where l.id = listing_id and l.seller_id = auth.uid()
  ));

create policy "sellers update own listing images"
  on public.listing_images for update
  using (exists (
    select 1 from public.listings l
    where l.id = listing_id and l.seller_id = auth.uid()
  ));

create policy "sellers delete own listing images"
  on public.listing_images for delete
  using (exists (
    select 1 from public.listings l
    where l.id = listing_id and l.seller_id = auth.uid()
  ));
