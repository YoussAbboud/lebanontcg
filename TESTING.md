# LebanonTCG — Manual test script

Run the relevant sections at every milestone checkpoint. Mock mode first
(`npm run dev:mock`); the same script must pass in live mode (`VITE_MOCK=0`)
after M6, with the noted differences.

Unit tests: `npm test` (filter/search query building, listing status
transition rules, message grouping/timestamp logic, image compression
sizing math).

## M1 — Foundation

1. `npm run dev:mock`, open http://localhost:5173 → app boots on the Home
   route with the LebanonTCG header (flag logo, pill nav, hero, auto-scrolling carousel), no console errors.
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

1. Home shows the hero + auto-scrolling featured rail (pauses on hover);
   below it the seeded grid (~35 active listings) with seller header, cover
   image, game label + dot, title, condition pill, slab badge on graded
   cards, white price with coin mark.
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
8. Mark Sold → same live propagation; both parties now see the review
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
