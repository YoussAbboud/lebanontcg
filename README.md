# LebanonTCG

Lebanon's peer-to-peer trading card marketplace. Sellers list cards, buyers browse
and search, and the two parties negotiate and arrange the transaction
themselves through built-in live chat. **There are no payments in the app**
— LebanonTCG is the venue, the chat is the transaction layer.

- Frontend: Vite + React + TypeScript, plain CSS transcribed from the
  owner's "Sleeved" design component (`design-reference/sleeved/`,
  tokens in `src/styles/tokens.css`, mapping in `DESIGN-NOTES.md`).
- Backend: Supabase (Postgres + Auth + Storage + Realtime) — or a fully
  offline mock.

## Quick start (mock mode — zero config)

```bash
npm install
npm run dev:mock       # or: VITE_MOCK=1 npm run dev
```

Open http://localhost:5173. You're in mock mode:

- All data is in-memory, seeded with 3 users, ~40 listings, and 2 active
  conversations. No network, no credentials.
- Use the dashed **Dev: …** switcher in the header to sign in instantly as
  any seeded user.
- To test chat between two parties, open **two tabs** and pick a different
  user in each — tabs share one mock world via BroadcastChannel, and
  message delivery is artificially delayed a little so you can see
  pending/delivered states.
- Card images and avatars are drawn procedurally on canvas (color-coded by
  game) — no image assets involved.

## Live mode (Supabase)

1. Create a project at https://supabase.com (free tier is fine).
2. Apply the migrations in order:
   - With the CLI: `supabase link --project-ref <ref>` then `supabase db push`
   - Or paste each file from `supabase/migrations/` into the SQL editor,
     in filename order.
3. Seed demo data (optional): run `supabase/seed.sql` in the SQL editor.
4. In **Auth → URL Configuration**, add `http://localhost:5173` (and your
   production domain) to the redirect allow-list — confirmation, sign-in
   and password-reset links land there.
5. Copy `.env.example` to `.env` and fill in:

   | Variable | Where to find it |
   | --- | --- |
   | `VITE_MOCK` | set to `0` for live mode |
   | `VITE_SUPABASE_URL` | Project Settings → General (`https://<ref>.supabase.co`), also shown under the dashboard's **Connect** button |
   | `VITE_SUPABASE_ANON_KEY` | Project Settings → API Keys → **Publishable key** (`sb_publishable_…`) on new projects, or the legacy "anon public" key on older ones. Never the secret/service_role key. |

