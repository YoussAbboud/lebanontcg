-- ==========================================================================
-- LebanonTCG — one-paste setup
-- Generated from supabase/migrations/0001–0016 (do not edit; edit the
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
-- END supabase/migrations/0001_profiles.sql
-- ──────────────────────────────────────────────────────────────────────────


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
-- END supabase/migrations/0002_listings.sql
-- ──────────────────────────────────────────────────────────────────────────


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
-- END supabase/migrations/0003_chat.sql
-- ──────────────────────────────────────────────────────────────────────────


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
-- END supabase/migrations/0004_favorites.sql
-- ──────────────────────────────────────────────────────────────────────────


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
-- END supabase/migrations/0005_reviews.sql
-- ──────────────────────────────────────────────────────────────────────────


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
-- END supabase/migrations/0006_reports.sql
-- ──────────────────────────────────────────────────────────────────────────


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
-- END supabase/migrations/0007_storage.sql
-- ──────────────────────────────────────────────────────────────────────────


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
-- END supabase/migrations/0008_offers_likes.sql
-- ──────────────────────────────────────────────────────────────────────────


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
-- END supabase/migrations/0009_profile_selfheal.sql
-- ──────────────────────────────────────────────────────────────────────────


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

-- ──────────────────────────────────────────────────────────────────────────
-- END supabase/migrations/0010_reviews_buyer_only.sql
-- ──────────────────────────────────────────────────────────────────────────


-- ──────────────────────────────────────────────────────────────────────────
-- BEGIN supabase/migrations/0011_pregrade.sql
-- ──────────────────────────────────────────────────────────────────────────
-- 0011: Pre-Grade estimator — reports, captures, outcomes, and the hard
-- separation between estimates and real cert-numbered slabs.
--
-- An estimate can NEVER write listings.grade_company / grade_value.
-- Those stay reserved for real slabs; the constraint below plus the
-- leak test in src/lib/pregrade/leak.test.ts enforce it from both ends.

create type public.pregrade_era as enum ('ultra_modern', 'modern', 'vintage');
create type public.pregrade_confidence as enum ('high', 'moderate', 'low');
create type public.pregrade_recommendation as enum ('submit', 'marginal', 'do_not_submit', 'inconclusive');
create type public.pregrade_capture_slot as enum
  ('front', 'back', 'corner_tl', 'corner_tr', 'corner_br', 'corner_bl', 'rake_front', 'rake_back');

create table public.pregrade_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid references public.listings (id) on delete set null,
  published boolean not null default false,
  standards_version text not null,
  era public.pregrade_era not null,
  centering_method text not null check (centering_method in ('border_detect', 'manual', 'design_element')),
  front_lr numeric(4,1) not null,
  front_tb numeric(4,1) not null,
  back_lr numeric(4,1),
  back_tb numeric(4,1),
  score_centering smallint check (score_centering between 1 and 10),
  score_corners smallint check (score_corners between 1 and 10),
  score_edges smallint check (score_edges between 1 and 10),
  score_surface smallint check (score_surface between 1 and 10),
  base_grade smallint not null check (base_grade between 0 and 10),
  is_ceiling boolean not null default false,
  p10 numeric(4,3) not null default 0,
  p9 numeric(4,3) not null default 0,
  p8 numeric(4,3) not null default 0,
  p_low numeric(4,3) not null default 0,
  confidence public.pregrade_confidence not null,
  recommendation public.pregrade_recommendation not null,
  findings jsonb not null,
  notes jsonb not null default '[]'::jsonb,
  model_id text,
  created_at timestamptz not null default now(),
  -- Publishing requires an attached listing.
  constraint published_needs_listing check (not published or listing_id is not null)
);

create index pregrade_reports_user on public.pregrade_reports (user_id, created_at desc);
create index pregrade_reports_listing on public.pregrade_reports (listing_id) where published;

create table public.pregrade_captures (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.pregrade_reports (id) on delete cascade,
  slot public.pregrade_capture_slot not null,
  path text not null,
  width integer,
  height integer,
  quality jsonb,
  unique (report_id, slot)
);

create table public.pregrade_outcomes (
  report_id uuid primary key references public.pregrade_reports (id) on delete cascade,
  actual_grade smallint not null check (actual_grade between 1 and 10),
  qualifier text,
  cert_number text,
  reported_at timestamptz not null default now(),
  verified boolean not null default false
);

-- ---------------------------------------------------------------------------
-- Separation from real grades: a grade value without a grading company is
-- impossible, so nothing can smuggle an estimate into the slab fields.
-- (Pre-grade code paths never reference these columns — see the leak test.)
-- ---------------------------------------------------------------------------
alter table public.listings add constraint no_pregrade_in_grade_fields
  check (grade_value is null or grade_company is not null);

-- ---------------------------------------------------------------------------
-- RLS: a report is readable by its owner always, and by anyone only when
-- published AND the attached listing is visible. Captures inherit.
-- ---------------------------------------------------------------------------
alter table public.pregrade_reports enable row level security;
alter table public.pregrade_captures enable row level security;
alter table public.pregrade_outcomes enable row level security;

create policy "owners read own reports" on public.pregrade_reports
  for select using (user_id = auth.uid());

create policy "published reports are public" on public.pregrade_reports
  for select using (
    published and listing_id is not null and exists (
      select 1 from public.listings l
      where l.id = listing_id and l.status <> 'removed'
    )
  );

create policy "owners insert own reports" on public.pregrade_reports
  for insert with check (user_id = auth.uid());

