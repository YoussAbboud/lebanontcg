-- ==========================================================================
-- LebanonTCG — UPDATE script: migration 0024 (notifications)
--
-- The bell in the header: a notifications table filled by triggers for
-- messages, offers, bids, auction outcomes, reviews, watchlist changes
-- and moderation, pushed live over Realtime. Apply after 0023. Run ONCE.
--
-- HOW TO USE: Supabase dashboard → SQL Editor → New query → paste this
-- entire file → Run.
-- ==========================================================================


-- ──────────────────────────────────────────────────────────────────────────
-- BEGIN supabase/migrations/0024_notifications.sql
-- ──────────────────────────────────────────────────────────────────────────
-- 0024: notifications.
--
-- One row per thing a person should hear about, written by triggers on
-- the tables where those things happen — never by the client. The bell
-- in the header reads them; Realtime pushes new ones. Kinds today:
--
--   message        someone wrote to you (one live row per conversation,
--                  refreshed rather than repeated)
--   offer          an offer was made to you / your offer was answered
--   bid            a bid landed on your auction (one live row per auction)
--   outbid         your top bid was beaten
--   auction        you won / your auction ended / it was cancelled
--   review         someone reviewed you
--   watch          a card on your watchlist sold or dropped in price
--   moderation     a moderator removed or restored your listing
--
-- Nobody is notified of their own actions, and only the recipient can
-- read or mark their rows.

create type public.notification_kind as enum
  ('message', 'offer', 'bid', 'outbid', 'auction', 'review', 'watch', 'moderation');

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind public.notification_kind not null,
  title text not null,
  body text not null default '',
  /** Where tapping it goes — an app path, never a full URL. */
  href text not null,
  /** Who caused it, for the avatar. Null for system events. */
  actor_id uuid references public.profiles (id) on delete set null,
  /** Collapses repeats: a second message in the same thread refreshes
      the unread row instead of stacking another. */
  dedupe_key text,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint title_length check (char_length(title) <= 160),
  constraint body_length check (char_length(body) <= 400),
  constraint href_is_path check (href ~ '^/[^/]')
);

create index notifications_inbox on public.notifications (user_id, created_at desc);
create index notifications_unread on public.notifications (user_id) where read_at is null;
create unique index notifications_dedupe
  on public.notifications (user_id, dedupe_key) where read_at is null and dedupe_key is not null;

alter table public.notifications enable row level security;

create policy "users read own notifications"
  on public.notifications for select
  using (user_id = auth.uid());
-- Marking read is the only client write, and it goes through the RPC
-- below so a row can never be forged or moved to another inbox.

-- ---------------------------------------------------------------------------
-- The one writer
-- ---------------------------------------------------------------------------

