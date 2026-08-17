# LebanonTCG — Manual test script

Run the relevant sections at every milestone checkpoint. Mock mode first
(`npm run dev:mock`); the same script must pass in live mode (`VITE_MOCK=0`)
after M6, with the noted differences.

Unit tests: `npm test` (filter/search query building, listing status
transition rules, message grouping/timestamp logic, image compression
sizing math).

## M1 — Foundation

1. `npm run dev:mock`, open http://localhost:5173 → app boots on the designed Home
   (framed shell, gif logo, mono nav, fan carousel auto-advancing every
   5s, featured strip, trending sellers & cards), no console errors.
2. Header shows the dashed **Dev** switcher (mock only). Pick “Maya Haddad”
   → avatar appears; menu shows profile/listings/settings/sign-out.
3. Switch to “Karim Nassar” → identity changes instantly, survives reload
   (per-tab).
4. Open a second tab, pick a different user → both tabs keep their own
   identity.
5. Visit each nav route (Browse, Sell, Chat, Favorites) plus /safety and a
   bogus URL → every route renders inside the shell; bogus URL shows the
   styled 404.
6. Narrow the window under 760 px → nav collapses into the burger menu and
   everything stays usable.

## M2 — Listings read path

1. /browse shows the sidebar (game + condition pills, price min/max,
   finish/language, graded-only, seller-has-reviews) and the card grid:
   seller dot + @handle, like count, watch star, mono eyebrow (game · set
   · grade), Chakra title, one-liner, Asking/Listed, Message seller CTA;
   every ~4th card is the acid variant.
2. Type “charizard” in search → grid narrows after a beat (debounce);
   clearing restores. The `q=` appears in the URL.
3. Filter by game=Pokémon + condition=NM → results intersect; “Filters (2)”
   chip count matches; URL carries `games=`/`cond=`.
4. Set price range 50–200, sort by price ascending → order is correct,
   ties stable.
5. Toggle “Graded only” → only slab-badged listings remain.
6. Copy the URL into a fresh tab → identical results (shareable state).
7. Click “Load more” until exhausted → count line reads “Showing N of N”.
8. Open a listing → gallery (arrows + thumbs + counter), full metadata,
   seller card with rating and member-since, price, Message seller CTA,
   favorite toggle, report link.
9. Toggle favorite from the card grid and the detail page → heart fills;
   Favorites page lists it; un-favoriting removes it live.
10. Open one of your own listings (as Maya, l-001) → seller controls
    (Edit / Reserve / Sold / Remove) replace the Message CTA.
11. Signed out (Dev switcher → Sign out): favorite/message actions prompt
    to sign in; browse still works.

## M3 — Listings write path

1. As Karim, Sell → form renders with sections: card details, condition &
   grade, price, photos, description.
2. Submit empty → inline errors on required fields, focus moves to first
   error, nothing saved.
3. Fill a valid Pokémon listing, add 3 photos (any large JPEG/PNG) →
   thumbnails appear; files over 1600 px come back compressed (check the
   preview dimensions in devtools network/no request — object URLs).
4. Reorder photos by dragging; also via the ←/→ buttons on each thumb;
   first thumb is marked “Cover”.
5. Save → detail page shows everything entered; grid shows the new card
   with its uploaded cover.
6. Edit the listing: change price, remove a photo, save → changes stick.
7. My listings: tabs All/Active/Reserved/Sold/Removed with counts; the new
   listing is under Active.
8. Mark it Reserved → amber badge everywhere (grid hides it? no — reserved
   stays visible on browse? Reserved listings leave the browse grid: verify
   it disappears from Browse but stays on My listings + detail).
9. Mark it Sold → leaves Browse, badge flips, seller controls collapse to
   status display.
10. Remove another own listing → status Removed, “Relist” restores it to
    Active and it reappears on Browse.
11. Try a forbidden transition by URL/devtools (e.g. sold → active) → client
    rejects with a clear error.

## M4 — Chat

1. Tab A = Maya, tab B = Karim. As Karim, open Maya’s Charizard listing →
   “Message seller” → thread opens with the listing pinned at top (cover,
   title, price, status badge).