create policy "owners update own reports" on public.pregrade_reports
  for update using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    -- A report may only be attached/published to the owner's own listing.
    and (listing_id is null or exists (
      select 1 from public.listings l
      where l.id = listing_id and l.seller_id = auth.uid()
    ))
  );

create policy "owners delete own reports" on public.pregrade_reports
  for delete using (user_id = auth.uid());

create policy "captures follow their report" on public.pregrade_captures
  for select using (exists (
    select 1 from public.pregrade_reports r where r.id = report_id
  ));

create policy "owners add captures" on public.pregrade_captures
  for insert with check (exists (
    select 1 from public.pregrade_reports r
    where r.id = report_id and r.user_id = auth.uid()
  ));

create policy "owners read own outcomes" on public.pregrade_outcomes
  for select using (exists (
    select 1 from public.pregrade_reports r
    where r.id = report_id and r.user_id = auth.uid()
  ));

create policy "owners record outcomes" on public.pregrade_outcomes
  for insert with check (exists (
    select 1 from public.pregrade_reports r
    where r.id = report_id and r.user_id = auth.uid()
  ));

-- ---------------------------------------------------------------------------
-- Private capture bucket: owner-only unless the report is published.
-- Paths are {uid}/{report_id}/{slot}.webp
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pregrade-captures',
  'pregrade-captures',
  false,
  8388608, -- 8 MB: captures stay at 2400px, detail matters here
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "pregrade captures readable by owner or when published"
  on storage.objects for select
  using (
    bucket_id = 'pregrade-captures'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.pregrade_reports r
        where r.id::text = (storage.foldername(name))[2]
          and r.published
      )
    )
  );

