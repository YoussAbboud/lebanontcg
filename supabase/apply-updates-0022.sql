-- ==========================================================================
-- LebanonTCG — UPDATE script: migration 0022 (storage listing)
--
-- Closes the "clients can list all files in this bucket" advisory on
-- listing-images: the public bucket keeps serving images by URL, but
-- only an owner can see their own folder. Apply after 0021. Run ONCE.
--
-- HOW TO USE: Supabase dashboard → SQL Editor → New query → paste this
-- entire file → Run.
-- ==========================================================================


-- ──────────────────────────────────────────────────────────────────────────
-- BEGIN supabase/migrations/0022_storage_listing.sql
-- ──────────────────────────────────────────────────────────────────────────
-- 0022: nobody can list the listing-images bucket.
--
-- 0007 granted SELECT on every object in listing-images to everyone,
-- which is what Supabase's advisor flags: it lets any client enumerate
-- every seller's folder (their user id) and file names. The app never
-- needs it — a PUBLIC bucket serves files by URL without consulting
-- storage.objects at all — and the only authenticated operations are
-- an owner uploading, replacing and removing their own files, which
-- have their own policies.
--
-- The SELECT policy is narrowed rather than dropped: an owner can still
-- see (and so list) their own folder, which is what the storage API
-- reads when it removes or overwrites an object.

drop policy "listing images are publicly readable" on storage.objects;

create policy "users see own listing images"
  on storage.objects for select
  using (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ──────────────────────────────────────────────────────────────────────────
-- END supabase/migrations/0022_storage_listing.sql
-- ──────────────────────────────────────────────────────────────────────────
