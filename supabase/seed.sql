-- Demo dataset for a fresh Cardpost project. Run AFTER all migrations
-- (SQL editor or `supabase db push` + psql -f seed.sql).
--
-- Notes:
-- * Creates three demo identities directly in auth.users. They exist for
--   browsing/demo purposes; nobody can sign in as them (no password, no
--   email delivery). Sign in with your own email alongside them.
-- * Listing photos live in Storage, which SQL can't seed — demo listings
--   ship without photos and render the app's designed no-photo state.
--   Upload photos by editing a listing from a demo... or just create your
--   own listings; the demo rows are only browse filler.

begin;

insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'maya.demo@cardpost.local'),
  ('a0000000-0000-4000-8000-000000000002', 'karim.demo@cardpost.local'),
  ('a0000000-0000-4000-8000-000000000003', 'lina.demo@cardpost.local')
on conflict (id) do nothing;

update public.profiles set
  username = 'mayapulls',
  display_name = 'Maya Haddad',
  bio = 'Beirut-based collector. Mostly vintage Pokémon and the odd Lorcana chase card. Meetups around Hamra or tracked shipping.'
where id = 'a0000000-0000-4000-8000-000000000001';

update public.profiles set
  username = 'karim_tcg',
  display_name = 'Karim Nassar',
  bio = 'MTG grinder since Innistrad. Selling off my modern staples and some graded slabs. Fast replies.'
where id = 'a0000000-0000-4000-8000-000000000002';

update public.profiles set
  username = 'linacollects',
  display_name = 'Lina Aoun',
  bio = 'One Piece + Yu-Gi-Oh! Binder always open for trades. I grade the good stuff.'
where id = 'a0000000-0000-4000-8000-000000000003';

insert into public.listings
  (seller_id, title, game, set_name, card_number, language, condition, finish,
   grade_company, grade_value, price, quantity, description, status) values
  ('a0000000-0000-4000-8000-000000000001', 'Charizard Base Set Unlimited', 'pokemon', 'Base Set', '4/102', 'English', 'LP', 'holo', null, null, 320, 1, 'Unlimited print, light edgewear on the back, front presents great.', 'active'),
  ('a0000000-0000-4000-8000-000000000001', 'Umbreon VMAX Alt Art', 'pokemon', 'Evolving Skies', '215/203', 'English', 'NM', 'holo', 'PSA', 'PSA 9', 640, 1, 'The moonbreon. PSA 9, cert verifiable. Video call to verify welcome.', 'active'),
  ('a0000000-0000-4000-8000-000000000001', 'Elsa – Spirit of Winter', 'lorcana', 'The First Chapter', '58/204', 'English', 'NM', 'foil', null, null, 95, 1, 'Legendary foil, pulled and sleeved. No clouding.', 'active'),
  ('a0000000-0000-4000-8000-000000000001', 'Sylveon VMAX Alt Art', 'pokemon', 'Evolving Skies', '212/203', 'English', 'LP', 'holo', null, null, 180, 1, 'Tiny whitening bottom-left corner, otherwise clean.', 'active'),
  ('a0000000-0000-4000-8000-000000000002', 'Ragavan, Nimble Pilferer', 'magic', 'Modern Horizons 2', '138', 'English', 'NM', 'normal', null, null, 58, 2, 'Two copies available, both pack to sleeve. Price per copy.', 'active'),
  ('a0000000-0000-4000-8000-000000000002', 'The One Ring (Extended Art)', 'magic', 'Tales of Middle-earth', '380', 'English', 'NM', 'foil', 'CGC', 'CGC 9', 260, 1, 'Graded CGC 9, extended art foil.', 'active'),
  ('a0000000-0000-4000-8000-000000000002', 'Sheoldred, the Apocalypse', 'magic', 'Dominaria United', '107', 'English', 'NM', 'normal', null, null, 68, 1, 'Standard all-star. Pack fresh.', 'active'),
  ('a0000000-0000-4000-8000-000000000002', 'Dark Magician (Arabic 1st print)', 'yugioh', 'Legend of Blue Eyes', 'LOB-005', 'Other', 'LP', 'holo', null, null, 120, 1, 'Rare regional print, light wear. A real conversation piece.', 'active'),
  ('a0000000-0000-4000-8000-000000000003', 'Shanks OP01 Secret Rare', 'onepiece', 'Romance Dawn', 'OP01-120', 'English', 'NM', 'foil', 'PSA', 'PSA 10', 480, 1, 'PSA 10 gem mint Shanks.', 'active'),
  ('a0000000-0000-4000-8000-000000000003', 'Blue-Eyes White Dragon (LOB 1st Ed)', 'yugioh', 'Legend of Blue Eyes', 'LOB-001', 'English', 'MP', 'holo', null, null, 550, 1, '1st edition LOB Blue-Eyes. Moderate play, no creases.', 'active'),
  ('a0000000-0000-4000-8000-000000000003', 'Monkey D. Luffy Leader (Alt Art)', 'onepiece', 'Romance Dawn', 'OP01-003', 'English', 'NM', 'foil', null, null, 75, 1, 'Alt art leader, pack to sleeve to toploader.', 'active'),
  ('a0000000-0000-4000-8000-000000000003', 'Nami OP01 (Japanese)', 'onepiece', 'Romance Dawn (JP)', 'OP01-016', 'Japanese', 'NM', 'foil', null, null, 38, 1, 'Japanese print, parallel foil.', 'active');

commit;
