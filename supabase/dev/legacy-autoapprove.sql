-- DEV ONLY. Never run against a real project.
--
-- The suites written before 0031 (rls, notify, auction, plans, warn,
-- phone, location, deletion) expect a listing to be public the moment
-- it's inserted. Since 0031 a member's listing waits for review, so for
-- those suites this approves every listing as it's created and again
-- after new photos. Load it after the migrations and seed, before those
-- suites. review-test.sql runs on a database WITHOUT it.

create or replace function public.dev_autoapprove()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_listing uuid;
begin
  if tg_table_name = 'listings' then
    v_listing := new.id;
  else
    v_listing := new.listing_id;
  end if;
  perform set_config('app.listing_review', '1', true);
  update listings set review_state = 'approved'
    where id = v_listing and review_state <> 'approved';
  perform set_config('app.listing_review', '', true);
  return null;
end;
$$;

-- "zz_" so these run after 0031's own triggers (same-event triggers fire
-- in name order).
-- Approved as each row is written (BEFORE, after 0031's guard), so a
-- multi-row insert never sees its own earlier rows still in review —
-- which 0033's listing cooldown would otherwise count.
create or replace function public.dev_autoapprove_new_listing()
returns trigger
language plpgsql
as $$
begin
  new.review_state := 'approved';
  return new;
end;
$$;

create trigger zz_dev_autoapprove_listings
  before insert on public.listings
  for each row execute function public.dev_autoapprove_new_listing();

create trigger zz_dev_autoapprove_images
  after insert on public.listing_images
  for each row execute function public.dev_autoapprove();
