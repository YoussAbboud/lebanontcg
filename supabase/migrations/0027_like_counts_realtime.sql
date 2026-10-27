-- 0027: live like counts.
--
-- A listing's ♡ count is the number of people watching it, kept in
-- listing_like_counts by the trigger from 0023. Putting that table on the
-- realtime publication lets every open card follow its count as people
-- watch and unwatch, without refetching the listing. The table holds
-- nothing but (listing_id, likes) and is already public to read, so the
-- feed exposes nothing new; who watches what stays private in favorites.

do $$
begin
  alter publication supabase_realtime add table public.listing_like_counts;
exception when others then
  null;
end
$$;
