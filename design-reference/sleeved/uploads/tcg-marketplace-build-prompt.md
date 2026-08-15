# BUILD PROMPT — "Sleeved" TCG Marketplace

> Autonomous build spec. Work through the milestones in order. Commit at every checkpoint.
> Do not stop to ask questions unless a milestone's acceptance criteria are genuinely
> impossible to satisfy — make a reasonable choice, write it in `DECISIONS.md`, and continue.

---

## 0. What this is

A peer-to-peer **trading card game marketplace**. Users list cards they own, other users
browse and message them, and the two parties arrange the deal themselves.

**The platform never touches money.** No checkout, no cart, no Stripe, no escrow, no
payout ledger, no order state machine. The product is: listings + discovery + a live chat
between buyer and seller. Everything else is out of scope and adding it is a spec violation.

Positioning line used throughout the UI: *"We connect collectors. You handle the deal."*

**Target user:** collectors and players trading singles, sealed product and graded slabs
across Pokémon, Magic: The Gathering, Yu-Gi-Oh!, One Piece, Lorcana, Digimon and sports cards.

**The page's single job:** get a buyer from "I want that card" to "I'm talking to the person
who has it" in as few screens as possible.

---

## 1. Hard constraints

| # | Constraint |
|---|---|
| 1 | **No payment processing of any kind.** No card fields, no wallets, no crypto, no "buy now" button. The primary CTA on every listing is **Message seller**. |
| 2 | **All content is user-uploaded.** No scraped catalogues, no bundled card images, no third-party card database calls. Card metadata is typed by the seller; card photos are uploaded by the seller. |
| 3 | **Live chat is a core feature, not a bolt-on.** Realtime, persistent, per-listing threads. |
| 4 | Prices are **asking prices** — indicative labels on a listing, never a transactable amount. Wording is "Asking" or "Open to offers", never "Price" or "Total". |
| 5 | Ship a **`MOCK=1` mode** that runs the entire front end against local fixtures with zero backend, zero auth and zero network. Every screen must be reachable in mock mode. |
| 6 | No component library that imposes its own look (no MUI, Chakra, DaisyUI, shadcn defaults left unstyled). Tailwind + hand-built primitives only. |
| 7 | Responsive down to 360px. Keyboard-navigable. `prefers-reduced-motion` respected. |

---

## 2. Stack

- **Next.js 15** (App Router, TypeScript strict, React Server Components where they help)
- **Tailwind CSS v4** with a hand-authored token layer (see §4)
- **Supabase** — Postgres, Auth (email magic link + Google OAuth), Storage (listing images),
  Realtime (chat)
- **Zod** for every form and every API boundary
- **`@tanstack/react-query`** for client-side data that mutates (chat, watchlist, offers)
- **Vercel** for hosting; Supabase project provisioned separately
- No CSS-in-JS runtime. No Redux. No tRPC. No ORM beyond `supabase-js` typed with generated types.

Run `supabase gen types typescript` into `src/lib/database.types.ts` after every migration.

---

## 3. Design references — read this before writing any UI

Three reference images define the visual direction. Follow them; do not "improve" them into
a generic SaaS layout.

### 3.1 Reference A — the hero (`header_example.jpeg`)
Dark, near-black stage. The whole page sits on a **rounded dark slab** floating over a darker
backdrop, with a faint horizon curve and starfield behind it. A thin nav bar at the top:
wordmark left, plain uppercase nav links centre, active link in the accent colour with a small
tab indicator above it, then a search icon and a **pill-shaped accent CTA** right.

Headline is **huge, wide, uppercase, tightly-set display type with a soft outer glow**, split
across two lines, with the second half of the phrase in a **gradient fill**. One muted
two-line subhead under it, centred.

Below the headline: a **fanned row of cards in perspective** — outer cards rotated away and
scaled down, centre card upright, larger, elevated, with a spotlight under it. The centre card
carries a floating **artist chip** at the top (avatar + name) and a **bottom bar** with a label,
a value, and a `MORE →` link.