create or replace function public.notify(
  p_user uuid,
  p_kind public.notification_kind,
  p_title text,
  p_body text,
  p_href text,
  p_actor uuid default null,
  p_dedupe text default null
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if p_user is null or p_user = p_actor then
    return;
  end if;
  if p_dedupe is not null then
    -- Refresh the live row for this thread/auction instead of stacking.
    update notifications
      set title = left(p_title, 160), body = left(coalesce(p_body, ''), 400),
          actor_id = p_actor, created_at = now()
      where user_id = p_user and dedupe_key = p_dedupe and read_at is null;
    if found then
      return;
    end if;
  end if;
  insert into notifications (user_id, kind, title, body, href, actor_id, dedupe_key)
    values (p_user, p_kind, left(p_title, 160), left(coalesce(p_body, ''), 400),
            p_href, p_actor, p_dedupe);
end;
$$;
revoke execute on function public.notify(uuid, public.notification_kind, text, text, text, uuid, text)
  from public, anon, authenticated;

/** "@handle" or the display name — how a person is named in a line. */
create or replace function public.handle_of(p_user uuid)
returns text
language sql
stable
security definer set search_path = public
as $$
  select coalesce('@' || p.username, p.display_name, 'Someone')
  from profiles p where p.id = p_user;
$$;

/** Mark some (or, with null, all) of the caller's notifications read.
    Returns how many were marked. */
create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  n integer;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  update notifications
    set read_at = now()
    where user_id = auth.uid()
      and read_at is null
      and (p_ids is null or id = any (p_ids));
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- Messages and offers
-- ---------------------------------------------------------------------------

create or replace function public.notify_message()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  conv record;
  other uuid;
  l record;
begin
  if new.kind = 'system' or new.sender_id is null then
    return new;
  end if;
  select c.*, li.title as listing_title, li.currency into conv
    from conversations c join listings li on li.id = c.listing_id
    where c.id = new.conversation_id;
  other := case when new.sender_id = conv.buyer_id then conv.seller_id else conv.buyer_id end;
  if new.kind = 'offer' then
    perform public.notify(other, 'offer',
      public.handle_of(new.sender_id) || ' offered ' || to_char(new.amount, 'FM999,999,990') || ' ' || conv.currency,
      conv.listing_title, '/chat/' || new.conversation_id, new.sender_id, null);
  else
    perform public.notify(other, 'message',
      public.handle_of(new.sender_id) || ' · ' || conv.listing_title,
      left(new.body, 140), '/chat/' || new.conversation_id, new.sender_id,
      'conv:' || new.conversation_id);
  end if;
  return new;
end;
$$;

create trigger messages_notify
  after insert on public.messages
  for each row execute function public.notify_message();

create or replace function public.notify_offer_answer()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  conv record;
  answerer uuid;
begin
  if new.kind <> 'offer' or new.offer_status is not distinct from old.offer_status
     or new.offer_status not in ('accepted', 'declined') then
    return new;
  end if;
  select c.*, li.title as listing_title, li.currency into conv
    from conversations c join listings li on li.id = c.listing_id
    where c.id = new.conversation_id;
  answerer := case when new.sender_id = conv.buyer_id then conv.seller_id else conv.buyer_id end;
  perform public.notify(new.sender_id, 'offer',
    case when new.offer_status = 'accepted'
      then 'Your offer of ' || to_char(new.amount, 'FM999,999,990') || ' ' || conv.currency || ' was accepted'
      else 'Your offer of ' || to_char(new.amount, 'FM999,999,990') || ' ' || conv.currency || ' was declined' end,
    conv.listing_title, '/chat/' || new.conversation_id, answerer, null);
  return new;
end;
$$;

create trigger messages_notify_offer_answer
  after update of offer_status on public.messages
  for each row execute function public.notify_offer_answer();

-- ---------------------------------------------------------------------------
-- Bids and auctions
-- ---------------------------------------------------------------------------

create or replace function public.notify_bid()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  a record;
  prev_top uuid;
begin
  select au.*, li.title as listing_title into a
    from auctions au join listings li on li.id = au.listing_id
    where au.id = new.auction_id;
  -- The seller: one live row per auction, refreshed with each bid.
  perform public.notify(a.seller_id, 'bid',
    'New bid on ' || a.listing_title,
    public.handle_of(new.bidder_id) || ' bid ' || to_char(new.amount, 'FM999,999,990') || ' ' || a.currency,
    '/listing/' || a.listing_id, new.bidder_id, 'auction:' || a.id);
  -- Whoever held the top before this bid, if it was someone else.
  select b.bidder_id into prev_top
    from bids b
    where b.auction_id = new.auction_id and b.id <> new.id
    order by b.amount desc, b.created_at asc
    limit 1;
  if prev_top is not null and prev_top <> new.bidder_id then
    perform public.notify(prev_top, 'outbid',
      'You were outbid on ' || a.listing_title,
      'The bid is now ' || to_char(new.amount, 'FM999,999,990') || ' ' || a.currency,
      '/listing/' || a.listing_id, new.bidder_id, 'outbid:' || a.id);
  end if;
  return new;
end;
$$;

create trigger bids_notify
  after insert on public.bids
  for each row execute function public.notify_bid();

create or replace function public.notify_auction_end()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  li record;
  bidder uuid;
begin
  if new.status is not distinct from old.status or new.status = 'live' then
    return new;
  end if;
  select title into li from listings where id = new.listing_id;
  if new.status = 'closed' and new.winner_id is not null then
    perform public.notify(new.winner_id, 'auction',
      'You won ' || li.title,
      'At ' || to_char(new.winning_bid, 'FM999,999,990') || ' ' || new.currency || ' — the chat with the seller is open.',
      '/listing/' || new.listing_id, null, null);
    perform public.notify(new.seller_id, 'auction',
      'Your auction ended — ' || li.title,
      'Won by ' || public.handle_of(new.winner_id) || ' at ' || to_char(new.winning_bid, 'FM999,999,990') || ' ' || new.currency,
      '/listing/' || new.listing_id, new.winner_id, null);
  elsif new.status = 'closed' then
    perform public.notify(new.seller_id, 'auction',
      'Your auction ended — ' || li.title,
      'No winner this time. You can relist it.',
      '/listing/' || new.listing_id, null, null);
  elsif new.status = 'cancelled' then
    for bidder in select distinct b.bidder_id from bids b where b.auction_id = new.id loop
      perform public.notify(bidder, 'auction',
        'Auction cancelled — ' || li.title,
        coalesce(new.cancel_reason, ''), '/listing/' || new.listing_id, null, null);
    end loop;
  end if;
  return new;
end;
$$;

create trigger auctions_notify_end
  after update of status on public.auctions
  for each row execute function public.notify_auction_end();

-- ---------------------------------------------------------------------------
-- Reviews
-- ---------------------------------------------------------------------------

create or replace function public.notify_review()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.notify(new.reviewee_id, 'review',
    public.handle_of(new.reviewer_id) || ' left you a ' || new.rating || '-star review',
    left(new.body, 140), '/reviews', new.reviewer_id, null);
  return new;
end;
$$;

create trigger reviews_notify
  after insert on public.reviews
  for each row execute function public.notify_review();

-- ---------------------------------------------------------------------------
-- Listings: the watchlist and moderation
-- ---------------------------------------------------------------------------

create or replace function public.notify_listing_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  by_admin boolean := current_setting('app.admin_action', true) = '1';
  watcher uuid;
begin
  if by_admin and new.status is distinct from old.status
     and new.status in ('removed', 'active') then
    perform public.notify(new.seller_id, 'moderation',
      case when new.status = 'removed' then 'A moderator removed your listing'
           else 'A moderator restored your listing' end,
      new.title, '/listing/' || new.id, null, null);
  end if;
  if new.status = 'sold' and old.status <> 'sold' then
    for watcher in select f.user_id from favorites f where f.listing_id = new.id loop
      perform public.notify(watcher, 'watch',
        'Sold — ' || new.title, 'A card on your watchlist found a buyer.',
        '/listing/' || new.id, new.seller_id, null);
    end loop;
  elsif new.status = 'active' and new.price < old.price then
    for watcher in select f.user_id from favorites f where f.listing_id = new.id loop
      perform public.notify(watcher, 'watch',
        'Price drop — ' || new.title,
        'Now ' || to_char(new.price, 'FM999,999,990') || ' ' || new.currency
          || ', was ' || to_char(old.price, 'FM999,999,990'),
        '/listing/' || new.id, new.seller_id, 'price:' || new.id);
    end loop;
  end if;
  return new;
end;
$$;

create trigger listings_notify_change
  after update of status, price on public.listings
  for each row execute function public.notify_listing_change();

-- Realtime pushes new rows to the bell; RLS keeps each person to theirs.
do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception when others then
  null;
end
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- END supabase/migrations/0024_notifications.sql
-- ──────────────────────────────────────────────────────────────────────────
