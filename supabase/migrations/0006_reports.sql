-- 0006: reports (moderation queue; write-only for users)

create type public.report_target as enum ('listing', 'user', 'message');
create type public.report_reason as enum
  ('scam', 'counterfeit', 'inappropriate', 'spam', 'harassment', 'other');

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type public.report_target not null,
  target_id text not null,
  reason public.report_reason not null,
  detail text not null default '',
  created_at timestamptz not null default now(),
  constraint detail_max check (char_length(detail) <= 1000)
);

create index reports_target on public.reports (target_type, target_id);

alter table public.reports enable row level security;

-- Users can file reports but not browse the queue (moderators use the
-- service role / dashboard).
create policy "users file reports"
  on public.reports for insert
  with check (reporter_id = auth.uid());
