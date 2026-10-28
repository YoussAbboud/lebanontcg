-- ==========================================================================
-- LebanonTCG — UPDATE script: migration 0030 (account deletion)
--
-- Fixes account deletion for anyone who has sent a message. Apply after
-- 0029. Run ONCE.
--
-- HOW TO USE: Supabase dashboard → SQL Editor → New query → paste this
-- entire file → Run.
-- ==========================================================================


-- ──────────────────────────────────────────────────────────────────────────
-- BEGIN supabase/migrations/0030_account_deletion.sql
-- ──────────────────────────────────────────────────────────────────────────
-- 0030: deleting an account works again.
--
-- Deleting an account cascades: its conversations (for both people in
-- them, with every message, phone number and location shared there),
-- reviews, listings and the rest go with it. But messages.sender_id is
-- also ON DELETE SET NULL, and 0008's system_has_no_sender check required
-- every non-system message to keep a sender, so the SET NULL failed and
-- deleting anyone who had ever sent a message was refused. The check now
-- says only what it is for: system messages have no sender. New messages
-- still need one (the insert policy requires sender_id = auth.uid()).

alter table public.messages drop constraint system_has_no_sender;
alter table public.messages
  add constraint system_has_no_sender check (kind <> 'system' or sender_id is null);

-- ──────────────────────────────────────────────────────────────────────────
-- END supabase/migrations/0030_account_deletion.sql
-- ──────────────────────────────────────────────────────────────────────────

-- Tell the API (PostgREST) to reload the schema now, so the app sees the
-- new columns and kinds at once instead of failing with "could not find
-- the column … in the schema cache" until its cache refreshes.
notify pgrst, 'reload schema';