2. Send a message in B → appears instantly with a pending clock, then
   clears to a timestamp (simulated delay); appears in A within ~1 s
   without reload.
3. Unread badge on the Chat nav item in A increments; conversation row
   shows bold preview + count; opening the thread clears both and B sees
   “Seen” on its last message.
4. Conversation list rows show: other party, listing thumb + price, last
   message preview, relative time, unread badge.
5. Messages group: consecutive same-sender messages within 5 min share one
   cluster; date dividers between days; timestamps on cluster ends.
6. Scroll up in a long thread, receive a message → “New messages” pill
   appears instead of yanking scroll; clicking it jumps down.
7. As Maya (seller), from the thread’s pinned header mark the listing
   Reserved “for this conversation” → system message appears in both tabs
   live and the pinned header badge flips to Reserved.
8. Mark Sold → same live propagation; the buyer now sees the review
   prompt (M5).
9. Composer: Enter sends, Shift+Enter newlines, 2000-char limit with
   counter near the end, empty sends blocked.

## M5 — Trust layer

1. After the M4 sale, both tabs show “Rate this trade” in the thread; each
   submits stars + text once — the form then locks (“You reviewed this
   trade”).
2. Maya’s profile (/u/mayapulls) shows the new review, updated average and
   count, active listings, member-since.
3. Report a listing (detail page → Report) → reason picker + free text →
   confirmation. Report a user from their profile. Report a message via its
   ⋯ menu.
4. As Karim, block Lina from her profile → Lina can no longer open a
   conversation on Karim’s listings (CTA blocked with explanation), and
   composers in existing threads between them are disabled both ways.
   Unblock → messaging works again.
5. /safety renders the Safe trading tips page; every chat thread links to
   it above the composer.

## M6 — Supabase (live mode)

Setup per README (project, migrations, seed, .env, redirect URL).

> Checkpoint status: this repo's M6 checkpoint was verified against a local
> Postgres 16 with Supabase shims — all migrations apply in order and a
> 27-step RLS suite passes (see `supabase/` and the commands below). Run
> the click-through below the first time a real hosted project is wired up.
>
> ```bash
> # local RLS verification (repeatable):
> initdb + pg_ctl a scratch cluster, then:
> psql -f <shim: auth schema/uid(), storage schema, roles, publication>
> for f in supabase/migrations/*.sql; do psql -f "$f"; done
> psql -f supabase/seed.sql
> ```

1. `VITE_MOCK=0 npm run dev` → no Dev switcher; Sign in page offers email
   magic link. Complete sign-in from the email → username claim screen
   (rejects taken/invalid names) → lands signed-in.
2. Re-run the full M2–M5 script against live data with two browsers (or a
   private window) as two different accounts. Expected differences: data
   persists across reloads; magic-link auth replaces the Dev switcher;
   images upload to Storage (public URLs).
3. RLS spot-checks from SQL editor / a third anon session:
   - anon can `select` active listings but not removed ones;
   - a signed-in user cannot `update` another seller’s listing;
   - a user not in a conversation cannot `select` its messages;
   - a blocked user’s `open_conversation` RPC fails.

## M7 — Hardening

> Checkpoint status: items 1, 3, 4 (skip link, Esc-to-close, filter panel
> keyboard), 5 (390 px pass over browse/detail/chat/sell/profile/safety —
> no horizontal overflow anywhere), and 6 (meta/OG in index.html, lazy
> images) were verified with scripted browser runs; re-run by hand when
> anything in those areas changes. Measured stress numbers: 1,034 listings,
> 0 long tasks >100 ms during fast scroll, ~0.5 s filter switches.

1. Stress: `VITE_MOCK=1 VITE_MOCK_STRESS=1000 npm run dev` → Browse stays
   smooth while scrolling/filtering (images lazy-load, no layout thrash).
2. Kill the network (devtools offline) in live mode → pages show error
   states with retry, not blank screens.
3. Empty states: fresh user with no favorites/conversations/listings sees
   designed empties with CTAs.
4. Keyboard-only pass: tab through browse → filters → card → detail →
   message seller → send a message. Focus always visible, menus close on
   Esc, skip-link works.
