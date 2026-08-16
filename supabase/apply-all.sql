-- ==========================================================================
-- LebanonTCG — one-paste setup
-- Generated from supabase/migrations/0001–0010 (do not edit; edit the
-- individual migration files and regenerate instead).
--
-- HOW TO USE: Supabase dashboard → SQL Editor → New query → paste this
-- entire file → Run. Run supabase/seed.sql afterwards if you want demo data.
-- Run this ONCE on a FRESH project only.
-- ==========================================================================

-- ──────────────────────────────────────────────────────────────────────────
-- BEGIN supabase/migrations/0001_profiles.sql
-- ──────────────────────────────────────────────────────────────────────────
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

-- ──────────────────────────────────────────────────────────────────────────
-- BEGIN supabase/migrations/0002_listings.sql
-- ──────────────────────────────────────────────────────────────────────────
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

-- ──────────────────────────────────────────────────────────────────────────
-- BEGIN supabase/migrations/0003_chat.sql
-- ──────────────────────────────────────────────────────────────────────────
-- 0003: conversations + messages + blocks + system messages on status change
-- (blocks live here because message policies depend on them)

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint no_self_block check (blocker_id <> blocked_id)
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  unique (listing_id, buyer_id),
  constraint buyer_is_not_seller check (buyer_id <> seller_id)
);

create index conversations_buyer on public.conversations (buyer_id, last_message_at desc);
create index conversations_seller on public.conversations (seller_id, last_message_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  -- null sender = system message
  sender_id uuid references public.profiles (id) on delete set null,
  kind text not null default 'user' check (kind in ('user', 'system')),
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint body_length check (char_length(body) between 1 and 2000),
  constraint system_has_no_sender check (
    (kind = 'system' and sender_id is null) or (kind = 'user' and sender_id is not null)
  )
);

create index messages_conversation on public.messages (conversation_id, created_at);
create index messages_unread on public.messages (conversation_id)
  where read_at is null and kind = 'user';

-- Now that conversations exists, wire the deferred FK on listings.
alter table public.listings
  add constraint listings_reserved_for_fk
  foreign key (reserved_for_conversation_id)
  references public.conversations (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Helpers (security definer so RLS policies can check blocks both ways
-- without exposing who-blocked-whom to the blocked party)
-- ---------------------------------------------------------------------------
create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from blocks
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  );
$$;

create or replace function public.is_conversation_participant(c_id uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from conversations c
    where c.id = c_id and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
  );
$$;

-- Atomic buyer-side conversation open: validates listing state and blocks,
-- returns the existing conversation if one is already open.
create or replace function public.open_conversation(p_listing_id uuid)
returns public.conversations
language plpgsql
security definer set search_path = public
as $$
declare
  l record;
  conv public.conversations;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  select id, seller_id, status into l from listings where id = p_listing_id;
  if not found then
    raise exception 'listing not found';
  end if;
  if l.seller_id = auth.uid() then
    raise exception 'you cannot message yourself';
  end if;
  if l.status in ('removed') then
    raise exception 'this listing is no longer available';
  end if;
  if public.is_blocked_between(auth.uid(), l.seller_id) then
    raise exception 'you cannot message this seller';
  end if;

  select * into conv from conversations
    where listing_id = p_listing_id and buyer_id = auth.uid();
  if found then
    return conv;
  end if;

  insert into conversations (listing_id, buyer_id, seller_id)
    values (p_listing_id, auth.uid(), l.seller_id)
    returning * into conv;
  return conv;
end;
$$;

-- Keep conversations.last_message_at fresh.
create or replace function public.bump_conversation()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update conversations set last_message_at = new.created_at
    where id = new.conversation_id;
  return new;
end;
$$;

create trigger messages_bump_conversation
  after insert on public.messages
  for each row execute function public.bump_conversation();

-- System message into every conversation when a listing's status changes,
-- mirroring statusChangeSystemMessage() in src/lib/status.ts.
create or replace function public.announce_listing_status()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  conv record;
  msg text;