create policy "pregrade captures upload into own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'pregrade-captures'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "pregrade captures delete own"
  on storage.objects for delete
  using (
    bucket_id = 'pregrade-captures'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ──────────────────────────────────────────────────────────────────────────
-- END supabase/migrations/0011_pregrade.sql
-- ──────────────────────────────────────────────────────────────────────────


-- ──────────────────────────────────────────────────────────────────────────
-- BEGIN supabase/migrations/0012_pregrade_diagram.sql
-- ──────────────────────────────────────────────────────────────────────────
-- 0012: photo-backed centering diagrams.
-- Stores the eight measured guide positions (normalised 0-1 to the card
-- box) per face, plus whether each face's capture was corner-pinned and
-- flattened — only then do the lines land truthfully on the photo.
-- Null on rows saved before this migration; the UI falls back to the
-- abstract diagram.

alter table public.pregrade_reports
  add column if not exists diagram jsonb;

-- ──────────────────────────────────────────────────────────────────────────
-- END supabase/migrations/0012_pregrade_diagram.sql
-- ──────────────────────────────────────────────────────────────────────────


-- ──────────────────────────────────────────────────────────────────────────
-- BEGIN supabase/migrations/0013_auctions.sql
-- ──────────────────────────────────────────────────────────────────────────
-- 0013: live auctions — sale_type split, auction/bid tables, and ALL
-- bid/close rules as Postgres functions. A bid is a public, non-binding
-- signal: no money moves, the platform holds nothing and enforces no
-- sale. The client never validates a bid for real — place_bid() is the
-- rule, the client check is a nicety.
--
-- Adaptation note: this schema has one price column (listings.price).
-- For auctions it MIRRORS the current top bid (starting price until the
-- first bid) so grids, sorting and price filters keep working unchanged.
-- The mirror is maintained only by the security-definer functions below;
-- a trigger rejects any other price write on an auction listing.

create type public.sale_type as enum ('fixed', 'auction');
create type public.auction_status as enum ('live', 'closed', 'cancelled');

alter table public.listings
  add column sale_type public.sale_type not null default 'fixed';

create table public.auctions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null unique references public.listings (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  starting_price numeric(12, 2) not null,
  reserve_price numeric(12, 2),
  currency text not null,
  ends_at timestamptz not null,
  status public.auction_status not null default 'live',
  winner_id uuid references public.profiles (id) on delete set null,
  winning_bid numeric(12, 2),
  cancel_reason text,
  created_at timestamptz not null default now(),
  constraint starting_price_positive check (starting_price > 0 and starting_price <= 1000000),
  constraint reserve_above_start check (reserve_price is null or reserve_price >= starting_price)
);

create index auctions_live_ending on public.auctions (status, ends_at);

create table public.bids (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.auctions (id) on delete cascade,
  bidder_id uuid not null references public.profiles (id) on delete cascade,
  amount numeric(12, 2) not null,
  -- true when this bid landed in the final minute and pushed ends_at out
  extended boolean not null default false,
  created_at timestamptz not null default now(),
  constraint bid_positive check (amount > 0)
);

create index bids_auction on public.bids (auction_id, created_at desc);
create index bids_auction_amount on public.bids (auction_id, amount desc, created_at asc);

-- ---------------------------------------------------------------------------
-- The two listing types own different behaviour, enforced not documented
-- ---------------------------------------------------------------------------

-- sale_type is chosen once, at creation, for the life of the listing.
create or replace function public.enforce_listing_sale_type()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.sale_type is distinct from old.sale_type then
    raise exception 'sale_type is immutable — close this listing and create a new one';
  end if;
  if new.sale_type = 'auction' and new.quantity <> 1 then
    raise exception 'auctions are for a single card (quantity must be 1)';
  end if;
  -- The price of an auction listing mirrors the current bid and is only
  -- written by the auction functions.
  if tg_op = 'UPDATE'
     and new.sale_type = 'auction'
     and new.price is distinct from old.price
     and current_setting('app.auction_price_sync', true) is distinct from 'on' then
    raise exception 'an auction listing''s price is set by bidding, not edited';
  end if;
  return new;
end;
$$;

create trigger listings_sale_type_guard
  before insert or update on public.listings
  for each row execute function public.enforce_listing_sale_type();

-- Every auction listing must have its auctions row by commit (created in
-- the same transaction), and only auction listings may have one.
create or replace function public.enforce_auction_pairing()
returns trigger
language plpgsql
as $$
begin
  if new.sale_type = 'auction'
     and not exists (select 1 from public.auctions where listing_id = new.id) then
    raise exception 'auction listing has no auction row — create both in one transaction';
  end if;
  return new;
end;
$$;

create constraint trigger listings_auction_pairing
  after insert or update on public.listings
  deferrable initially deferred
  for each row execute function public.enforce_auction_pairing();

create or replace function public.enforce_auction_insert()
returns trigger
language plpgsql
as $$
declare
  l record;
begin
  select seller_id, sale_type, currency into l
    from public.listings where id = new.listing_id;
  if not found then
    raise exception 'listing not found';
  end if;
  if l.sale_type <> 'auction' then
    raise exception 'a fixed-price listing cannot have an auction';
  end if;
  if new.seller_id <> l.seller_id then
    raise exception 'auction seller must be the listing seller';
  end if;
  if new.currency <> l.currency then
    raise exception 'auction currency must match the listing';
  end if;
  if new.ends_at <= now() then
    raise exception 'auction must end in the future';
  end if;
  return new;
end;
$$;

create trigger auctions_insert_guard
  before insert on public.auctions
  for each row execute function public.enforce_auction_insert();

-- Bids are append-only: placed via place_bid(), never edited.
create or replace function public.forbid_bid_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'bids cannot be changed';
end;
$$;

create trigger bids_immutable
  before update on public.bids
  for each row execute function public.forbid_bid_mutation();

-- ---------------------------------------------------------------------------
-- RLS: auctions and bids are public reading; writes go through functions
-- ---------------------------------------------------------------------------

alter table public.auctions enable row level security;
alter table public.bids enable row level security;

create policy "auctions are public"
  on public.auctions for select
  using (true);

-- Creation happens client-side in the same transaction as the listing.
create policy "sellers create own auctions"
  on public.auctions for insert
  with check (auth.uid() = seller_id);

-- No update/delete policies: status changes go through the security-
-- definer functions below; rows die with the listing (cascade).

create policy "bids are public"
  on public.bids for select
  using (true);

-- No bid insert policy: place_bid() is the only door.

-- ---------------------------------------------------------------------------
-- The bidding rule, in one place
-- ---------------------------------------------------------------------------

-- Minimum next bid: 5% of the current bid rounded up to a whole unit,
-- floor of 1 unit; the first bid may equal the starting price.
create or replace function public.min_next_bid(p_current numeric, p_starting numeric)
returns numeric
language sql
immutable
as $$
  select case
    when p_current is null then p_starting
    else p_current + greatest(1, ceiling(p_current * 0.05))
  end;
$$;

-- Placeholder until no-show tracking lands (a later migration replaces
-- it): nobody is banned from bidding yet.
create or replace function public.is_bid_banned(p_user uuid)
returns boolean
language sql
stable
as $$
  select false;
$$;

create or replace function public.place_bid(p_auction_id uuid, p_amount numeric)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  a record;
  v_current numeric;
  v_min numeric;
  v_extend boolean;
  v_bid public.bids;
  v_ends timestamptz;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  select * into a from auctions where id = p_auction_id for update;
  if not found then
    raise exception 'auction not found';
  end if;
  if a.status <> 'live' or a.ends_at <= now() then
    raise exception 'this auction has ended';
  end if;
  if a.seller_id = auth.uid() then
    raise exception 'sellers cannot bid on their own auction';
  end if;
  if public.is_blocked_between(auth.uid(), a.seller_id) then
    raise exception 'you cannot bid on this auction';
  end if;
  if public.is_bid_banned(auth.uid()) then
    raise exception 'bidding is blocked on this account after repeated no-shows';
  end if;

  select max(amount) into v_current from bids where auction_id = p_auction_id;
  v_min := public.min_next_bid(v_current, a.starting_price);
  if p_amount < v_min then
    raise exception 'minimum bid is %', trim(to_char(v_min, 'FM999999990.00'));
  end if;
  if p_amount > 1000000 then
    raise exception 'bid too large';
  end if;

  -- Anti-snipe: a bid inside the final minute pushes the close out 60s.
  v_extend := a.ends_at - now() < interval '60 seconds';
  v_ends := a.ends_at;
  if v_extend then
    v_ends := a.ends_at + interval '60 seconds';
    update auctions set ends_at = v_ends where id = p_auction_id;
  end if;

  insert into bids (auction_id, bidder_id, amount, extended)
    values (p_auction_id, auth.uid(), p_amount, v_extend)
    returning * into v_bid;

  -- Mirror the top bid onto the listing so grids/sorting stay truthful.
  perform set_config('app.auction_price_sync', 'on', true);
  update listings set price = p_amount where id = a.listing_id;

  return jsonb_build_object(
    'bid_id', v_bid.id,
    'amount', v_bid.amount,
    'ends_at', v_ends,
    'extended', v_extend
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Closing — shared by the cron sweep, lazy close, and seller end-early
-- ---------------------------------------------------------------------------

-- Close one due auction: resolve the winner against the reserve, open
-- the winner<->seller conversation, post the handoff system message,
-- park the listing. Assumes the caller holds the row lock.
create or replace function public.close_auction_row(a public.auctions)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  top record;
  conv public.conversations;
  v_handle text;
begin
  select bidder_id, amount into top
    from bids
    where auction_id = a.id
    order by amount desc, created_at asc
    limit 1;

  perform set_config('app.auction_price_sync', 'on', true);

  if top is not null and (a.reserve_price is null or top.amount >= a.reserve_price) then
    select * into conv from conversations
      where listing_id = a.listing_id and buyer_id = top.bidder_id;
    if not found then
      insert into conversations (listing_id, buyer_id, seller_id)
        values (a.listing_id, top.bidder_id, a.seller_id)
        returning * into conv;
    end if;
    select coalesce('@' || username, display_name) into v_handle
      from profiles where id = top.bidder_id;
    insert into messages (conversation_id, sender_id, kind, body)
      values (conv.id, null, 'system',
        v_handle || ' won this auction at ' || a.currency || ' '
        || trim(to_char(top.amount, 'FM999999990.00'))
        || '. Sort out payment and delivery between yourselves — LebanonTCG isn''t part of the transaction.');
    update auctions
      set status = 'closed', winner_id = top.bidder_id, winning_bid = top.amount
      where id = a.id;
    update listings
      set status = 'reserved', reserved_for_conversation_id = conv.id
      where id = a.listing_id and status = 'active';
  else
    -- No bids, or the reserve wasn't met: nobody wins, the card stays
    -- with the seller. The listing leaves browse; Relist creates a new one.
    update auctions set status = 'closed' where id = a.id;
    update listings set status = 'removed'
      where id = a.listing_id and status = 'active';
  end if;
end;
$$;

-- The sweep: pg_cron runs it every minute, and clients call it lazily on
-- read so a stale auction never renders as live when cron is behind.
create or replace function public.close_due_auctions()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  a public.auctions;
  n integer := 0;
begin
  for a in
    select * from auctions
    where status = 'live' and ends_at <= now()
    for update skip locked
  loop
    perform public.close_auction_row(a);
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Seller ends the auction now: the highest bid (if any) wins as-is.
create or replace function public.end_auction_early(p_auction_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  a public.auctions;
begin
  select * into a from auctions where id = p_auction_id for update;
  if not found then
    raise exception 'auction not found';
  end if;
  if a.seller_id <> auth.uid() then
    raise exception 'only the seller can end this auction';
  end if;
  if a.status <> 'live' then
    raise exception 'this auction is not live';
  end if;
  update auctions set ends_at = now() where id = p_auction_id;
  a.ends_at := now();
  perform public.close_auction_row(a);
end;
$$;

-- Seller cancels: no winner, reason required, every bidder notified via
-- a system message in a conversation with the seller.
create or replace function public.cancel_auction(p_auction_id uuid, p_reason text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  a record;
  b record;
  conv public.conversations;
begin
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'a cancellation reason is required';
  end if;
  select * into a from auctions where id = p_auction_id for update;
  if not found then
    raise exception 'auction not found';
  end if;
  if a.seller_id <> auth.uid() then
    raise exception 'only the seller can cancel this auction';
  end if;
  if a.status <> 'live' then
    raise exception 'this auction is not live';
  end if;

  update auctions
    set status = 'cancelled', cancel_reason = trim(p_reason)
    where id = p_auction_id;
  perform set_config('app.auction_price_sync', 'on', true);
  update listings set status = 'removed'
    where id = a.listing_id and status = 'active';

  for b in select distinct bidder_id from bids where auction_id = p_auction_id loop
    select * into conv from conversations
      where listing_id = a.listing_id and buyer_id = b.bidder_id;
    if not found then
      insert into conversations (listing_id, buyer_id, seller_id)
        values (a.listing_id, b.bidder_id, a.seller_id)
        returning * into conv;
    end if;
    insert into messages (conversation_id, sender_id, kind, body)
      values (conv.id, null, 'system',
        'The seller cancelled this auction. Reason: ' || trim(p_reason));
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Realtime + cron (both best-effort; lazy close is the safety net)
-- ---------------------------------------------------------------------------

do $$
begin
  alter publication supabase_realtime add table public.auctions;
  alter publication supabase_realtime add table public.bids;
exception when others then
  null; -- publication may not exist outside Supabase
end
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('close-auctions', '* * * * *', 'select public.close_due_auctions()');
  end if;
exception when others then
  null; -- pg_cron not enabled: lazy close on read still keeps state honest
end
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- END supabase/migrations/0013_auctions.sql
-- ──────────────────────────────────────────────────────────────────────────


-- ──────────────────────────────────────────────────────────────────────────
-- BEGIN supabase/migrations/0014_create_auction_listing.sql
-- ──────────────────────────────────────────────────────────────────────────
-- 0014: atomic auction-listing creation. The pairing constraint (0013)
-- demands listing + auction in ONE transaction, which two PostgREST
-- calls can never be — so creation is an RPC. Runs as the caller
-- (security invoker): the normal listing/auction RLS insert policies
-- still apply.

create or replace function public.create_auction_listing(
  p_input jsonb,
  p_starting_price numeric,
  p_reserve_price numeric,
  p_duration_hours integer
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_listing_id uuid;
  v_currency text := coalesce(nullif(p_input->>'currency', ''), 'USD');
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if p_duration_hours is null or p_duration_hours not in (1, 6, 24, 72, 168) then
    raise exception 'invalid auction duration';
  end if;

  insert into public.listings
    (seller_id, title, game, set_name, card_number, language, condition,
     finish, grade_company, grade_value, price, currency, quantity,
     description, sale_type)
  values
    (auth.uid(),
     p_input->>'title',
     (p_input->>'game')::public.game_type,
     coalesce(p_input->>'set_name', ''),
     coalesce(p_input->>'card_number', ''),
     coalesce(nullif(p_input->>'language', ''), 'English'),
     (p_input->>'condition')::public.condition_type,
     coalesce(nullif(p_input->>'finish', ''), 'normal')::public.finish_type,
     nullif(p_input->>'grade_company', ''),
     nullif(p_input->>'grade_value', ''),
     -- the listing price mirrors the current bid; it starts at the floor
     p_starting_price,
     v_currency,
     1,
     coalesce(p_input->>'description', ''),
     'auction')
  returning id into v_listing_id;

  insert into public.auctions
    (listing_id, seller_id, starting_price, reserve_price, currency, ends_at)
  values
    (v_listing_id, auth.uid(), p_starting_price, p_reserve_price, v_currency,
     now() + make_interval(hours => p_duration_hours));

  return v_listing_id;
end;
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- END supabase/migrations/0014_create_auction_listing.sql
-- ──────────────────────────────────────────────────────────────────────────


-- ──────────────────────────────────────────────────────────────────────────
-- BEGIN supabase/migrations/0015_auction_no_shows.sql
-- ──────────────────────────────────────────────────────────────────────────
-- 0015: auction accountability. Non-binding bids plus no payment rail
-- means winners can vanish — after a closed auction the seller can mark
-- the winner as a no-show (and the winner can mirror it for an
-- unresponsive seller). Three winner no-shows within 90 days blocks an
-- account from BIDDING — listings and chat are unaffected. Every report
-- also lands in the existing report queue.

create table public.auction_no_shows (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references public.auctions (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reported_id uuid not null references public.profiles (id) on delete cascade,
  -- who failed to follow through
  role text not null check (role in ('winner', 'seller')),
  created_at timestamptz not null default now(),
  constraint one_report_per_side unique (auction_id, reporter_id)
);

create index auction_no_shows_reported
  on public.auction_no_shows (reported_id, role, created_at desc);

alter table public.auction_no_shows enable row level security;

-- Accountability is public reading; writing goes through the function.
create policy "no-shows are public"
  on public.auction_no_shows for select
  using (true);

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

  -- Feed the existing report queue so moderation sees the pattern.
  insert into reports (reporter_id, target_type, target_id, reason, detail)
    values (auth.uid(), 'user', v_reported::text, 'other',
      'Auction no-show (' || v_role || ') on auction ' || p_auction_id);
end;
$$;

-- Replace the 0013 placeholder: three winner no-shows in 90 days block
-- an account from bidding.
create or replace function public.is_bid_banned(p_user uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select count(*) >= 3
  from auction_no_shows
  where reported_id = p_user
    and role = 'winner'
    and created_at > now() - interval '90 days';
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- END supabase/migrations/0015_auction_no_shows.sql
-- ──────────────────────────────────────────────────────────────────────────

-- ──────────────────────────────────────────────────────────────────────────
-- BEGIN supabase/migrations/0016_admin.sql
-- ──────────────────────────────────────────────────────────────────────────
-- 0016: the admin console — roles, suspensions, a report workflow and an
-- audit log.
--
-- Design rules, in order of importance:
--
--  1. NO privileged mutation is a plain table write. Every one is a
--     security-definer RPC that asserts the caller is an admin and writes
--     an admin_actions row in the same transaction, so "who removed this
--     and why" is always answerable. The app's anon key therefore never
--     needs elevated table grants, and the service_role key never has to
--     reach the browser.
--  2. Admins are marked by profiles.is_admin, which users CANNOT set on
--     themselves: the profiles update policy is still `auth.uid() = id`,
--     so a guard trigger rejects writes to the privileged columns unless
--     an admin RPC set app.admin_action for the statement (the same
--     technique 0001/0005 use for the system-maintained rating fields).
--  3. Reads widen only where moderation needs them. Admins see every
--     listing (including removed ones), the report queue and the audit
--     log. Private conversations stay private — an admin can read a
--     message ONLY when that message is the target of a report.
--  4. Suspension is an account-level stop on creating things (listings,
--     messages, bids). It never deletes history: a suspended user's past
--     trades, reviews and conversations stay readable so the other party
--     keeps their record.

-- ---------------------------------------------------------------------------
-- Role + suspension columns
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column is_admin boolean not null default false,
  add column suspended_at timestamptz,
  add column suspended_reason text,
  add constraint suspended_reason_length
    check (suspended_reason is null or char_length(suspended_reason) <= 300);

create index profiles_admins on public.profiles (id) where is_admin;
create index profiles_suspended on public.profiles (id) where suspended_at is not null;

-- Security definer so policies on profiles can call it without recursing
-- into profiles' own RLS.
create or replace function public.is_admin(p_user uuid default auth.uid())
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select coalesce((select p.is_admin from profiles p where p.id = p_user), false);
$$;

create or replace function public.is_suspended(p_user uuid default auth.uid())
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select coalesce(
    (select p.suspended_at is not null from profiles p where p.id = p_user),
    false);
$$;

-- is_admin / suspended_* are privileged: only the admin RPCs below may
-- write them, and they announce themselves with app.admin_action.
create or replace function public.enforce_privileged_profile_fields()
returns trigger
language plpgsql
as $$
begin
  if (new.is_admin is distinct from old.is_admin
      or new.suspended_at is distinct from old.suspended_at
      or new.suspended_reason is distinct from old.suspended_reason)
     and current_setting('app.admin_action', true) is distinct from '1' then
    raise exception 'role and suspension fields are set by admin actions only';
  end if;
  return new;
end;
$$;

create trigger profiles_privileged_fields
  before update on public.profiles
  for each row execute function public.enforce_privileged_profile_fields();

-- ---------------------------------------------------------------------------
-- Report workflow: the queue from 0006 gains a lifecycle and admin reads
-- ---------------------------------------------------------------------------

create type public.report_status as enum ('open', 'reviewing', 'resolved', 'dismissed');

alter table public.reports
  add column status public.report_status not null default 'open',
  add column resolved_by uuid references public.profiles (id) on delete set null,
  add column resolved_at timestamptz,
  add column resolution_note text,
  add constraint resolution_note_length
    check (resolution_note is null or char_length(resolution_note) <= 1000);

create index reports_queue on public.reports (status, created_at desc);

create policy "admins read the report queue"
  on public.reports for select
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------

create type public.admin_action_kind as enum (
  'user_suspend',
  'user_unsuspend',
  'user_promote',
  'user_demote',
  'user_clear_bid_ban',
  'listing_status',
  'listing_delete',
  'auction_cancel',
  'review_delete',
  'report_resolve'
);

create table public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles (id) on delete cascade,
  kind public.admin_action_kind not null,
  -- target_id is text (not uuid) because reports.target_id is: a target
  -- can be a listing, a user or a message.
  target_type text not null,
  target_id text not null,
  reason text not null default '',
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint reason_length check (char_length(reason) <= 500)
);

create index admin_actions_recent on public.admin_actions (created_at desc);
create index admin_actions_target on public.admin_actions (target_type, target_id);

alter table public.admin_actions enable row level security;

create policy "admins read the audit log"
  on public.admin_actions for select
  using (public.is_admin());

-- No insert/update/delete policies at all: the log is append-only and only
-- the security-definer RPCs below write to it. An admin cannot erase their
-- own trail through the API.

-- ---------------------------------------------------------------------------
-- Widened admin reads
-- ---------------------------------------------------------------------------

create policy "admins read every listing"
  on public.listings for select
  using (public.is_admin());

-- Deliberately narrow: conversations stay private. An admin can read a
-- message only once someone has reported that exact message, which is the
-- only case where judging it is the job.
create policy "admins read reported messages"
  on public.messages for select
  using (
    public.is_admin()
    and exists (
      select 1 from public.reports r
      where r.target_type = 'message' and r.target_id = messages.id::text
    )
  );

-- ---------------------------------------------------------------------------
-- Suspension enforcement — a suspended account creates nothing new
-- ---------------------------------------------------------------------------

drop policy "sellers insert own listings" on public.listings;
create policy "sellers insert own listings"
  on public.listings for insert
  with check (
    seller_id = auth.uid()
    and status = 'active'
    and not public.is_suspended()
  );

drop policy "participants send messages" on public.messages;
create policy "participants send messages"
  on public.messages for insert
  with check (
    kind = 'user'
    and sender_id = auth.uid()
    and public.is_conversation_participant(conversation_id)
    and not public.is_suspended()
    and not exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and public.is_blocked_between(c.buyer_id, c.seller_id)
    )
  );

-- Bidding already funnels through is_bid_banned() inside place_bid, so
-- extending that one predicate covers auctions (0015's no-show rule is
-- preserved verbatim).
create or replace function public.is_bid_banned(p_user uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select public.is_suspended(p_user)
    or (
      select count(*) >= 3
      from auction_no_shows
      where reported_id = p_user
        and role = 'winner'
        and created_at > now() - interval '90 days'
    );
$$;

-- ---------------------------------------------------------------------------
-- Admin RPC plumbing
-- ---------------------------------------------------------------------------

create or replace function public.require_admin()
returns uuid
language plpgsql
security definer set search_path = public
stable
as $$
begin
  if auth.uid() is null then
    raise exception 'sign in required';
  end if;
  if not public.is_admin() then
    raise exception 'this action is restricted to admins';
  end if;
  return auth.uid();
end;
$$;

create or replace function public.log_admin_action(
  p_actor uuid,
  p_kind public.admin_action_kind,
  p_target_type text,
  p_target_id text,
  p_reason text,
  p_detail jsonb default '{}'::jsonb
)
returns void
language sql
security definer set search_path = public
as $$
  insert into admin_actions (actor_id, kind, target_type, target_id, reason, detail)
  values (p_actor, p_kind, p_target_type, p_target_id, coalesce(trim(p_reason), ''), p_detail);
$$;

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------

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

  perform set_config('app.admin_action', '1', true);
  update profiles set
    suspended_at = case when p_suspended then now() else null end,
    suspended_reason = case when p_suspended then trim(p_reason) else null end
  where id = p_user;
  if not found then
    raise exception 'user not found';
  end if;

  perform public.log_admin_action(
    v_actor,
    case when p_suspended then 'user_suspend' else 'user_unsuspend' end::public.admin_action_kind,
    'user', p_user::text, p_reason);
end;
$$;

create or replace function public.admin_set_admin(p_user uuid, p_is_admin boolean)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_actor uuid := public.require_admin();
begin
  -- Self-demotion is how you lock everyone out of the console by
  -- accident; another admin has to do it.
  if p_user = v_actor and not p_is_admin then
    raise exception 'another admin has to remove your own admin access';
  end if;
  if p_is_admin and public.is_suspended(p_user) then
    raise exception 'lift the suspension before granting admin access';
  end if;

  perform set_config('app.admin_action', '1', true);
  update profiles set is_admin = p_is_admin where id = p_user;
  if not found then
    raise exception 'user not found';
  end if;

  perform public.log_admin_action(
    v_actor,
    case when p_is_admin then 'user_promote' else 'user_demote' end::public.admin_action_kind,
    'user', p_user::text, '');
end;
$$;

-- Lift a bidding block by clearing the winner-role no-shows behind it
-- (0015). Used when a no-show report turns out to be retaliation.
create or replace function public.admin_clear_bid_ban(p_user uuid, p_reason text default '')
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_actor uuid := public.require_admin();
  v_n integer;
begin
  delete from auction_no_shows
    where reported_id = p_user and role = 'winner';
  get diagnostics v_n = row_count;
  perform public.log_admin_action(v_actor, 'user_clear_bid_ban', 'user', p_user::text,
    p_reason, jsonb_build_object('cleared', v_n));
  return v_n;
end;
$$;

-- ---------------------------------------------------------------------------
-- Listings
-- ---------------------------------------------------------------------------

-- Moderation overrides the seller-authored lifecycle: a fraudulent listing
-- has to come down even from `sold` (which is terminal for sellers). The
-- transition trigger is skipped for exactly this path.
create or replace function public.enforce_listing_transitions()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status
     and current_setting('app.admin_action', true) is distinct from '1' then
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

-- The system message a moderated listing posts into its conversations has
-- to say a moderator did it — "Seller removed this listing" would be a lie.
create or replace function public.announce_listing_status()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  conv record;
  msg text;
  by_admin boolean := current_setting('app.admin_action', true) = '1';
begin
  if new.status is distinct from old.status then
    for conv in select id from conversations where listing_id = new.id loop
      msg := case
        when by_admin and new.status = 'removed' then
          'A moderator removed this listing.'
        when by_admin and new.status = 'active' then
          'A moderator restored this listing.'
        when new.status = 'reserved' then
          case when new.reserved_for_conversation_id = conv.id
            then 'Seller reserved this listing for this conversation.'
            else 'Seller marked this listing as reserved.'
          end
        when new.status = 'sold' then 'Seller marked this listing as sold.'
        when new.status = 'active' then 'Seller relisted this card — it is available again.'
        when new.status = 'removed' then 'Seller removed this listing.'
      end;
      if msg is not null then
        insert into messages (conversation_id, sender_id, kind, body)
          values (conv.id, null, 'system', msg);
      end if;
    end loop;
  end if;
  return new;
end;
$$;

create or replace function public.admin_set_listing_status(
  p_listing uuid,
  p_status public.listing_status,
  p_reason text default ''
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_actor uuid := public.require_admin();
  v_old public.listing_status;
begin
  select status into v_old from listings where id = p_listing for update;
  if not found then
    raise exception 'listing not found';
  end if;
  if v_old = p_status then
    return;
  end if;
  if p_status = 'removed' and (p_reason is null or length(trim(p_reason)) < 3) then
    raise exception 'a reason is required to remove a listing';
  end if;

  perform set_config('app.admin_action', '1', true);
  perform set_config('app.auction_price_sync', 'on', true);
  update listings set status = p_status where id = p_listing;

  perform public.log_admin_action(v_actor, 'listing_status', 'listing', p_listing::text,
    p_reason, jsonb_build_object('from', v_old, 'to', p_status));
end;
$$;

-- Hard delete, for listings that should not exist at all (illegal content,
-- spam floods). Cascades to images, conversations, offers and reviews, so
-- it is the last resort — removal is the everyday tool.
create or replace function public.admin_delete_listing(p_listing uuid, p_reason text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_actor uuid := public.require_admin();
  v_title text;
  v_seller uuid;
begin
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'a reason is required to delete a listing';
  end if;
  select title, seller_id into v_title, v_seller from listings where id = p_listing;
  if not found then
    raise exception 'listing not found';
  end if;

  perform set_config('app.admin_action', '1', true);
  delete from listings where id = p_listing;

  perform public.log_admin_action(v_actor, 'listing_delete', 'listing', p_listing::text,
    p_reason, jsonb_build_object('title', v_title, 'seller_id', v_seller));
end;
$$;

-- ---------------------------------------------------------------------------
-- Auctions
-- ---------------------------------------------------------------------------

-- Same shape as cancel_auction (0013) but for a moderator, and the bidders
-- are told it was a moderator rather than the seller.
create or replace function public.admin_cancel_auction(p_auction uuid, p_reason text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_actor uuid := public.require_admin();
  a record;
  b record;
  conv public.conversations;
begin
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'a cancellation reason is required';
  end if;
  select * into a from auctions where id = p_auction for update;
  if not found then
    raise exception 'auction not found';
  end if;
  if a.status <> 'live' then
    raise exception 'this auction is not live';
  end if;

  update auctions
    set status = 'cancelled', cancel_reason = trim(p_reason)
    where id = p_auction;

  perform set_config('app.admin_action', '1', true);
  perform set_config('app.auction_price_sync', 'on', true);
  update listings set status = 'removed'
    where id = a.listing_id and status = 'active';

  for b in select distinct bidder_id from bids where auction_id = p_auction loop
    select * into conv from conversations
      where listing_id = a.listing_id and buyer_id = b.bidder_id;
    if not found then
      insert into conversations (listing_id, buyer_id, seller_id)
        values (a.listing_id, b.bidder_id, a.seller_id)
        returning * into conv;
    end if;
    insert into messages (conversation_id, sender_id, kind, body)
      values (conv.id, null, 'system',
        'A moderator cancelled this auction. Reason: ' || trim(p_reason));
  end loop;

  perform public.log_admin_action(v_actor, 'auction_cancel', 'auction', p_auction::text,
    p_reason, jsonb_build_object('listing_id', a.listing_id));
end;
$$;

-- ---------------------------------------------------------------------------
-- Reviews
-- ---------------------------------------------------------------------------

-- Deleting a review has to re-roll the denormalized rating on the profile,
-- including back to NULL when it was the only one (the 0005 rollup trigger
-- is insert-only and its subquery yields no row for the last deletion).
create or replace function public.admin_delete_review(p_review uuid, p_reason text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_actor uuid := public.require_admin();
  v_reviewee uuid;
  v_rating integer;
begin
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'a reason is required to delete a review';
  end if;
  select reviewee_id, rating into v_reviewee, v_rating from reviews where id = p_review;
  if not found then
    raise exception 'review not found';
  end if;

  delete from reviews where id = p_review;

  perform set_config('app.allow_rating_write', '1', true);
  update profiles p set
    rating_avg = sub.avg_rating,
    rating_count = sub.n
  from (
    select round(avg(rating)::numeric, 2) as avg_rating, count(*) as n
    from reviews where reviewee_id = v_reviewee
  ) sub
  where p.id = v_reviewee;
  -- count(*) is 0 (not null) when the last review goes, so blank the average.
  update profiles set rating_avg = null where id = v_reviewee and rating_count = 0;

  perform public.log_admin_action(v_actor, 'review_delete', 'review', p_review::text,
    p_reason, jsonb_build_object('reviewee_id', v_reviewee, 'rating', v_rating));
end;
$$;

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------

create policy "admins update the report queue"
  on public.reports for update
  using (public.is_admin())
  with check (public.is_admin());

create or replace function public.admin_resolve_report(
  p_report uuid,
  p_status public.report_status,
  p_note text default ''
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_actor uuid := public.require_admin();
  v_settled boolean := p_status in ('resolved', 'dismissed');
begin
  update reports set
    status = p_status,
    resolution_note = nullif(trim(coalesce(p_note, '')), ''),
    resolved_by = case when v_settled then v_actor else null end,
    resolved_at = case when v_settled then now() else null end
  where id = p_report;
  if not found then
    raise exception 'report not found';
  end if;

  perform public.log_admin_action(v_actor, 'report_resolve', 'report', p_report::text,
    p_note, jsonb_build_object('status', p_status));
end;
$$;

-- ---------------------------------------------------------------------------
-- Dashboard counters — one round trip instead of a dozen head-count queries
-- ---------------------------------------------------------------------------

create or replace function public.admin_stats()
returns jsonb
language plpgsql
security definer set search_path = public
stable
as $$
declare
  v_out jsonb;
begin
  perform public.require_admin();
  select jsonb_build_object(
    'users',            (select count(*) from profiles),
    'usersNew7d',       (select count(*) from profiles where created_at > now() - interval '7 days'),
    'suspended',        (select count(*) from profiles where suspended_at is not null),
    'admins',           (select count(*) from profiles where is_admin),
    'listingsActive',   (select count(*) from listings where status = 'active'),
    'listingsReserved', (select count(*) from listings where status = 'reserved'),
    'listingsSold',     (select count(*) from listings where status = 'sold'),
    'listingsRemoved',  (select count(*) from listings where status = 'removed'),
    'listingsNew7d',    (select count(*) from listings where created_at > now() - interval '7 days'),
    'auctionsLive',     (select count(*) from auctions where status = 'live'),
    'bids24h',          (select count(*) from bids where created_at > now() - interval '24 hours'),
    'reportsOpen',      (select count(*) from reports where status = 'open'),
    'reportsReviewing', (select count(*) from reports where status = 'reviewing'),
    'reviews',          (select count(*) from reviews),
    'messages24h',      (select count(*) from messages where created_at > now() - interval '24 hours'),
    'gmvListedActive',  (select coalesce(sum(price), 0) from listings where status = 'active'),
    'valueSold',        (select coalesce(sum(price), 0) from listings where status = 'sold')
  ) into v_out;
  return v_out;
end;
$$;

-- One row per account with the counts a moderator decides on. An RPC
-- because the alternative is a per-user fan-out of head counts from the
-- browser; the aggregation belongs next to the data.
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
      public.is_bid_banned(p.id) as bid_banned
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

-- ---------------------------------------------------------------------------
-- Bootstrapping the first admin
-- ---------------------------------------------------------------------------
-- There is deliberately no way to become an admin through the app: the
-- first one is promoted once, by hand, from the SQL editor (the service
-- role bypasses RLS, and set_config satisfies the guard trigger):
--
--   select set_config('app.admin_action', '1', true);
--   update public.profiles set is_admin = true
--     where id = (select id from auth.users where email = 'you@example.com');
--
-- After that, admins promote each other from /admin.

-- ──────────────────────────────────────────────────────────────────────────
-- END supabase/migrations/0016_admin.sql
-- ──────────────────────────────────────────────────────────────────────────