5. Phone-width (390 px) pass over every screen; chat especially: composer
   stays above the keyboard, pinned header stays visible.
6. Lighthouse quick pass: images lazy, meta/OG tags present.


## R2 — Offers, likes, sellers (design-component features)

1. Two tabs (Maya = seller, Karim = buyer) on the Charizard thread: Maya
   sees Accept/Decline on Karim's seeded $300 offer; Karim doesn't.
2. Karim types → Maya sees "@karim_tcg is typing…" within ~2s; it clears
   a few seconds after he stops.
3. Maya accepts → both tabs flip the offer to "Offer accepted" and the
   system message ("…LebanonTCG is not involved…") appears live.
4. $ toggle → amount + note → Send offer → appears in both tabs; Decline
   propagates the same way; settled offers show no buttons.
5. "We completed this deal" (seller) → listing sold, "Deal confirmed"
   chip, review prompts in both tabs.
6. Watch star on any card → toast, like count reflects it after reload
   (aggregate is anonymous); "Most watched" sort puts liked cards first.
7. /sellers ranks the three seeded users (Maya #1 by reviews); each card
   opens the profile with rank chip, stats, games derived from live
   listings, and Message seller opening a conversation on their newest
   active listing.
8. Sell wizard: step gating (no photos → error on Continue), condition
   tiles, live preview card on Review, publish → detail + toast.


## R3 — Onboarding + post-sign-in recovery

Automated (headless Chromium against a mock build with a seeded user's
username temporarily nulled): home renders → dev-switch to that user →
gate lands on /welcome → display name prefilled → taken handle shows the
inline error → fresh handle + bio submits → home + welcome toast → header
menu shows the new @handle → revisiting /welcome renders the form again
while the username is missing.

Manual (live mode):
1. Sign in with a brand-new email → confirm the magic link → you land on
   /welcome (not an error page). Every nav link bounces back to /welcome
   until the handle is claimed.
2. Claim a handle that exists → inline "That username is taken."; claim a
   fresh one with photo + bio → home, and the photo shows in the header.
3. Avatar upload failing (e.g. storage bucket missing) only toasts —
   the account still completes; add the photo later in Settings.
4. An account created BEFORE the schema was applied gets its profile row
   self-created on next sign-in (0009 policy) and goes through the same
   /welcome flow.
5. If the schema was never applied, the home error state now prints the
   real cause (e.g. `relation "public.listings" does not exist`) and
   points at supabase/apply-all.sql.


## R4 — Passwords, reviews hub, trending grid

Automated (headless Chromium, mock build — 20 assertions in one run):
trending grid renders cards with a small inventory and no empty panel;
sign-up rejects a weak password (live checklist) and a mismatched
confirmation, then completes into onboarding; sign out and sign back in
with email + password; a wrong password is rejected and offers the
email-link fallback; a magic-link account is forced to `/set-password`
and the gate blocks other routes until it's set; confirming a deal shows
the thread prompt, badges the user menu, lists the trade in `/reviews`,
submits from the hub, and clears the home banner.

Manual (live mode):
1. Create account → confirm the email → `/welcome` → home. Sign out and
   back in with the password only (no inbox).
2. An account created before this round: sign in with the email link →
   prompted to set a password → next sign-in works with the password.
3. Forgot password → reset email → `/set-password` → new password works.
4. Settings → Password: change it, then re-sign-in with the new one.
5. Confirm a deal in chat: both buyer and seller see the trade in
   `/reviews`, each can rate once, ratings land on the profile and move
   the sellers board.
6. With only a couple of listings live, the home grid shows them instead
   of the empty state.


## R5 — Reviews are buyer → seller

Automated (headless Chromium, mock build — 12 assertions): the seller
confirms a deal and is NOT shown a review prompt and NOT told "You
reviewed this trade" (they see "@buyer can now rate this trade"), gets no
pending-review badge and an empty `/reviews` queue; the buyer gets the
badge, the prompt and the queue entry, submits a rating, and is then told
"You reviewed this trade"; back on the seller side the thread reads
"@buyer rated this trade".

RLS (local Postgres 16, `supabase/dev/rls-test.sql`): 22 true, 0 false,
including T18 (buyer's review accepted) and the new T37 (seller's review
of the buyer rejected by policy). Migrations 0001–0010 plus
`apply-all.sql` apply cleanly on a fresh database.

Manual (live mode): confirm a deal as the seller — the thread should say
the buyer can rate it, never that you reviewed it; the rating only
appears once the buyer submits.


## R6 — Listing photo zoom

Automated (headless Chromium, desktop + iPhone 13 emulation — 17
assertions): the photo is marked zoomable; hovering scales it and the
zoom origin follows the cursor; leaving resets it; click opens the
viewer and the viewer covers the header (nothing behind stays
clickable); clicking the photo zooms, dragging pans, clicking again
zooms out; clicking any empty space — beside the photo, the top bar, the
hint strip — closes, while the photo, the arrows and a pan that ends off
the photo do not; Esc closes; Enter opens it from the keyboard; body scroll is
locked while open and released on close. On touch: the hint is visible,
no hover zoom is applied, tap opens the viewer, tapping outside the photo
closes it and so does the close button.

Manual:
1. Desktop: hover across the photo — the zoom should track the cursor,
   not jump. Open the viewer, drag while zoomed, release: it must stay
   zoomed.
2. Multi-photo listing: arrows and ←/→ move between photos; on a phone,
   swipe does the same and the counter tracks it.
3. Phone: the photo should not zoom on touch-and-hold; tapping opens the
   viewer, and pinch works inside it.


## R7 — Custom cursors

Unit (`src/lib/busyCursor.test.ts`, 7 tests): the spinner stays hidden
for calls that finish inside the grace period, appears once one outlives
it, steps through every frame and wraps, honours the minimum visible
time, reference-counts concurrent calls, doesn't blink between
back-to-back calls, and clears after a rejected promise.

Automated browser (headless Chromium, desktop + iPhone 13 — 16
assertions): Link is the default — served at 48x48 with the 32px
original as fallback (hotspots 8 0 / 5 0) — and is used by nav links,
buttons and cards rather than the system pointer; pressing swaps to Move
(48px, hotspot 23 23) and releasing swaps back; each busy frame resolves to a
distinct spinner image and applies over cards as well as the page;
clearing the attribute restores Link; text inputs keep the caret; touch
devices get no custom cursor.

Manual: load a slow page (throttle the network) — the spinner should
appear after a beat, animate smoothly, and clear without flicker. Press
and hold anywhere for the Move hand.


## R8 — Interaction pass

Automated (headless Chromium, desktop + iPhone 13 — 17 assertions): the
hovered fan card tilts and the tilt follows the cursor; the photo
counter-shifts; the tilt clears off-hover; dragging the fan advances it
without navigating; no card is permanently acid; strip and grid cards
flood acid on hover with ink-flipped titles and return to idle; mouse
drag scrolls the strip with snap suspended mid-drag, settles on a card,
and never opens a listing; the mobile Top Sellers panel spans the same
width as the cards below it.

Manual: hover a fan card and circle the cursor — the card should tilt
toward it smoothly and settle back when you leave. Flick the fan on a
phone. Drag the featured strip with the mouse; release mid-card and it
should glide to the next card, not snap back.


## R9 — Hover-acid visibility, pinned cards, mobile navbar

Automated (headless Chromium, desktop + iPhone 13 — 29 assertions): all
of R8 plus occlusion checks (`elementFromPoint` at the title and price
centres must resolve to the text, not the overlay — the check that would
have caught the R8 regression), exactly one pinned strip card (newest)
and a likes-gated pinned grid card, both with the breathing-glow
animation and readable text; the mobile header hides the List-a-card CTA
and keeps search, the burger sits off the edge, and the burger menu
contains a working List a card button.

Four more assertions cover clipping: the strip scrollport leaves ≥40px
of glow clearance above and below the cards, the phone has no horizontal
overflow, and the sign-in button sits fully inside the viewport.

Manual: hover any card — every line of text must stay readable on the
acid. The pinned cards should glow gently at rest with the halo visible
on all four sides (not sliced flat by the strip), and read identically
to a hovered card.
