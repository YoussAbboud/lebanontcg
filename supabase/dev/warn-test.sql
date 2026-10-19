-- Warnings (0025): three strikes suspend, revocation does not unsuspend,
-- and only moderators write. Fresh database; distinct ids.
\set ON_ERROR_STOP off
\set QUIET on
\pset tuples_only on

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'mod@warn.dev'),
  ('00000000-0000-0000-0000-0000000000d2', 'seller@warn.dev'),
  ('00000000-0000-0000-0000-0000000000d3', 'other@warn.dev');
set app.admin_action = '1';
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-0000000000d1';
set app.admin_action = '0';
update public.profiles set username = 'warn_seller' where id = '00000000-0000-0000-0000-0000000000d2';
insert into public.listing_credit_packs (user_id, credits, status)
  select id, 1000, 'active' from auth.users where email like '%@warn.dev';

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d2';
insert into public.listings (id, seller_id, title, game, condition, price)
  values ('60000000-0000-0000-0000-000000000001', auth.uid(), 'Fake Charizard', 'pokemon', 'NM', 50);

-- Nobody but a moderator warns.
select public.admin_warn_user('00000000-0000-0000-0000-0000000000d3', 'nope');
select 'W01 (expect error above: admin only)';
insert into public.user_warnings (user_id, reason) values (auth.uid(), 'self');
select 'W02 (expect error above: no insert policy)';

set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
select public.admin_warn_user('00000000-0000-0000-0000-0000000000d1', 'me');
select 'W03 (expect error above: cannot warn yourself)';
select public.admin_warn_user('00000000-0000-0000-0000-0000000000d2', 'no');
select 'W04 (expect error above: a reason is required)';

select 'W05 the first warning returns a count of one: '
  || (public.admin_warn_user('00000000-0000-0000-0000-0000000000d2',
        'Listing is a counterfeit', '60000000-0000-0000-0000-000000000001') = 1)::text;
select 'W06 the listing title is kept on the warning: ' || (listing_title = 'Fake Charizard')::text
  from public.user_warnings where user_id = '00000000-0000-0000-0000-0000000000d2';
select 'W07 the second returns two and nobody is suspended yet: '
  || (public.admin_warn_user('00000000-0000-0000-0000-0000000000d2', 'Misleading photos') = 2
      and (select suspended_at is null from public.profiles
           where id = '00000000-0000-0000-0000-0000000000d2'))::text;

-- The person sees their warnings and is told about them.
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d2';
select 'W08 the seller reads their own two warnings: ' || (count(*) = 2)::text
  from public.user_warnings;
select 'W09 and was notified of each, counting up: '
  || (count(*) filter (where title like 'Warning 1 of 3%') = 1
      and count(*) filter (where title like 'Warning 2 of 3%') = 1)::text
  from public.notifications where kind = 'moderation';
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d3';
select 'W10 another user sees none of them: ' || (count(*) = 0)::text
  from public.user_warnings;

-- The third suspends.
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
select 'W11 the third returns three: '
  || (public.admin_warn_user('00000000-0000-0000-0000-0000000000d2', 'Copied listing') = 3)::text;
select 'W12 and the account is suspended with the reason on it: '
  || (suspended_at is not null and suspended_reason like '3 warnings%')::text
  from public.profiles where id = '00000000-0000-0000-0000-0000000000d2';
select 'W13 the suspension went through the audit log: ' || (count(*) = 1)::text
  from public.admin_actions where kind = 'user_suspend'
    and target_id = '00000000-0000-0000-0000-0000000000d2';
select 'W14 and three warn actions were logged: ' || (count(*) = 3)::text
  from public.admin_actions where kind = 'user_warn'
    and target_id = '00000000-0000-0000-0000-0000000000d2';
select 'W15 admin_users reports the count: '
  || ((select (elem->>'warning_count')::int from jsonb_array_elements(public.admin_users('warn_seller', 5)) elem limit 1) = 3)::text;

-- Suspended means no new listings.
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d2';
insert into public.listings (seller_id, title, game, condition, price)
  values (auth.uid(), 'Another', 'pokemon', 'NM', 10);
select 'W16 (expect error above: suspended accounts cannot list)';
select 'W17 the seller was told about the suspension: ' || (count(*) = 1)::text
  from public.notifications where kind = 'moderation' and title = 'Your account is suspended';

-- Revoking a warning does not lift the suspension; lifting is separate.
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
select public.admin_revoke_warning(id, 'Photos were fine on review')
  from public.user_warnings where reason = 'Misleading photos';
select 'W18 the active count drops to two: '
  || ((select (elem->>'warning_count')::int from jsonb_array_elements(public.admin_users('warn_seller', 5)) elem limit 1) = 2)::text;
select 'W19 but the account stays suspended until lifted: ' || (suspended_at is not null)::text
  from public.profiles where id = '00000000-0000-0000-0000-0000000000d2';
select public.admin_revoke_warning('60000000-0000-0000-0000-000000000099', 'x');
select 'W20 (expect error above: no active warning with that id)';
select public.admin_set_suspended('00000000-0000-0000-0000-0000000000d2', false, 'Second chance');
select 'W21 lifted by hand, the warnings remain on record: ' || (count(*) = 3)::text
  from public.user_warnings where user_id = '00000000-0000-0000-0000-0000000000d2';
-- One more warning: back to three active, suspended again at once.
select 'W22 the next warning counts three again: '
  || (public.admin_warn_user('00000000-0000-0000-0000-0000000000d2', 'Again') = 3)::text;
select 'W23 and re-suspends immediately: '
  || (suspended_at is not null and suspended_reason like '3 warnings — Again%')::text
  from public.profiles where id = '00000000-0000-0000-0000-0000000000d2';
reset role;