**Take from it:** the dark stage, the glow display type, the gradient accent on the second
phrase, the nav treatment, and — most importantly — **the perspective card fan as the hero
signature**.

### 3.2 Reference B — listing cards (`cards_design.jpeg`)
Neo-brutalist product cards on a dotted grid. Each card is a **flat corner-radiused tile with a
vertical gradient fill** in one of two variants — **acid yellow-green** or **cool graphite** —
with the product photo bleeding into the top two thirds and an **icon button in the top-right
corner**. Text block at the bottom: a tiny uppercase letterspaced **category eyebrow**, a
**two-line bold title**, and a **one-line muted description**. Heading font is a squarish
geometric with very tight tracking, all uppercase for the section title with a rule under it.

**Take from it:** the two-variant card system (acid / graphite), the corner icon button, the
eyebrow → title → one-liner text stack, the dotted grid ground, the tight uppercase section
headings with an underline rule.

### 3.3 Reference C — trending sellers & listings (`seller_and_popular_listing_section.webp`)
A horizontally-scrollable **featured strip** at the top with circular arrow controls overlapping
the edges. Under it a section titled *"Trending seller & artworks"* laid out as **one narrow
left column + a grid of listing cards on the right**. The left column is a **ranked list**:
number, avatar, name, and a right-aligned figure per row, with a `See more →` link at the
bottom. The listing cards have a **header row above the image** (seller handle left, a small
like-count pill right), the image, then the title, then a **two-column footer** — a labelled
figure on the left, a labelled countdown on the right.

**Take from it:** the arrow-controlled featured carousel, the ranked-seller column beside a
card grid, the seller-handle-above-image card header, the like pill, and the two-column
labelled card footer.

### 3.4 How the three merge

One dark theme. Reference B's cards are light-mode; translate them into the dark stage rather
than switching the page background — the **acid variant stays acid** (it becomes the accent
punctuation on a dark grid) and the **graphite variant becomes a dark slate tile**. Roughly one
in four cards in any grid uses the acid variant, chosen deterministically from the listing id so
it's stable across renders.

Reference C's countdown footer becomes **"Listed"** (relative time) since there are no auctions.
Reference C's bid figure becomes the **asking price**. Reference A's artist chip becomes the
**seller chip**.

---

## 4. Design tokens

Author these as CSS custom properties in `src/app/globals.css` under `@theme`. Every colour and
size in the app references a token — no raw hex in components.

### Colour

```
--ink-900   #08090B   page backdrop (outside the slab)
--ink-800   #0E1013   the slab / page surface
--ink-700   #16191E   raised panels, nav, chat bubbles (theirs)
--ink-600   #1F242B   card graphite variant top
--ink-500   #2A3038   card graphite variant bottom, hairlines
--fog-400   #7B8590   muted body text, labels
--fog-200   #B9C2CC   secondary text
--paper     #F2F5F7   primary text on dark
--acid      #D6FF3F   primary accent: CTAs, active nav, acid card fill
--acid-deep #9BC400   acid gradient end, pressed states
--violet    #7B5CFF   gradient stop 1 (hero headline, seller-rank badges)
--cyan      #35E4FF   gradient stop 2
--rose      #FF5C8A   gradient stop 3, destructive/report actions
```

Ink on acid surfaces is `--ink-900`, never white. The violet→cyan→rose gradient appears in
**exactly two places**: the second line of the hero headline, and the rank-1 seller badge. Do not
sprinkle it.

### Type

Load via `next/font/google`, subset latin, `display: swap`.

- **Display** — `Chakra Petch` 700, uppercase, `letter-spacing: -0.02em`. Hero headline, section
  headings, card titles. The squarish techy face is what makes references A and B feel like the
  same product.