6. `npm run dev`, then **Create account** with an email and password.
   Confirm the emailed link once; after that it's email + password. New
   accounts continue to `/welcome` to pick a username, photo and bio.

   Accounts created before passwords existed sign in with **Email me a
   sign-in link** and are prompted to set a password at `/set-password`.

   Password policy (client-side, `src/lib/password.ts`): 10+ characters
   with a lowercase letter, an uppercase letter and a number; common
   passwords and ones containing the email address are rejected. To
   enforce a floor server-side too, set **Auth → Providers → Email →
   Minimum password length** in the dashboard.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev:mock` | dev server, offline mock mode |
| `npm run dev` | dev server, honors `.env` (`VITE_MOCK`) |
| `npm run build` | typecheck + production build |
| `npm run preview` | serve the production build |
| `npm test` | unit tests (Vitest) |
| `VITE_MOCK=1 VITE_MOCK_STRESS=1000 npm run dev` | mock mode with 1,000 extra synthetic listings (browse perf testing) |

## Documentation

- `DESIGN-NOTES.md` — the extracted visual language and anti-drift rules.
- `DECISIONS.md` — running log of product/engineering decisions.
- `TESTING.md` — the manual click-through script run at each milestone
  checkpoint, plus what's covered by unit tests.
- `supabase/migrations/` — versioned schema + RLS (never mutate ad hoc).

## Pre-Grade estimator

A decision-support tool for sellers: eight guided photos → a measured
centering report (deterministic geometry, ±1.5% verified against
generated ground truth), a defect assessment (vision model behind
`api/pregrade/assess`), an estimated PSA **band with confidence**
(never a bare number), and an expected-value calculator whose headline
is *uplift vs selling raw*. It is not a grade, and every surface says so.

Honesty rules baked in: no raking-light photos → the result is a
**ceiling**, not an estimate; inputs the model can't judge are
`not_assessed`, never guessed; indents and edge-bleed hard-cap at 8;
estimates can never touch the listings table's real-slab columns
(DB constraint + `leak.test.ts`).

- `npm run pregrade:eval` — headless pipeline over the fixture set;
  prints mean absolute grade error, P(10) Brier score, and the
  **false-confident rate** (share of high-confidence *submit*
  recommendations that came back ≤ 8). Target < 5%; currently 0% on the
  fixture set, enforced in CI as part of `npm test`.
- `node scripts/calibrate.mjs outcomes.json` — turns reported outcomes
  into measured per-bucket probabilities; writes `calibration.next.json`
  for human review, never auto-applies.
- Live assessments need `ANTHROPIC_API_KEY` set in the Vercel project
  env (`PREGRADE_DAILY_LIMIT` optional, default 10/user/day). Mock mode
  (`VITE_MOCK=1`) runs the whole flow with canned cases — `?case=indent`
  on `/pregrade` for UI work.

## Listing review

A member's new listing stays hidden (only the seller and moderators see
it) until it's known to be a card — `supabase/migrations/0031_listing_review.sql`.
Right after the photos upload, the app calls `api/listings/screen`, which
asks the vision model whether the photos show a trading card. A clear
"card" puts the listing live within seconds; anything else (not a card,
unsure, sealed product, the check failing) waits in **Admin →
Approvals** and the moderators are notified. Adding photos to a listing
sends it back for a check, and once a moderator has rejected a listing
only a moderator can approve it.

- The check needs `ANTHROPIC_API_KEY` and `LISTING_SCREEN_SECRET` in the
  Vercel project env (`LISTING_SCREEN_MODEL` optional). Get the secret by
  running `select private.rotate_listing_screen_secret();` in the
  Supabase SQL editor — the database keeps only its hash, and running it
  again replaces it. Without the secret every new listing waits for a
  moderator.
- Mock mode approves any listing with a photo unless its title contains
  "junk", so the queue can be demoed.

### Suspension and the listing cooldown

`supabase/migrations/0032_suspension_and_cooldown.sql`:

- A suspended account can browse, read its chats, mark things read and
  open support tickets (to appeal) — nothing else. One trigger on every
  table a member writes to refuses the rest. The member's own profile is
  followed over realtime, so an open app locks the moment a moderator
  suspends and unlocks when it's lifted; both are also notified.
- When two of a seller's listings go to review in a row, or two within
  five minutes — whatever sent them there: the photo check, a check that
  failed or never ran — they can't list or add photos for ten minutes
  from the second (0033). A listing stops counting once it's approved;
  removing it doesn't help. The sell page shows the countdown.

## Add to Home Screen

The site is a PWA: `public/manifest.webmanifest` names it, the icons in
`public/` draw it, and `public/sw.js` (registered on production builds
only) makes it installable and shows `public/offline.html` when there's
no connection — pages themselves always come from the network, so a
deploy is picked up on the next open. On a phone browser, a couple of
seconds after the site loads, a sheet slides up (`AddToHomePrompt`)
with the exact taps for that browser: Share → Add to Home Screen on
iPhone and iPad, the menu → Add to Home screen on Android (one tap
where the browser offers `beforeinstallprompt`). "Not now" brings it
back in two weeks, "Don't show again" never; it doesn't appear on
desktops or once the site is already opened from the home screen
(`src/lib/install.ts`).

## Admin console

`/admin` is the moderation surface: a queue for reports, account
suspensions, listing and auction takedowns, review deletion, and an
append-only audit log. Schema and rules live in
`supabase/migrations/0016_admin.sql`.

Two things are worth knowing before using it:

- **Nothing privileged is a plain table write.** Every action is a
  security-definer RPC that re-checks `is_admin()` server-side and writes
  an `admin_actions` row in the same transaction. The client-side route
  guard is convenience; the enforcement is in Postgres. The audit log has
  no insert/update/delete policy at all, so an admin cannot erase their
  own trail through the API.
- **Suspension stops creation, not reading.** A suspended account keeps
  its history and can still browse and read its threads, but cannot list,
  message or bid. Nothing is deleted, so the other party in a past trade
  keeps their record.

Private conversations stay private: an admin can read a message only when
that exact message is the target of a report.

**Mock mode** seeds a moderator — pick **Dev: LebanonTCG Mods** in the
switcher and open `/admin`.

**Live mode** has no way to become the first admin through the app. Promote
one account by hand in the SQL editor, once:

```sql
select set_config('app.admin_action', '1', true);
update public.profiles set is_admin = true
  where id = (select id from auth.users where email = 'you@example.com');
```

After that, admins promote each other from `/admin` → Users. Nobody can
revoke their own admin access (that would lock everyone out of a
single-admin project) — another admin has to do it.
