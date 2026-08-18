-- 0011: Pre-Grade estimator — reports, captures, outcomes, and the hard
-- separation between estimates and real cert-numbered slabs.
--
-- An estimate can NEVER write listings.grade_company / grade_value.
-- Those stay reserved for real slabs; the constraint below plus the
-- leak test in src/lib/pregrade/leak.test.ts enforce it from both ends.

create type public.pregrade_era as enum ('ultra_modern', 'modern', 'vintage');
create type public.pregrade_confidence as enum ('high', 'moderate', 'low');
create type public.pregrade_recommendation as enum ('submit', 'marginal', 'do_not_submit', 'inconclusive');
create type public.pregrade_capture_slot as enum
  ('front', 'back', 'corner_tl', 'corner_tr', 'corner_br', 'corner_bl', 'rake_front', 'rake_back');

create table public.pregrade_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid references public.listings (id) on delete set null,
  published boolean not null default false,
  standards_version text not null,
  era public.pregrade_era not null,
  centering_method text not null check (centering_method in ('border_detect', 'manual', 'design_element')),
  front_lr numeric(4,1) not null,
  front_tb numeric(4,1) not null,
  back_lr numeric(4,1),
  back_tb numeric(4,1),
  score_centering smallint check (score_centering between 1 and 10),
  score_corners smallint check (score_corners between 1 and 10),
  score_edges smallint check (score_edges between 1 and 10),
  score_surface smallint check (score_surface between 1 and 10),
  base_grade smallint not null check (base_grade between 0 and 10),
  is_ceiling boolean not null default false,
  p10 numeric(4,3) not null default 0,
  p9 numeric(4,3) not null default 0,
  p8 numeric(4,3) not null default 0,
  p_low numeric(4,3) not null default 0,
  confidence public.pregrade_confidence not null,
  recommendation public.pregrade_recommendation not null,
  findings jsonb not null,
  notes jsonb not null default '[]'::jsonb,
  model_id text,
  created_at timestamptz not null default now(),
  -- Publishing requires an attached listing.
  constraint published_needs_listing check (not published or listing_id is not null)
);

create index pregrade_reports_user on public.pregrade_reports (user_id, created_at desc);
create index pregrade_reports_listing on public.pregrade_reports (listing_id) where published;

create table public.pregrade_captures (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.pregrade_reports (id) on delete cascade,
  slot public.pregrade_capture_slot not null,
  path text not null,
  width integer,
  height integer,
  quality jsonb,
  unique (report_id, slot)
);

create table public.pregrade_outcomes (
  report_id uuid primary key references public.pregrade_reports (id) on delete cascade,
  actual_grade smallint not null check (actual_grade between 1 and 10),
  qualifier text,
  cert_number text,
  reported_at timestamptz not null default now(),
  verified boolean not null default false
);

-- ---------------------------------------------------------------------------
-- Separation from real grades: a grade value without a grading company is
-- impossible, so nothing can smuggle an estimate into the slab fields.
-- (Pre-grade code paths never reference these columns — see the leak test.)
-- ---------------------------------------------------------------------------
alter table public.listings add constraint no_pregrade_in_grade_fields
  check (grade_value is null or grade_company is not null);

-- ---------------------------------------------------------------------------
-- RLS: a report is readable by its owner always, and by anyone only when
-- published AND the attached listing is visible. Captures inherit.
-- ---------------------------------------------------------------------------
alter table public.pregrade_reports enable row level security;
alter table public.pregrade_captures enable row level security;
alter table public.pregrade_outcomes enable row level security;

create policy "owners read own reports" on public.pregrade_reports
  for select using (user_id = auth.uid());

create policy "published reports are public" on public.pregrade_reports
  for select using (
    published and listing_id is not null and exists (
      select 1 from public.listings l
      where l.id = listing_id and l.status <> 'removed'
    )
  );

create policy "owners insert own reports" on public.pregrade_reports
  for insert with check (user_id = auth.uid());

create policy "owners update own reports" on public.pregrade_reports
  for update using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    -- A report may only be attached/published to the owner's own listing.
    and (listing_id is null or exists (
      select 1 from public.listings l
      where l.id = listing_id and l.seller_id = auth.uid()
    ))
  );

create policy "owners delete own reports" on public.pregrade_reports
  for delete using (user_id = auth.uid());

create policy "captures follow their report" on public.pregrade_captures
  for select using (exists (
    select 1 from public.pregrade_reports r where r.id = report_id
  ));

create policy "owners add captures" on public.pregrade_captures
  for insert with check (exists (
    select 1 from public.pregrade_reports r
    where r.id = report_id and r.user_id = auth.uid()
  ));

create policy "owners read own outcomes" on public.pregrade_outcomes
  for select using (exists (
    select 1 from public.pregrade_reports r
    where r.id = report_id and r.user_id = auth.uid()
  ));

create policy "owners record outcomes" on public.pregrade_outcomes
  for insert with check (exists (
    select 1 from public.pregrade_reports r
    where r.id = report_id and r.user_id = auth.uid()
  ));

-- ---------------------------------------------------------------------------
-- Private capture bucket: owner-only unless the report is published.
-- Paths are {uid}/{report_id}/{slot}.webp
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pregrade-captures',
  'pregrade-captures',
  false,
  8388608, -- 8 MB: captures stay at 2400px, detail matters here
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "pregrade captures readable by owner or when published"
  on storage.objects for select
  using (
    bucket_id = 'pregrade-captures'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.pregrade_reports r
        where r.id::text = (storage.foldername(name))[2]
          and r.published
      )
    )
  );

create policy "pregrade captures upload into own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'pregrade-captures'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "pregrade captures delete own"
  on storage.objects for delete
  using (
    bucket_id = 'pregrade-captures'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