- **Body** — `Inter` 400/500/600. Everything conversational: descriptions, chat, forms.
- **Utility** — `JetBrains Mono` 500, uppercase, `letter-spacing: 0.12em`, 11px. Eyebrows,
  category labels, prices, rank numbers, timestamps. This is the "trading floor" texture.

Scale: `11 / 13 / 15 / 18 / 22 / 28 / 40 / 64 / 88`. Hero clamps `clamp(40px, 8vw, 88px)`.

### Form

- Radii: `8px` inputs, `14px` panels, `20px` cards, `28px` the page slab, `999px` pills.
- Card shadow: `0 18px 40px -20px rgb(0 0 0 / 0.8)`. Acid cards additionally get
  `0 0 60px -30px var(--acid)`.
- Hairline: `1px solid --ink-500`.
- Dot grid: 1px `--ink-500` dots on a 24px lattice at 40% opacity, used on section
  backgrounds behind card grids only.
- Focus ring: `2px --acid` at `2px` offset. Always visible, never removed.

### Motion

- Card hover: `translateY(-4px)` + shadow bloom, 180ms `cubic-bezier(.2,.8,.2,1)`.
- Hero fan: cards settle into place on load in a 600ms staggered sequence (outer → centre),
  then the centre card breathes on a 6s loop. Both suppressed under `prefers-reduced-motion`.
- Chat messages: 120ms fade + 6px rise on arrival. Nothing else animates in chat.

**The signature element** is the hero card fan built from real listings: the five most recently
listed cards, in perspective, with the centre one live-linked to its listing. It is the only
elaborate thing on the page. Everything else stays flat and quiet.

---

## 5. Routes

```
/                         Home — hero fan, featured carousel, trending sellers + grid
/browse                   Full grid with filter rail
/listing/[id]             Listing detail
/sell                     Create listing (multi-step)
/sell/[id]/edit           Edit listing
/u/[handle]               Public seller profile
/messages                 Inbox (two-pane; single-pane on mobile)
/messages/[conversationId]  Thread
/watchlist                Saved listings
/settings                 Profile, handle, avatar, region, notification prefs
/safety                   How trading here works + scam guidance (static)
/auth/callback            Supabase auth handler
```

---

## 6. Data model

Postgres. Write as numbered migrations in `supabase/migrations/`. **RLS on every table, no
exceptions.**

```sql
profiles
  id uuid pk references auth.users
  handle citext unique not null            -- 3-20 chars, [a-z0-9_]
  display_name text not null
  avatar_url text
  bio text
  region text                              -- free text, e.g. "Beirut, LB"
  ships_to text[]                          -- ISO country codes, empty = local only
  created_at timestamptz default now()
  last_seen_at timestamptz

listings
  id uuid pk default gen_random_uuid()
  seller_id uuid not null references profiles on delete cascade
  title text not null                      -- 4-80 chars
  game game_enum not null                  -- pokemon|mtg|yugioh|onepiece|lorcana|digimon|sports|other
  card_name text not null
  set_name text
  card_number text
  rarity text
  language text default 'EN'
  finish finish_enum default 'normal'      -- normal|foil|reverse_holo|etched|first_edition
  condition condition_enum                 -- nm|lp|mp|hp|dmg|sealed   (null when graded)
  grader grader_enum                       -- psa|bgs|cgc|sgc|ace|none
  grade numeric(3,1)                       -- 1.0-10.0, null unless graded
  quantity int not null default 1 check (quantity between 1 and 999)
  asking_price numeric(10,2)               -- null => "Open to offers"
  currency char(3) not null default 'USD'
  trade_only boolean default false
  description text                         -- max 1200 chars
  status listing_status not null default 'active'   -- active|reserved|closed|removed
  view_count int default 0
  created_at, updated_at timestamptz

listing_images
  id uuid pk
  listing_id uuid references listings on delete cascade
  path text not null                       -- Supabase Storage path
  position int not null                    -- 0 is the cover
  width int, height int, blurhash text

watchlist            (user_id, listing_id) composite pk, created_at
listing_reports      id, listing_id, reporter_id, reason_enum, detail, created_at, resolved_at

conversations
  id uuid pk
  listing_id uuid references listings on delete set null
  buyer_id uuid references profiles
  seller_id uuid references profiles
  last_message_at timestamptz
  buyer_archived boolean default false
  seller_archived boolean default false
  unique (listing_id, buyer_id)

messages
  id uuid pk
  conversation_id uuid references conversations on delete cascade
  sender_id uuid references profiles
  kind message_kind not null default 'text'   -- text|image|offer|system
  body text
  image_path text
  offer_amount numeric(10,2)                  -- non-binding, display only
  offer_currency char(3)
  offer_state offer_state                     -- proposed|accepted|declined|withdrawn
  read_at timestamptz
  created_at timestamptz default now()

deal_confirmations                            -- both sides tick "we did the deal"
  conversation_id uuid references conversations
  user_id uuid, confirmed_at timestamptz, primary key (conversation_id, user_id)

seller_reviews
  id uuid pk, conversation_id uuid unique, reviewer_id, subject_id uuid
  rating smallint check (rating between 1 and 5), body text, created_at
  -- only insertable when a deal_confirmation exists from both sides

blocks              (blocker_id, blocked_id) composite pk
```

