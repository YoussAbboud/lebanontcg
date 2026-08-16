-- 0010: reviews are buyer → seller only.
--
-- 0005 let either party review the other. In practice the review is the
-- buyer's verdict on the seller — it feeds the seller's rating and the
-- sellers board — so the seller no longer reviews the buyer back.
-- Existing rows are untouched and stay readable.

drop policy if exists "participants review sold trades" on public.reviews;

create policy "buyers review sold trades"
  on public.reviews for insert
  with check (
    reviewer_id = auth.uid()
    and exists (
      select 1
      from public.conversations c
      join public.listings l on l.id = c.listing_id
      where c.id = conversation_id
        and l.id = listing_id
        and l.status = 'sold'
        and c.buyer_id = auth.uid()
        and c.seller_id = reviewee_id
    )
  );