begin
  if new.status is distinct from old.status then
    for conv in select id from conversations where listing_id = new.id loop
      msg := case new.status
        when 'reserved' then
          case when new.reserved_for_conversation_id = conv.id
            then 'Seller reserved this listing for this conversation.'
            else 'Seller marked this listing as reserved.'
          end
        when 'sold' then 'Seller marked this listing as sold.'
        when 'active' then 'Seller relisted this card — it is available again.'
        when 'removed' then 'Seller removed this listing.'
      end;
      insert into messages (conversation_id, sender_id, kind, body)
        values (conv.id, null, 'system', msg);
    end loop;
  end if;
  return new;
end;
$$;

create trigger listings_announce_status
  after update on public.listings
  for each row execute function public.announce_listing_status();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

-- Deferred from 0002: listings visibility depends on conversations.
-- Active/reserved/sold rows are publicly readable (sold stays visible so
-- conversations and reviews keep their subject); removed rows are visible
-- only to the seller and to conversation participants.
create or replace function public.is_conversation_party_for_listing(l_id uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from conversations c
    where c.listing_id = l_id
      and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
  );
$$;

create policy "listings readable unless removed"
  on public.listings for select
  using (
    status <> 'removed'
    or seller_id = auth.uid()
    or public.is_conversation_party_for_listing(id)
  );

alter table public.blocks enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

create policy "users see own blocks"
  on public.blocks for select
  using (blocker_id = auth.uid());

create policy "users create own blocks"
  on public.blocks for insert
  with check (blocker_id = auth.uid());

create policy "users remove own blocks"
  on public.blocks for delete
  using (blocker_id = auth.uid());

create policy "participants read conversations"
  on public.conversations for select
  using (buyer_id = auth.uid() or seller_id = auth.uid());

-- Conversation creation goes through open_conversation() (security
-- definer), which performs listing/block validation atomically. A direct
-- insert path is still allowed for the buyer with equivalent checks.
create policy "buyers open conversations"
  on public.conversations for insert
  with check (
    buyer_id = auth.uid()
    and buyer_id <> seller_id
    and exists (
      select 1 from public.listings l
      where l.id = listing_id
        and l.seller_id = conversations.seller_id
        and l.status <> 'removed'
    )
    and not public.is_blocked_between(buyer_id, seller_id)
  );

create policy "participants read messages"
  on public.messages for select
  using (public.is_conversation_participant(conversation_id));

create policy "participants send messages"
  on public.messages for insert
  with check (
    kind = 'user'
    and sender_id = auth.uid()
    and public.is_conversation_participant(conversation_id)
    and not exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and public.is_blocked_between(c.buyer_id, c.seller_id)
    )
  );

-- Read receipts: recipients may flip read_at on messages sent to them.
-- Column-level grant keeps body/sender immutable even under this policy.
create policy "recipients mark messages read"
  on public.messages for update
  using (
    public.is_conversation_participant(conversation_id)
    and (sender_id is distinct from auth.uid())
  )
  with check (
    public.is_conversation_participant(conversation_id)
  );

revoke update on public.messages from authenticated;
grant update (read_at) on public.messages to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: chat + live listing status changes
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.listings;
alter publication supabase_realtime add table public.conversations;

-- ──────────────────────────────────────────────────────────────────────────
-- BEGIN supabase/migrations/0004_favorites.sql
-- ──────────────────────────────────────────────────────────────────────────
-- 0004: favorites

create table public.favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create index favorites_listing on public.favorites (listing_id);

alter table public.favorites enable row level security;

create policy "users read own favorites"
  on public.favorites for select
  using (user_id = auth.uid());

create policy "users add own favorites"
  on public.favorites for insert
  with check (user_id = auth.uid());

create policy "users remove own favorites"
  on public.favorites for delete
  using (user_id = auth.uid());

