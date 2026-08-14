# Local migration + RLS verification

Lets you validate `supabase/migrations/` and the RLS policies on a plain
Postgres 16 — no Supabase project needed. `local-shim.sql` fakes the parts
of the Supabase environment the migrations touch (`auth` schema +
`auth.uid()`, `storage` schema, `anon`/`authenticated` roles, the
`supabase_realtime` publication).

```bash
# scratch cluster (once)
initdb -D /tmp/pgtest/data -U postgres -A trust
pg_ctl -D /tmp/pgtest/data -o "-k /tmp/pgtest -c listen_addresses='' -c wal_level=logical" start

# fresh database each run
psql -h /tmp/pgtest -U postgres -c "drop database if exists apptest; create database apptest;"
psql -h /tmp/pgtest -U postgres -d apptest -c "create extension pgcrypto;"
psql -h /tmp/pgtest -U postgres -d apptest -f supabase/dev/local-shim.sql
for f in supabase/migrations/*.sql; do
  psql -h /tmp/pgtest -U postgres -d apptest -v ON_ERROR_STOP=1 -f "$f" || break
done
psql -h /tmp/pgtest -U postgres -d apptest -f supabase/seed.sql
psql -h /tmp/pgtest -U postgres -d apptest -f supabase/dev/rls-test.sql
```

`rls-test.sql` prints `Tnn ...: true` lines; every `true` is an assertion,
and each `(expect error above: ...)` line documents the immediately
preceding intentional failure. Any `false` is a regression.

Never run these against a real project — the shim creates roles/schemas
that already exist there (and the test writes junk data).
