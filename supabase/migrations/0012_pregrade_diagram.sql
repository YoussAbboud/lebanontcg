-- 0012: photo-backed centering diagrams.
-- Stores the eight measured guide positions (normalised 0-1 to the card
-- box) per face, plus whether each face's capture was corner-pinned and
-- flattened — only then do the lines land truthfully on the photo.
-- Null on rows saved before this migration; the UI falls back to the
-- abstract diagram.

alter table public.pregrade_reports
  add column if not exists diagram jsonb;