-- ──────────────────────────────────────────────────────────────────────────
-- BEGIN supabase/migrations/0005_reviews.sql
-- ──────────────────────────────────────────────────────────────────────────
-- 0005: reviews (post-sale, one per party per conversation) + rating rollup

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete cascade,
  reviewee_id uuid not null references public.profiles (id) on delete cascade,
  rating integer not null,
  body text not null default '',
  created_at timestamptz not null default now(),
  unique (conversation_id, reviewer_id),
  constraint rating_range check (rating between 1 and 5),
  constraint body_max check (char_length(body) <= 500),
  constraint no_self_review check (reviewer_id <> reviewee_id)
);

create index reviews_reviewee on public.reviews (reviewee_id, created_at desc);

-- Denormalize onto profiles for cheap card/profile reads.
create or replace function public.rollup_profile_rating()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform set_config('app.allow_rating_write', '1', true);
  update profiles p set
    rating_avg = sub.avg_rating,
    rating_count = sub.n
  from (
    select reviewee_id, round(avg(rating)::numeric, 2) as avg_rating, count(*) as n
    from reviews where reviewee_id = new.reviewee_id
    group by reviewee_id
  ) sub
  where p.id = sub.reviewee_id;
  return new;
end;
$$;

create trigger reviews_rollup
  after insert on public.reviews
  for each row execute function public.rollup_profile_rating();

alter table public.reviews enable row level security;

create policy "reviews are publicly readable"
  on public.reviews for select
  using (true);

-- Insert allowed only when: reviewer is a participant of the conversation,
-- the listing is sold, and the reviewee is the other participant.
create policy "participants review sold trades"
  on public.reviews for insert
  with check (
    reviewer_id = auth.uid()
    and exists (
      select 1
      from public.conversations c
      join public.listings l on l.id = c.listing_id
      where c.id = conversation_id
        and l.id = listing_id
        and l.status = 'sold'
        and (
          (c.buyer_id = auth.uid() and c.seller_id = reviewee_id) or
          (c.seller_id = auth.uid() and c.buyer_id = reviewee_id)
        )
    )
  );

-- ──────────────────────────────────────────────────────────────────────────
-- BEGIN supabase/migrations/0006_reports.sql
-- ──────────────────────────────────────────────────────────────────────────
-- 0006: reports (moderation queue; write-only for users)

create type public.report_target as enum ('listing', 'user', 'message');
create type public.report_reason as enum
  ('scam', 'counterfeit', 'inappropriate', 'spam', 'harassment', 'other');

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type public.report_target not null,
  target_id text not null,
  reason public.report_reason not null,
  detail text not null default '',
  created_at timestamptz not null default now(),
  constraint detail_max check (char_length(detail) <= 1000)
);

create index reports_target on public.reports (target_type, target_id);

alter table public.reports enable row level security;

-- Users can file reports but not browse the queue (moderators use the
-- service role / dashboard).
create policy "users file reports"
  on public.reports for insert
  with check (reporter_id = auth.uid());

-- ──────────────────────────────────────────────────────────────────────────
-- BEGIN supabase/migrations/0007_storage.sql
-- ──────────────────────────────────────────────────────────────────────────
-- 0007: storage bucket for listing photos + avatars
-- Public read; writes only inside the caller's own {uid}/... folder.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listing-images',
  'listing-images',
  true,
  5242880, -- 5 MB (images are client-compressed to ~1600px JPEG anyway)
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "listing images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'listing-images');

