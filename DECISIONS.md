# LebanonTCG — Decisions log

Running log of product/engineering decisions made while building, newest last.

## M1 — Foundation

- **Design references arrived as chat-attached images, not files.** The brief
  says references live in `./design-reference/`, but the repo was empty; the
  three reference images were attached to the brief itself. Extracted tokens
  from those images and recorded a textual description of each in
  `design-reference/README.md` so the traceability chain survives.
- **Name: Cardpost → LebanonTCG.** The brief titled the project "CARDPOST";
  the owner's review renamed it **LebanonTCG** (see the R1 redesign round
  below). Seed data leans into Beirut-flavored users/locations without
  hardcoding any locale logic.
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
  A new/reloaded tab asks existing tabs for a state snapshot over the
  channel, so reloading one tab doesn't fork the world; state only resets
  when every tab is closed.
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
- **Listing visibility widened slightly vs. the brief's letter.** "Publicly
  readable when active" is the browse rule; at the SQL layer sold/reserved
  rows stay readable (browse filters them out) because conversations,
  favorites, and reviews all need to keep rendering their subject after a
  sale. `removed` rows are hidden from everyone except the seller and
  existing conversation partners.
- **Verification without a live project:** this environment has no Supabase
  credentials, so the M6 checkpoint was run against a local Postgres 16
  cluster with a small shim for `auth`/`storage`/roles
  (see TESTING.md → M6): all 7 migrations apply cleanly, and a 27-step RLS
  test exercises username immutability, foreign-row protection, forged
  senders, read-receipt column grants, review gating + rating rollup,
  terminal `sold`, block enforcement, and anon visibility. The
  `SupabaseMarketplaceClient` compiles against the same domain interface as
  the mock; first-run verification against a real hosted project follows
  the TESTING.md M6 script.
