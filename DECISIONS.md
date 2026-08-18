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

## R5 — Reviews run buyer → seller

- **Reviews are the buyer's verdict on the seller** (migration 0010
  replaces 0005's both-directions insert policy). The rating feeds the
  seller's profile score and the sellers board, which is what a review is
  for here; sellers no longer rate buyers back. Existing rows are left
  alone and stay readable. Enforced in three places: RLS (T37),
  `submitReview` in both clients, and `getPendingReviews` (buyer side
  only).
- **"You reviewed this trade" was inferred from an empty pending list**,
  so anyone who wasn't eligible — every seller — was told they had
  reviewed. The thread now derives its state from a review that actually
  exists: the buyer sees prompt → "You reviewed this trade", the seller
  sees "@buyer can now rate this trade" → "@buyer rated this trade".
  Absence of a pending review never again means "done".
- **Dev harness fixes found while verifying**: `local-shim.sql` now
  creates its roles only when missing (roles are cluster-wide, so a
  second run used to die half-applied), and T01 counts only its own two
  fixture profiles so the suite passes with or without `seed.sql`
  loaded in the same database.

## R6 — Listing photo zoom

- **Two zoom affordances, split by input device.** Pointer devices get a
  hover zoom on the listing photo (2×, `transform-origin` tracking the
  cursor so the point under the pointer stays put) behind
  `@media (hover: hover) and (pointer: fine)`; touch gets nothing on
  hover and opens the viewer on tap instead, where pinch and drag do the
  job better. Click/tap/Enter opens a full-screen viewer on every device.
- **The viewer is a portal.** `.shell-main` is `position: relative;
  z-index: 1`, which makes it a stacking context — an in-page modal
  renders *beneath* the sticky header no matter how high its z-index, and
  the nav stays clickable over it. Both the photo viewer and the existing
  report dialog now render through `createPortal` into `document.body`.
  (The report dialog had shipped with this defect.)
- **Empty space closes the viewer.** The first cut only closed on
  `e.target === e.currentTarget`, but the space around the photo belongs
  to the grid children (stage, bar, hint), so most "outside" clicks did
  nothing. The handler now closes unless the click landed on the photo or
  a control, and the backdrop carries `cursor: zoom-out` to say so.
- **A pan must not toggle the zoom.** Releasing a drag fires a click on
  the image, which would zoom straight back out; a 4px movement threshold
  marks the gesture as a drag and swallows that click — including when
  the pan ends off the photo, where it would otherwise read as a
  click on the backdrop and close the viewer.
- No new dependency: the viewer is ~150 lines over pointer events
  (mouse, pen and touch in one path) plus a touch-swipe handler for
  moving between photos.

## R7 — Custom cursors (owner's Windows cursor set)

- **The supplied files are the source of truth**, kept in
  `src/assets/cursors/source/` (Link.cur, Move.cur, Busy.ani) with
  `convert.py` turning them into web assets — no external tooling, stdlib
  only, so the pipeline is reproducible.
- **PNG ships, not .cur/.ani.** Safari ignores `.cur`, and no browser
  animates `.ani`. Each cursor carries four copies at 32/8/4/1 bpp; the
  converter picks the 32-bit one (the 1-bit copy is a black-and-white
  stencil). Hotspots come out of the CUR directory entries: (5, 0) for
  Link, (15, 15) for Move and Busy.
- **Link and Move ship at 48px** — the .cur files only carry 32px art,
  so the converter upscales nearest-neighbour (crisp pixel edges, no
  blur) and scales the hotspots to (8, 0) / (23, 23). The 32px original
  stays second in the cursor fallback chain for any browser that rejects
  the larger image. Busy stays 32px so the spinner doesn't dominate.
- **Mapping:** Link is the default everywhere, Move covers pressing and
  dragging (`:active`, `[data-dragging]`, `[aria-grabbed]`), Busy runs
  while data is in flight.
