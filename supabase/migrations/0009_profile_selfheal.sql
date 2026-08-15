-- 0009: let a signed-in user create their own missing profile row.
-- Normally the on_auth_user_created trigger inserts it, but accounts that
-- signed up BEFORE the schema was applied have no row; the app now
-- self-heals by inserting it, which needs an RLS insert policy.

create policy "users insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);