- **Search uses `ilike` terms ANDed across title/set_name** (same semantics
  as the mock's predicate) rather than Postgres full-text search — simpler,
  language-agnostic for card names, and fine at marketplace scale. Swap for
  `tsvector` later if listings grow past ~100k.
- **Demo seed ships without photos** (Storage can't be seeded from SQL);
  the app's designed no-photo state covers it.

## M7 — Hardening

- **Stress seed:** `VITE_MOCK_STRESS=1000` env flag makes MockClient
  generate N synthetic listings on top of the curated 40 — used for the
  browse-perf pass (lazy images + content-visibility on cards).
- **Synthetic listings share bucketed procedural covers** (~20 per game)
  instead of unique per-listing art: drawing 1,000+ unique canvases caused
  measurable main-thread jank; after bucketing, a 1,034-listing browse
  session shows zero >100 ms long tasks during fast scrolling and filter
  switches take ~0.5 s (half of which is the mock's simulated latency).
- **Dependency: playwright (dev-only)** — drives the pre-installed Chromium
  for milestone checkpoint verification (screenshots + scripted two-tab
  chat flows). Not part of the app bundle.
- **Anti-drift audit automated ad hoc:** `grep -rn "#\|rgba(" src
  --include="*.css" | grep -v tokens.css` returns nothing — every color in
  component CSS flows through the token file.

## R1 — Design review round (owner feedback)

- **Renamed to LebanonTCG** across UI, docs, package metadata, meta tags,
  mock storage keys, and demo seed emails.
- **New governing reference (R4).** The owner supplied a purple "NVC"
  marketplace hero and asked for the site to match it: violet gradient
  field with light rays, floating segmented pill nav, sentence-case hero
  with white→translucent gradient text, glassy cards with avatar headers
  and coin+stat-pill price rows, white pill CTAs. The token file was
  rebuilt around it; green/lime demoted to status/condition semantics.
  The stretched-caps display voice from the first round was retired.
- **Auto-scrolling carousel** on the home page (explicit request): a
  duplicated-track marquee (~42s loop) of the newest active listings,
  pausing on hover/focus, edge-faded, degrading to a plain scrollable row
  under `prefers-reduced-motion` (the aria-hidden clone is display:none
  there and inert always, so keyboard/AT users never traverse it twice).
- **Flag-card logo (R5).** The supplied Lebanese-flag trading-card gif is
  recreated as an inline SVG (`FlagLogo`) — gold slab border, red bands,
  cedar — with a recurring CSS holo-shine sweep standing in for the gif
  animation (no binary assets, works at any size, animates the favicon's
  static twin). Flag red doubles as the unread/favorite accent.
- **Listing cards adopt R4 anatomy** (seller avatar + @handle header,
  rounded inner media, coin mark + white price + dark condition pill),
  which also surfaces the seller identity that used to require opening
  the detail page.

## R2 — "Sleeved" design component port (owner template)

- **The owner supplied their own Claude design component** (checked into
  `design-reference/sleeved/`) and asked for the site to match it exactly
  with the mocked features wired for real. The entire UI was rebuilt on
  its system (see DESIGN-NOTES.md): framed shell, Chakra/Inter/JetBrains
  Mono (all @fontsource, self-hosted), acid-lime accent, hash-picked acid
  cards, per-id hue "nebula" faces for photo-less listings, and the 3D
  fan hero with the component's exact transform math. The animated flag
  gif ships from the component's own assets as the header logo.
- **Route split:** the landing page is now the designed Home (hero, fan,
  featured strip, trending); the filterable grid moved to /browse
  (sidebar layout). URL-encoded filter state unchanged, plus rated=1
  (seller has reviews) and sort=most_watched.
- **Mocked features wired for real:**
  - *Offers* — kind='offer' messages with amount + proposed/accepted/
    declined state. Recipient-only accept/decline (RLS: column grant on
    offer_status, state machine + acceptance system-message via trigger;
    migration 0008, RLS tests T28-T32).
  - *Likes / watch counts* — favorites aggregated per listing. RLS hides
    who favorites what, so counts come from an owner-rights listing_likes
    view (T33-T34). Watch star = the favorite toggle; "Most watched"
    sort orders by the counts.
  - *Sellers pages* — real ranking (review count, rating, live
    inventory) with per-seller stats and games derived from their active
    listings; the design's unmodeled region/reply-rate fields became
    real Deals (sold count) and member-since.
  - *Typing indicator* — BroadcastChannel in mock, Supabase realtime
    broadcast on the conversation channel in live mode, throttled to one
    ping per 2s, auto-clearing after 3s.
  - *"We completed this deal"* — the thread-header confirm is the
    existing mark-sold transition; review prompts follow as before.
  - *Toasts* — the component's acid toast pill, driven by real actions
    (watch, offers, publish, deal confirmed, errors).
- **SEALED condition tile from the template was dropped** (not in the
  condition model); the five real grades keep the tile treatment with
  plain-language descriptions.
- **Glyph faces are the fallback, photos are the truth.** The template
  renders letter-glyph nebulas; real listings render their cover photo in
  the same frame, and photo-less listings get the nebula so the grid
  still reads exactly like the reference.

## Deploy round — Vercel + Supabase hookup

- **SPA fallback** (`vercel.json` rewrite to index.html) fixes direct
  deep-link 404s on the deployed domain.
- **Public Supabase credentials are baked as fallbacks**
  (`src/lib/config.ts`): Vercel's git builds don't read committed .env
  files, so the deployed bundle silently stayed in mock mode. The project
  URL + publishable key are public by design (RLS protects the data;
  they're in the public repo already), so they now ship as defaults with
  environment variables taking precedence. Mode resolution:
  `VITE_MOCK=1` → mock, `VITE_MOCK=0` → live, unset → live when
  credentials resolve. `npm run dev:mock` stays fully offline;
  unit-tested in `src/lib/config.test.ts`.

## R3 — Post-auth onboarding + first-load resilience

- **Account setup moved to a dedicated `/welcome` page.** After the
  magic-link confirm, a signed-in user without a username is routed there
  by an AppShell gate (every route except `/welcome` redirects) and
  claims the permanent @handle, display name, photo and bio in one form.
  The old inline claim step on `/signin` became a redirect.
- **Profile self-heal** (`0009_profile_selfheal.sql` + client): accounts
  created before the schema was applied have no `profiles` row (the auth
  trigger didn't exist yet), which used to break the whole app after
  sign-in. The client now inserts the missing row (display name = email
  prefix) under a new "insert own profile" RLS policy — RLS tests
  T35/T36 cover it.
- **Avatars reuse the `listing-images` bucket** at
  `{uid}/avatar-{ts}.jpg` instead of a second bucket: the existing
  storage policies already scope writes to the caller's own folder, and
  one bucket keeps the storage story simple. Uploads are compressed
  client-side to a 512px long edge; a failed avatar upload never fails
  onboarding (profile first, photo later in Settings).
- **Home page failures now name their cause.** Only the main listings
  query is fatal — featured/top-sellers degrade to empty sections — and
  the error state prints the underlying message, with a specific hint
  when it looks like the schema was never applied ("relation … does not
  exist" → run `supabase/apply-all.sql`).

## R4 — Passwords, review hub, home grid fix

- **Email + password is now the everyday sign-in**, with the magic link
  demoted to a fallback. Sign-up sends one confirmation email; after that
  no inbox trip is needed. Password reset uses Supabase's reset email and
  lands on `/set-password`.
- **Policy lives in one pure module** (`src/lib/password.ts`, 18 unit
  tests): 10+ characters, lower + upper + digit, plus rejections for
  over-72-byte (bcrypt truncation), common passwords, single repeated
  characters, and passwords containing the email's local part. The
  sign-up form, set-password page and Settings all consume the same
  functions, so the rules can't drift between screens.
- **"Has this account got a password?" rides in auth user metadata**
  (`has_password`) rather than a profiles column. It gates a UI prompt
  only — worst case a user who edits their own metadata skips a prompt —
  and it avoids a migration plus an extra round-trip on every sign-in.
  `AuthState.needsPassword` exposes it; the AppShell runs two ordered
  gates: set a password, then claim a username.
- **The mock client models the whole flow offline**: an in-memory
  credential store (`password: null` = magic-link account that still
  needs one), sign-up, password sign-in, and a mock magic link that signs
  in immediately. The Dev switcher stays a full bypass (no gates) so
  two-tab chat testing is unaffected. The header's Sign in link is no
  longer hidden in mock mode, since the form now works there.
- **Home's trending grid took `items.slice(7, 15)`** — the fan carousel
  claimed the first 7 — so any marketplace with fewer than 8 listings
  showed "Nothing else listed yet" no matter how many cards existed. The
  grid now falls back to the full newest set when there's no remainder;
  the empty state is reserved for a genuinely empty marketplace.
- **Reviews existed but were invisible.** The data layer (post-sale, one
  review per party per conversation, RLS-enforced) was only surfaced
  inside a sold chat thread. Added a `/reviews` hub (trades awaiting a
  rating, received, written), a pending count in AppContext refreshed off
  the same inbox signal that carries deal confirmations, a badge in the
  user menu, and a home banner after a deal closes. No schema change —
  `getReviewsWritten` reads the existing publicly-readable table.