- **The busy cursor animates by stepping an attribute.** CSS can't
  animate `cursor`, so the 15-frame ANI becomes 12 PNGs and
  `src/lib/busyCursor.ts` writes `data-busy="<frame>"` on `<html>` every
  33ms (the ANI's own rate: 2 jiffies at 60Hz), with one CSS rule per
  frame.
- **One integration point for "loading":** `createClient()` wraps the
  client in a Proxy that brackets every promise-returning method with
  the busy counter, so all data access raises the spinner without page
  code having to opt in. A 150ms grace period keeps fast calls from
  strobing the cursor and a 300ms minimum keeps it from flashing once
  shown; back-to-back calls hold it steady rather than blinking.
- **Unchanged on purpose:** text fields keep the caret, disabled controls
  keep `not-allowed`, and everything sits behind
  `@media (hover: hover) and (pointer: fine)` so touch devices are
  untouched. Component-level `cursor:` rules were converted to the shared
  variables rather than overridden, since a plain `cursor: pointer`
  outranks a global `html` rule.

## R8 — Interaction pass: parallax fan, hover-acid, draggable strip

- **The fan reacts to the cursor.** The hovered card gets a parallax
  tilt: rotateX/rotateY follow the pointer (±10°/±14°) and the photo
  counter-shifts a few pixels, so the card reads as a physical object
  under the hand. The fan's own settle animation is 950ms; the tilt and
  a live drag override to a 130ms transition so they track the pointer,
  then the slow ease returns. Skipped under prefers-reduced-motion.
- **The fan slides by drag/swipe** (pointer events, so mouse and touch
  share one path): the whole fan follows the hand live, and release
  steps one card per ~140px in the drag direction. `touch-action:
  pan-y` keeps vertical page scrolling intact on phones, and the click
  that ends a drag is swallowed so dragging never opens a listing.
- **Acid is now the hover/press state, not a lottery.** The hash-picked
  permanent acid cards (grid + featured strip) are gone; instead any
  card floods acid on hover/focus/press. Gradients can't be transitioned,
  so a gradient overlay (::before) fades in and the ink-flip colors
  transition alongside — text and positioned children already paint
  above a sibling pseudo-element's background, so the markup didn't
  change. On touch there is no hover; the :active flash on tap is the
  "click state".
- **The featured strip drag-scrolls with the mouse** (touch already
  scrolled natively). Two traps found: the hook must bind after the strip
  mounts (it renders behind the data load, and a ref change alone never
  re-runs an effect — hence the `enabled` flag), and mandatory
  scroll-snap rewinds any drag shorter than half a card the moment it's
  re-enabled — so snap is suspended during the drag and the hook settles
  to the next card in the drag direction itself before restoring it.
- **Top Sellers matches the column width on phones** — the desktop
  `max-width: 320px` cap was leaking into the stacked layout and read as
  stray right padding.

## R9 — Hover-acid visibility fix, pinned acid cards, mobile navbar

- **Scroll containers clip shadows.** The featured strip is an
  overflow-x scroller, so the breathing glow and the hover lift painted
  past the cards and got sliced flat at the strip's edges. The scrollport
  now carries 48px block padding (negative margins keep the layout
  unchanged, `scroll-padding` keeps the snap points aligned) so glows
  render inside it. The suite asserts the clearance geometry.
- **The phone header overflowed when signed out** — burger + logo +
  search + Sign in didn't fit 390px and the button clipped at the edge.
  Everything shrinks a notch under 640px and the dev switcher collapses
  to its dot; asserted as "no horizontal overflow" plus the sign-in
  button's right edge inside the viewport.

- **The R8 hover-acid overlay covered the card text.** The overlay is
  absolutely positioned, and positioned boxes paint above static text —
  the automated pass had only checked computed colors and overlay
  opacity, not what actually painted on top. Fixed by isolating a
  stacking context on the card and giving the overlay `z-index: -1`
  (above the card's own background, below everything in it). The suite
  now asserts occlusion with `elementFromPoint` at the title's centre.
- **Two cards earn permanent acid**, each with a slow breathing glow
  (3.2s box-shadow animation, off under prefers-reduced-motion): the
  newest listing in the featured strip and the most-liked card in the
  trending grid (no pin when every card is at zero likes). The pinned
  class simply joins the hover selector lists, so pinned and hovered
  render identically.
- **Mobile header slimmed to search + profile.** The acid "List a card"
  CTA moved into the burger menu as a full-width button, the search
  button is back on phones, and the burger got breathing room from the
  edge. One trap: ui.css loads after appshell.css, so hiding the header
  CTA needed a two-class selector — `.btn-acid { display: inline-flex }`
  wins a specificity tie against a bare `.shell-sell { display: none }`.

## R10 — Glow clipping, properly this time

- Round one gave the strip scrollport 48px of clearance — but the glow's
  visible extent (blur + spread) was ~64px, so it still died on a hard
  line, just further out. The real constraint surfaced on the horizontal
  axis: the app frame is `overflow: hidden`, so no amount of scrollport
  padding buys more than `--pad-x` (28px) of room before the frame edge
  becomes the next hard line.
- Resolution: clearance where it's free (72px vertically) and glow sized
  to the room that exists — breathing peak `0 0 30px -4px` (26px extent)
  and hover glow `0 0 48px -26px` (22px), both fading to nothing before
  any clipping boundary.
- Verification moved to pixels: the suite screenshots the real page,
  decodes the PNG (stdlib zlib + unfilter), and asserts the brightness
  profile above, below and beside the pinned card is a smooth gradient —
  a clip shows as a >6-step jump between adjacent rows. The two style
  passes that "verified" earlier rounds could not see this class of bug.

## R11 — Fan card legibility on phones

- The fan card's desktop clamp bottomed out at 150px on phones, which
  made the info panel unreadable. Under 640px the fan renders fewer,
  larger cards (~57vw, min 205px) on a taller stage.
- The info panel slimmed down to what matters at that size: title,
  seller, bare price (the "Asking" label dropped — the number speaks for
  itself), and a bottom row with "More →" on the left and the listing
  age on the right.

## R12 — In-chat review prompt driven by one query

- The buyer's 5-star prompt under "Seller marked this listing as sold"
  never appeared in production. The chat derived its review state from
  `getPendingReviews()` + `getReviewsWritten()` — two broad, multi-embed
  queries — and swallowed their failures into an empty array, which reads
  as "nothing to review". Any live-only failure in those embeds silently
  hid the whole review system.
- The chat now asks one join-free question: `getConversationReviews(id)`
  (reviews are publicly readable under RLS, so the failure surface is
  minimal). On a sold listing the buyer is *always* eligible — the only
  unknown is whether their review already exists — so buyer state is
  `done`/`pending` and seller state `buyer_rated`/`awaiting_buyer`
  straight off that one row. On a fetch error the chat fails open
  (prompt shown, warning logged as `[reviews]`) instead of hiding it.
- A `system` message arriving now also refetches the conversation, so the
  pinned listing's `sold` status — and the prompt keyed off it — appears
  mid-conversation even if the separate `listing_updated` realtime event
  is dropped.
- `SupabaseClient.getPendingReviews` now throws on query errors instead
  of ignoring them: the /reviews hub shows its error state and the badge
  catches, rather than everything quietly rendering as "nothing pending".

## R13 — Fan cards clickable again

- R8's drag support called `setPointerCapture` on the stage on every
  pointerdown. Capture retargets not just pointer events but the
  compatibility `click` too, so the click landed on the stage instead of
  the card — plain clicks stopped opening listings entirely.
- Capture now starts only in pointermove, once movement crosses the 8px
  drag threshold. An untouched click never gets captured; a real drag
  still tracks the pointer outside the stage.
- Drag-ending clicks are swallowed by a ref set at pointerup (the old
  check read `dragRef` from the click handler, but pointerup had already
  nulled it — dead code that leaked navigations in browsers that don't
  retarget clicks after capture).

## R14 — Crop step for every picked photo

- Every image the user picks — profile photo (onboarding and the new
  Settings "Change photo") and each listing photo — now goes through a
  crop dialog before upload: drag to position, zoom by wheel / pinch /
  slider, with a bordered frame marking exactly what gets saved and
  everything outside it dimmed.
- Frame shapes: avatars crop square (with a dashed circular guide,
  since the site renders them round); listing photos crop to the 5:7
  trading-card shape the site displays everywhere (fan hero, card
  faces) — a literal square would chop the top and bottom off card
  photos. Outputs: 512² avatars, 1140×1596 listing photos (inside the
  1600px cap), JPEG q0.85 — the cropper replaces the old blind
  compress-on-add path.
- Geometry lives in a pure module (`src/lib/crop.ts`: cover scale,
  offset clamping, source-rect, cursor-anchored zoom) with unit tests;
  the component decodes once into a master canvas (EXIF-corrected) that
  both the preview and the final crop read from, so what you frame is
  what you get. Zoom math runs outside React state updaters (StrictMode
  would double-apply it) via live refs.
- Settings finally honours the onboarding toast's "add it later in
  Settings": the profile section gained Add/Change photo.

## R15 — Listing crops go free-form

- The 5:7 card frame felt too constraining for listing photos. Free
  mode shows the whole image fitted in the stage with a resizable
  selection on top — eight corner/edge handles, drag inside to move,
  clamped to the image with a minimum size — so the seller crops
  exactly the area they want in any shape. Avatars keep the fixed
  square frame (that aspect is structural: they render round at 1:1).
- The selection lives in image coordinates (stable across viewport
  resizes); handle/move geometry is pure and unit-tested (moveRect /
  resizeRect in crop.ts). Output keeps the selection's own shape,
  long edge capped at 1600px.

## G0–G6 — Pre-Grade estimator

- Adapted the pre-grade spec to this stack: pure engine modules in
  src/lib/pregrade (not Next.js paths), a Vercel serverless function
  for the model call (the SPA has no server), migration 0011, and the
  MarketplaceClient abstraction so VITE_MOCK=1 runs the entire flow
  with canned assessments and the REAL centering engine.
- Design for abstention throughout: quality gates reject bad shots with
  reasons; the model contract is validated, retried once with the
  precise failure, then abstained — a confident wrong number on an
  expensive card is the worst outcome this feature can produce.
- Centering is arithmetic, and tested like it: sub-pixel contrast-peak
  edge refinement landed the engine within ±1.5% of ground truth across
  50 generated cards (incl. dark stock and keystoned shots, where the
  fixture pushes the inner rect through the same homography so truth
  survives projective correction).
- The eval harness caught real overconfidence: a vintage base-9 was
  recommended 'submit' at high confidence while its own band said 50%
  chance of ≤8. Recommendation now respects the band's downside
  (submit only when P(8)+P(≤7) < 0.35), and the false-confident rate on
  the fixture set is 0%.
- Separation from real slabs is enforced from both ends: the DB
  constraint makes a grade value without a grading company impossible,
  and leak.test.ts greps every pre-grade module (comments included) for
  the slab column names.
- Publishing is opt-in per listing and gated by an aHash perceptual
  match between the report's front capture and the listing cover, so a
  report can't be attached to a different card's listing.
- Probabilities are labelled priors until scripts/calibrate.mjs
  replaces them with measured hit rates (≥10 outcomes per bucket,
  human-reviewed diff, never auto-applied); reports show the measured
  track record once a bucket has ≥30 outcomes.

## G7 — Real-photo hardening of the capture flow

First real-world use (a card back) hit both "couldn't find the card's
outline" and a false "camera's at an angle". Three causes, three fixes:
- The outline fit's outlier window scaled with the coordinate value, so
  on a phone photo's far edges it was ±100px — shadow hits survived,
  skewed the fit, and the skew read as keystone. Rejection now scales
  with the spread of the hits (median absolute deviation) plus a
  residual re-fit pass; the outline scan runs denser (32 lines over a
  wider band) with a looser contrast floor, because dark card backs on
  dark tables sit under the old threshold.
- Every capture now goes through the free-form crop dialog first
  (opens with the full photo selected — two taps to skip). Cropping to
  the card strips the background clutter that confuses the detector AND
  gives the vision model cleaner inputs. Crops keep 2400px detail.
- Detector-driven rejections (perspective, no-card, resolution) hold
  the shot and offer "Use anyway" — the centering step corrects
  perspective by hand regardless, so the detector being wrong must
  never dead-end the user. Overrides drop the report's confidence out
  of 'high' (wired through to the estimate; it was hardcoded before).
  Blur, glare, and non-raking light stay hard failures — nothing
  downstream can fix those. Raking slots now report "light isn't
  raking" before "blurry" (the actionable message), and the blur floor
  gained headroom for the crop re-encode.