create policy "users upload into own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'listing-images'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users update own objects"
  on storage.objects for update
  using (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users delete own objects"
  on storage.objects for delete
  using (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ──────────────────────────────────────────────────────────────────────────
-- BEGIN supabase/migrations/0008_offers_likes.sql
-- ──────────────────────────────────────────────────────────────────────────
-- 0008: offers in chat + public like counts
-- (design round R2: offer bubbles with accept/decline, ♡ counts on cards)

-- ---------------------------------------------------------------------------
-- Offers are messages with kind='offer', an amount, and a negotiation state
-- the RECIPIENT mutates (proposed -> accepted | declined).
-- ---------------------------------------------------------------------------
alter table public.messages drop constraint system_has_no_sender;
alter table public.messages drop constraint messages_kind_check;

alter table public.messages
  add column amount numeric(12, 2),
  add column offer_status text;

alter table public.messages
  add constraint messages_kind_check check (kind in ('user', 'system', 'offer')),
  add constraint system_has_no_sender check (
    (kind = 'system' and sender_id is null) or (kind <> 'system' and sender_id is not null)
  ),
  add constraint offer_shape check (
    (kind = 'offer' and amount is not null and amount > 0
       and offer_status in ('proposed', 'accepted', 'declined'))
    or (kind <> 'offer' and amount is null and offer_status is null)
  );

-- Participants may insert offers exactly like user messages.
drop policy "participants send messages" on public.messages;
create policy "participants send messages"
  on public.messages for insert
  with check (
    kind in ('user', 'offer')
    and sender_id = auth.uid()
    and (kind <> 'offer' or offer_status = 'proposed')
    and public.is_conversation_participant(conversation_id)
    and not exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and public.is_blocked_between(c.buyer_id, c.seller_id)
    )
  );

-- The existing "recipients mark messages read" UPDATE policy already limits
-- updates to participants who are NOT the sender; add the offer_status
-- column to the recipient's column grant.
grant update (offer_status) on public.messages to authenticated;

-- Enforce the offer state machine + system message on acceptance.
create or replace function public.enforce_offer_updates()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.offer_status is distinct from old.offer_status then
    if old.kind <> 'offer' then
      raise exception 'only offers have an offer status';
    end if;
    if old.offer_status <> 'proposed'
       or new.offer_status not in ('accepted', 'declined') then
      raise exception 'invalid offer transition: % -> %', old.offer_status, new.offer_status;
    end if;
    if new.offer_status = 'accepted' then
      insert into messages (conversation_id, sender_id, kind, body)
      values (
        old.conversation_id, null, 'system',
        'Offer accepted. Arrange payment and delivery between yourselves — LebanonTCG is not involved in the transaction.'
      );
    end if;
  end if;
  return new;
end;
$$;

create trigger messages_offer_updates
  before update on public.messages
  for each row execute function public.enforce_offer_updates();

-- ---------------------------------------------------------------------------
-- Public like counts. favorites RLS hides who liked what; this view exposes
-- only the aggregate (owner-rights view, so it bypasses favorites RLS).
-- ---------------------------------------------------------------------------
create view public.listing_likes as
  select listing_id, count(*)::integer as likes
  from public.favorites
  group by listing_id;

grant select on public.listing_likes to anon, authenticated;

-- ──────────────────────────────────────────────────────────────────────────
-- BEGIN supabase/migrations/0009_profile_selfheal.sql
-- ──────────────────────────────────────────────────────────────────────────
-- 0009: let a signed-in user create their own missing profile row.
-- Normally the on_auth_user_created trigger inserts it, but accounts that
-- signed up BEFORE the schema was applied have no row; the app now
-- self-heals by inserting it, which needs an RLS insert policy.

create policy "users insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- ──────────────────────────────────────────────────────────────────────────
-- BEGIN supabase/migrations/0010_reviews_buyer_only.sql
-- ──────────────────────────────────────────────────────────────────────────
-- 0010: reviews are buyer → seller only.
--
-- 0005 let either party review the other. In practice the review is the
-- buyer's verdict on the seller — it feeds the seller's rating and the
-- sellers board — so the seller no longer reviews the buyer back.
-- Existing rows are untouched and stay readable.

drop policy if exists "participants review sold trades" on public.reviews;

create policy "buyers review sold trades"
  on public.reviews for insert
  with check (
    reviewer_id = auth.uid()
    and exists (
      select 1
      from public.conversations c
      join public.listings l on l.id = c.listing_id
      where c.id = conversation_id
        and l.id = listing_id
        and l.status = 'sold'
        and c.buyer_id = auth.uid()
        and c.seller_id = reviewee_id
    )
  );

