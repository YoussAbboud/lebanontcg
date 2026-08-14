-- 0005: reviews (post-sale, one per party per conversation) + rating rollup

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete cascade,
  reviewee_id uuid not null references public.profiles (id) on delete cascade,
  rating integer not null,
  body text not null default '',
  created_at timestamptz not null default now(),
  unique (conversation_id, reviewer_id),
  constraint rating_range check (rating between 1 and 5),
  constraint body_max check (char_length(body) <= 500),
  constraint no_self_review check (reviewer_id <> reviewee_id)
);

create index reviews_reviewee on public.reviews (reviewee_id, created_at desc);

-- Denormalize onto profiles for cheap card/profile reads.
create or replace function public.rollup_profile_rating()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform set_config('app.allow_rating_write', '1', true);
  update profiles p set
    rating_avg = sub.avg_rating,
    rating_count = sub.n
  from (
    select reviewee_id, round(avg(rating)::numeric, 2) as avg_rating, count(*) as n
    from reviews where reviewee_id = new.reviewee_id
    group by reviewee_id
  ) sub
  where p.id = sub.reviewee_id;
  return new;
end;
$$;

create trigger reviews_rollup
  after insert on public.reviews
  for each row execute function public.rollup_profile_rating();

alter table public.reviews enable row level security;

create policy "reviews are publicly readable"
  on public.reviews for select
  using (true);

-- Insert allowed only when: reviewer is a participant of the conversation,
-- the listing is sold, and the reviewee is the other participant.
create policy "participants review sold trades"
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
        and (
          (c.buyer_id = auth.uid() and c.seller_id = reviewee_id) or
          (c.seller_id = auth.uid() and c.buyer_id = reviewee_id)
        )
    )
  );
