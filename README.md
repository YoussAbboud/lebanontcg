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
