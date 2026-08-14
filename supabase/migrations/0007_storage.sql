-- 0007: storage bucket for listing photos + avatars
-- Public read; writes only inside the caller's own {uid}/... folder.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listing-images',
  'listing-images',
  true,
  5242880, -- 5 MB (images are client-compressed to ~1600px JPEG anyway)
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "listing images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'listing-images');

create policy "users upload into own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'listing-images'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users update own objects"
  on storage.objects for update
  using (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users delete own objects"
  on storage.objects for delete
  using (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
