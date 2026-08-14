# Cardpost — Decisions log

Running log of product/engineering decisions made while building, newest last.

## M1 — Foundation

- **Design references arrived as chat-attached images, not files.** The brief
  says references live in `./design-reference/`, but the repo was empty; the
  three reference images were attached to the brief itself. Extracted tokens
  from those images and recorded a textual description of each in
  `design-reference/README.md` so the traceability chain survives.
- **Name: Cardpost.** The brief titles the project "CARDPOST"; repo name
  (`lebanontcg`) suggests a Lebanon-focused TCG market, so seed data leans
  into Beirut-flavored users/locations without hardcoding any locale logic.
- **Plain CSS files with component prefixes, not CSS Modules.** All values
  come from `src/styles/tokens.css`; prefixes (`shell-`, `uswitch-`, …) keep
  scoping honest without build tooling. One shared `ui.css` holds the
  recurring reference patterns (pills, chips, slab labels, badges).
- **Fonts self-hosted via @fontsource-variable/archivo** (npm package, no
  CDN — the brief bans external services). One variable family with a width
  axis covers both the stretched display voice and body text.
- **Dependency: react-router-dom** — standard client routing; URL-encoded
  filter state is a core requirement and the router owns search params.
- **Dependency: @supabase/supabase-js** — required by the brief for live mode.
- **Dependency: vitest** — required by the brief for unit tests.
- **Mock auth is per-tab (sessionStorage), mock data is cross-tab
  (BroadcastChannel).** Two tabs can be signed in as two different users while
  sharing one in-memory world — exactly what two-party chat testing needs.
  State resets on full reload of all tabs; that's acceptable for a dev tool
  and keeps the mock dead simple.
- **Client factory is async (`createClient()`)** so the Supabase SDK is only
  ever loaded (dynamic import) in live mode; mock mode ships zero Supabase
  bytes to the browser.
- **Listing lifecycle:** `sold` is terminal (reviews and conversations hang
  off it, un-selling would corrupt trust data); `removed` can be relisted to
  `active`. Encoded in `src/lib/status.ts` and enforced in both clients.
- **Procedural images:** mock listings use `mock-card://game/seed/finish/cond`
  storage paths rendered to canvas data-URLs on demand (game color coding,
  foil sheen for holo finishes, wear specks for HP/DMG) — no downloaded
  images anywhere.

## M2 — Listings read path

- **Paged "Load more" instead of infinite scroll.** A visible button plus a
  count ("Showing 24 of 61") keeps the footer reachable, plays nicer with
  keyboard/screen-reader users, and makes the 1,000-listing stress case
  predictable. Page size 24 (divisible by 2/3/4-column grids).
- **Filter state lives in the URL only** (`useSearchParams`); the Browse page
  derives everything from it, so links are shareable and back/forward work.
  Text search debounces 300 ms before touching the URL (replace, not push,
  to avoid history spam).

## M3 — Listings write path

- **Single-page form, not a wizard.** The references favor dense, direct
  surfaces; a wizard adds steps without adding clarity for ~12 fields.
  Sections are visually grouped (card details / condition & grade / price /
  photos / description).
- **Image compression:** canvas re-encode to JPEG q0.85, long edge capped at
  1600 px (`src/lib/image.ts`, unit-tested sizing math). EXIF orientation is
  handled by `createImageBitmap` with `imageOrientation: 'from-image'`.
- **Reordering via drag with keyboard fallback** (move left/right buttons on
  each thumb) — drag-only reorder is an a11y dead end.

## M4 — Chat

- **Optimistic sends reconcile by `clientId`.** The sender renders the
  message immediately with a pending clock; when the client's send resolves
  (or the same clientId arrives via the realtime channel), pending clears.
- **Read receipts are per-message `read_at`,** set in bulk when the reader
  has the thread open and focused. The sender sees "Seen" on the last read
  own-message.
- **System messages** (status changes) are rows in `messages` with
  `kind='system'` and empty sender — they replicate through the exact same
  realtime path as user messages, so both parties see them live.

## M5 — Trust layer

- **Reviews unlock only when the listing is `sold`** and are unique per
  (conversation, reviewer) — one review each for buyer and seller, enforced
  in the client APIs and by a DB unique constraint in M6.
- **Blocks are directional rows but enforced symmetrically** (either
  direction blocks messaging both ways), matching the brief.
- **Reports are fire-and-forget** from the reporter's perspective (no
  moderation UI in scope).

## M6 — Supabase

- **Migrations are hand-written SQL** under `supabase/migrations/`, one file
  per concern, each table's RLS in the same file as the table. Enums are
  Postgres enums; `updated_at` via trigger.
- **Profile ratings are a view-backed pair of columns** maintained by
  trigger on `reviews` (denormalized onto `profiles` for cheap listing-card
  reads).
- **Username claim enforced with a partial unique index on
  `lower(username)`** plus an UPDATE trigger that rejects changing a
  non-null username (immutability).
- **Storage:** one public-read bucket `listing-images` with per-user folder
  write policies (`{uid}/...`); avatars share the same bucket under
  `avatars/{uid}`.
- **Conversation open uses an RPC** (`open_conversation`) so the
  buyer-side insert can atomically check blocks + listing state server-side.
- **Realtime:** Postgres Changes on `messages` + `listings` filtered per
  conversation/listing id; no presence channels (unread counts derive from
  `read_at`).

## M7 — Hardening

- **Stress seed:** `VITE_MOCK_STRESS=1000` env flag makes MockClient
  generate N synthetic listings on top of the curated 40 — used for the
  browse-perf pass (lazy images + content-visibility on cards).