### RLS policy summary

- `listings`: `select` where `status = 'active'` for anyone; full CRUD to `seller_id = auth.uid()`.
- `conversations` / `messages`: `select`/`insert` only where `auth.uid()` is buyer or seller.
  A user in `blocks` either direction can't insert.
- `messages.update` only for setting `read_at` on messages you *didn't* send, and for the
  sender changing `offer_state` to `withdrawn`.
- `profiles`: public `select` of non-sensitive columns via a view; `update` self only.
- Storage bucket `listing-images`: public read, authenticated write restricted to
  `{auth.uid()}/…` path prefix.

### Trending sellers

A materialised view `trending_sellers` refreshed every 15 minutes by a `pg_cron` job:

```
score = 3.0 * confirmed_deals_30d
      + 2.0 * avg_rating_30d
      + 1.0 * ln(1 + active_listings)
      + 1.5 * median_response_within_24h_rate
      - 4.0 * upheld_reports_90d
```

Expose the top 6 with rank, handle, avatar, and `active_listings` (the figure shown on the
right of each row, matching reference C's layout).

---

## 7. Feature specs

### 7.1 Auth
Magic link + Google. On first sign-in, force `/settings` to claim a handle before any write
action. Session in httpOnly cookies via `@supabase/ssr`. No password auth.

### 7.2 Create listing — `/sell`
Four steps, progress shown as a mono step counter (`01 / 04`), state kept in a single Zod-validated
form object, draft autosaved to `localStorage` so a refresh doesn't lose work.

1. **Photos** — drag-drop or picker, 1–8 images, client-side resize to max 1600px long edge and
   convert to WebP before upload, reorder by drag, first is the cover. Compute a blurhash for
   each. Reject >10MB pre-compression.
2. **The card** — game (segmented control), card name, set, number, rarity, language, finish.
   Then a **Graded / Ungraded** toggle: graded reveals grader + grade; ungraded reveals the
   condition scale as six labelled radio tiles (`NM LP MP HP DMG SEALED`) each with a one-line
   plain-English definition under it.
3. **The deal** — quantity, asking price + currency, or tick **Open to offers** (nulls the price),
   or tick **Trade only**. Region and ships-to prefill from the profile.
4. **Review** — renders the actual listing card as it will appear in the grid, plus a
   non-dismissable notice: *"Sleeved doesn't handle payment or shipping. You'll arrange both
   directly with the buyer in chat."* Publish button reads **Publish listing**; the resulting
   toast reads **Published**.

### 7.3 Browse — `/browse`
Left filter rail (drawer on mobile): game, condition/grade, price range, finish, language,
trade-only, ships-to-my-region, seller has ≥1 review. Sort: newest, price asc/desc, most watched.
Search hits `card_name`, `set_name`, `title` via a Postgres `tsvector` column with a GIN index.
URL is the source of truth — every filter is a query param, back button works, links are shareable.
Cursor pagination (`created_at`, `id`), infinite scroll with a manual **Load more** fallback.
Empty state: *"No cards match these filters. Try widening the price range or clearing the set."*
with a **Clear filters** button.

### 7.4 Listing detail — `/listing/[id]`
Gallery left (main image + thumb strip, click to zoom, arrow-key navigable), details right:
title, mono price line, a **spec table** of the card metadata (only rows with values), the
description, then a sticky **seller panel** — avatar, handle, rank badge if they're in the top 6,
member-since, response rate, review count and average, region, ships-to.

Primary CTA **Message seller** (opens/creates the conversation and routes to it). Secondary:
**Watch** (the corner icon button from reference B, filled when active) and **Report**.
Below: "More from this seller" (4 cards) and "Similar cards" (same game + card name fuzzy match).

Own-listing view swaps the CTA for **Edit** / **Mark reserved** / **Close listing**.

### 7.5 Live chat — the important one

**Inbox `/messages`:** two panes on ≥1024px, stacked with a back button below. Conversation
rows show the other party's avatar, handle, the listing's cover thumbnail, the last message
snippet, relative time, and an unread dot in `--acid`. Filters: All / Buying / Selling / Archived.

**Thread `/messages/[id]`:** pinned context header at the top showing the listing thumbnail,
title, asking price and status, linking back to the listing. If the listing is closed, the header
shows a `--fog-400` strip: *"This listing is closed."*

Message composer supports:
- **Text** — max 2000 chars, `Enter` sends, `Shift+Enter` newline, mobile always uses the button.
- **Image** — same pipeline as listing photos, max 4MB, one at a time.
- **Offer** — a small form producing an `offer` message: amount + currency + optional note.
  Renders as a distinct acid-bordered bubble with **Accept** / **Decline** buttons for the
  recipient. Accepting sets `offer_state='accepted'` and posts a `system` message:
  *"Offer accepted. Arrange payment and delivery between yourselves — Sleeved isn't involved
  in the transaction."* **Accepting transfers no money and creates no order.**

Realtime: subscribe to `postgres_changes` on `messages` filtered by `conversation_id`.
Typing indicator and presence via a Realtime **broadcast** channel (ephemeral, never persisted).
Optimistic send with a pending state and a **Retry** affordance on failure. Mark-as-read fires
when the thread is focused and the message is scrolled into view.

Below the composer, permanently: a hairline safety strip linking to `/safety` —
*"Never send payment before you've agreed terms. [How to trade safely]"*

**Deliberately allowed:** users exchanging phone numbers, emails and payment handles. That is
the entire point of the product. Do not build contact-info scrubbing.

**Rate limits:** 30 messages/minute/user, 200 images/day/user, enforced in a Postgres trigger,
surfaced as a plain error: *"You're sending messages too quickly. Wait a minute and try again."*

### 7.6 Deal confirmation & reviews
Either party can tick **We completed this deal** in the thread header menu. When both have,
a review prompt appears for each. Reviews are one per conversation, 1–5 stars plus optional text,
and are what feed the trending-seller score. There is no dispute system — `/safety` says so
plainly.

### 7.7 Moderation
Report a listing, a message, or a user. Reports write to `listing_reports` and a Slack/email
webhook if `MODERATION_WEBHOOK_URL` is set. Blocking hides both parties' listings from each other
and blocks new conversations. A `service_role` admin script (`scripts/moderate.ts`) can set
`status='removed'` — no admin UI in scope.

---

## 8. Mock mode

`MOCK=1 npm run dev` (and `NEXT_PUBLIC_MOCK=1` for the client) swaps the entire data layer for
`src/lib/mock/`:

- `fixtures.ts` — 48 listings across all games, 12 profiles, 6 conversations with 8–30 messages
  each, watchlist entries, and a populated trending-seller table. Deterministic, seeded RNG so
  screenshots are stable.
- Placeholder card images are **generated procedurally at build time** into `public/mock/` —
  a small script that renders gradient-and-glyph card faces to WebP via `sharp`. **Do not commit
  or fetch real card artwork.**
- Chat in mock mode runs off an in-memory event bus with a scripted 1.5s "reply" so the realtime
  UI can be exercised without Supabase.
- Auth in mock mode signs you in as `@mockuser` instantly; `/settings` is fully editable in memory.

The data layer is a single interface in `src/lib/data/index.ts` that dispatches to either
`supabase.ts` or `mock.ts`. Components import only from that interface — they never import
`supabase-js` directly.

---

## 9. Milestones

Commit at each checkpoint with the given message. Run `npm run typecheck && npm run lint &&
npm run test` before every commit; all three must pass.

### M0 — Foundation
Next.js + TS strict + Tailwind v4 scaffold. Tokens from §4 in `globals.css`. Fonts wired.
Primitives built and rendered on a `/kitchen-sink` route (dev-only): `Button` (accent/ghost/
danger), `Pill`, `Input`, `Select`, `SegmentedControl`, `Tile`, `Avatar`, `Eyebrow`, `Panel`,
`Modal`, `Toast`, `Skeleton`, `EmptyState`, `DotGrid`.
**Accept:** `/kitchen-sink` shows every primitive in every state including focus and disabled;
no raw hex outside `globals.css` (enforced by an eslint rule).
`git commit -m "M0: scaffold, design tokens, UI primitives"`

### M1 — Card system & static home
`ListingCard` in both variants (acid / graphite) per reference B, with the reference C header row
and two-column footer. `SellerRankRow`. `FeaturedCarousel` with the overlapping circular arrows,
scroll-snap, and keyboard support. `HeroFan` — the perspective card fan with the load sequence.
Home page assembled against fixtures.
**Accept:** home renders at 360 / 768 / 1440px with no layout shift; hero fan animates once on
load and is static under `prefers-reduced-motion`; `npm run build` clean.
`git commit -m "M1: listing cards, hero fan, static home"`

### M2 — Backend & mock parity
Supabase project, migrations for every table in §6, RLS policies, generated types, seed script.
The `src/lib/data` interface with both implementations. Home now reads through the interface.
**Accept:** `MOCK=1 npm run dev` and the live-Supabase run render an identical home page.
RLS verified by a test suite that attempts cross-user reads and writes and expects failures.
`git commit -m "M2: schema, RLS, data layer with mock parity"`

### M3 — Auth & profiles
Magic link + Google, `@supabase/ssr` cookie session, handle claim gate, `/settings`, `/u/[handle]`.
**Accept:** full sign-up → claim handle → edit profile → sign-out → sign-in loop works; protected
routes redirect; a user cannot claim a taken handle or write another user's profile.
`git commit -m "M3: auth, handle claim, profiles"`

### M4 — Listings
`/sell` four-step flow with image pipeline and draft autosave, `/sell/[id]/edit`,
`/listing/[id]`, status transitions.
**Accept:** publish a listing with 5 images from a phone-sized viewport; images stored as WebP
≤1600px; refreshing mid-flow restores the draft; a second user can view it but not edit it.
`git commit -m "M4: listing creation, detail page, image pipeline"`

### M5 — Browse
Filter rail, URL-as-state, full-text search with the GIN index, sorting, cursor pagination,
watchlist.
**Accept:** every filter round-trips through the URL and survives a hard refresh and the back
button; search returns results in <300ms on 5k seeded rows; empty and loading states present.
`git commit -m "M5: browse, filters, search, watchlist"`

### M6 — Chat
Conversations, inbox, thread, realtime subscription, presence + typing, offers, read receipts,
optimistic send with retry, rate limits.
**Accept:** two browser profiles exchange text, image and offer messages with <1s delivery;
unread counts are correct across reloads; offline send queues and retries; accepting an offer
posts the system message and moves no money anywhere.
`git commit -m "M6: realtime chat, offers, presence"`

### M7 — Reputation & safety
Deal confirmations, reviews, `trending_sellers` view + cron, rank badges, reports, blocking,
`/safety` page.
**Accept:** the trending column on home is driven by the view, not fixtures; a blocked user
cannot open a conversation; a review can only be left after mutual confirmation.
`git commit -m "M7: reviews, trending sellers, reports, blocking"`

### M8 — Ship
Metadata and OG images per listing, `sitemap.xml`, `robots.txt`, 404/500 pages in the house
style, error boundaries, Lighthouse pass, `README.md` + `DECISIONS.md`, Vercel deploy.
**Accept:** Lighthouse ≥90 performance / ≥95 accessibility on `/` and `/browse` (mobile preset);
LCP <2.5s on Fast 3G; axe-core reports zero serious violations; production deploy live with a
working end-to-end flow.
`git commit -m "M8: SEO, error handling, a11y pass, production deploy"`

---

## 10. Copy rules

The interface voice is a shop owner who knows the hobby: plain, specific, never salesy.

- Buttons name the action and keep the name through the flow: **Publish listing** → toast
  **Published**. **Message seller** → thread. Never "Submit", never "Learn more".
- Errors say what happened and what to do: *"That handle is taken. Try another."* Not
  *"An error occurred."* Errors never apologise.
- Empty states are invitations: `/watchlist` empty reads *"Nothing saved yet. Tap the bookmark
  on any listing to keep an eye on it."*
- Sentence case everywhere except mono utility labels, which are uppercase.
- Say "card", "seller", "listing", "message". Never "item", "vendor", "SKU", "inventory", "order",
  "transaction", "checkout".

---

## 11. Quality bar

- **Accessibility** — semantic landmarks, one `h1` per page, alt text on every listing image
  (fall back to `"{card_name} — {set_name}, {condition}"`), chat as an `aria-live="polite"`
  log, modals trap focus and restore it on close, all interactive targets ≥44px on touch.
- **Performance** — `next/image` with blurhash placeholders everywhere, route-level code
  splitting, no client component larger than it needs to be, listing grid virtualised past
  100 items, fonts preloaded and `display: swap`.
- **Testing** — Vitest for the data layer, Zod schemas and the trending score; Playwright for
  three flows: publish a listing, message a seller, filter and search. Playwright runs in
  `MOCK=1` so CI needs no Supabase.
- **Errors** — every route has an `error.tsx`; failed mutations surface a toast with a retry,
  never a silent failure.

---

## 12. Out of scope — do not build

Payments, carts, checkout, escrow, invoices, shipping labels, tracking numbers, order status,
refunds, disputes, admin dashboards, card price history or market data, automatic card
recognition, collection management, deck building, mobile apps, email newsletters, referral
programs, or anything that would require the platform to hold funds or take custody of a card.

If a feature would make the platform a party to the transaction, it is out of scope.

---

## 13. Definition of done

- [ ] Every route in §5 exists and works signed-in, signed-out and in `MOCK=1`
- [ ] Two users can go listing → chat → offer → mutual confirmation → review end to end
- [ ] The word "checkout", "cart", "payment method" or "order" appears nowhere in the UI
- [ ] Hero fan, acid/graphite card system, arrow carousel and ranked seller column all match
      the three reference images
- [ ] RLS test suite passes; no table is readable or writable beyond its policy
- [ ] Lighthouse and axe thresholds in M8 met
- [ ] `README.md` documents setup, env vars, migrations, mock mode and deploy
- [ ] `DECISIONS.md` lists every judgement call made without asking
