import type {
  Condition,
  Conversation,
  Finish,
  Game,
  Listing,
  Message,
  Profile,
} from '../lib/types';

// Seed data for MockClient: 3 users, ~40 listings across games/conditions/
// prices, 2 active conversations with message history. Images are resolved
// lazily by MockClient via the procedural generator (mock:// storage paths).

const now = Date.now();
const days = (n: number) => new Date(now - n * 86_400_000).toISOString();
const mins = (n: number) => new Date(now - n * 60_000).toISOString();

export const seedProfiles: Profile[] = [
  {
    id: 'u-maya',
    username: 'mayapulls',
    displayName: 'Maya Haddad',
    avatarUrl: 'mock-avatar://mayapulls',
    bio: 'Beirut-based collector. Mostly vintage Pokémon and the odd Lorcana chase card. Meetups around Hamra or tracked shipping.',
    createdAt: days(412),
    ratingAvg: 4.8,
    ratingCount: 26,
  },
  {
    id: 'u-karim',
    username: 'karim_tcg',
    displayName: 'Karim Nassar',
    avatarUrl: 'mock-avatar://karim_tcg',
    bio: 'MTG grinder since Innistrad. Selling off my modern staples and some graded slabs. Fast replies.',
    createdAt: days(230),
    ratingAvg: 4.5,
    ratingCount: 11,
  },
  {
    id: 'u-lina',
    username: 'linacollects',
    displayName: 'Lina Aoun',
    avatarUrl: 'mock-avatar://linacollects',
    bio: 'One Piece + Yu-Gi-Oh! Binder always open for trades. I grade the good stuff.',
    createdAt: days(98),
    ratingAvg: 5.0,
    ratingCount: 4,
  },
];

interface SeedListing {
  seller: string;
  title: string;
  game: Game;
  set: string;
  num: string;
  lang?: string;
  cond: Condition;
  finish?: Finish;
  grade?: [string, string];
  price: number;
  qty?: number;
  desc: string;
  status?: Listing['status'];
  ageDays: number;
  imageCount?: number;
}

const L: SeedListing[] = [
  // --- Maya (vintage Pokémon + Lorcana) ---
  { seller: 'u-maya', title: 'Charizard Base Set Unlimited', game: 'pokemon', set: 'Base Set', num: '4/102', cond: 'LP', finish: 'holo', price: 320, desc: 'Unlimited print, light edgewear on the back, front presents great. Photos of corners included. Price slightly negotiable for quick pickup.', ageDays: 2, imageCount: 4 },
  { seller: 'u-maya', title: 'Blastoise Base Set Shadowless', game: 'pokemon', set: 'Base Set (Shadowless)', num: '2/102', cond: 'MP', finish: 'holo', price: 410, desc: 'Shadowless print. Moderate whitening on back edges, small surface scratch visible at an angle. Priced accordingly.', ageDays: 5, imageCount: 5 },
  { seller: 'u-maya', title: 'Pikachu Illustrator Reprint (Celebrations)', game: 'pokemon', set: 'Celebrations Classic', num: '—', cond: 'NM', finish: 'holo', price: 18, desc: 'Pack fresh into sleeve. Selling a few copies.', qty: 3, ageDays: 1, imageCount: 1 },
  { seller: 'u-maya', title: 'Umbreon VMAX Alt Art', game: 'pokemon', set: 'Evolving Skies', num: '215/203', cond: 'NM', finish: 'holo', grade: ['PSA', 'PSA 9'], price: 640, desc: 'The moonbreon. PSA 9, cert verifiable. Slab in perfect shape. Serious buyers only please — happy to do a video call to show the slab.', ageDays: 9, imageCount: 3 },
  { seller: 'u-maya', title: 'Elsa – Spirit of Winter', game: 'lorcana', set: 'The First Chapter', num: '58/204', cond: 'NM', finish: 'foil', price: 95, desc: 'Legendary foil, pulled and sleeved. No clouding.', ageDays: 3, imageCount: 2 },
  { seller: 'u-maya', title: 'Stitch – Rock Star', game: 'lorcana', set: 'The First Chapter', num: '125/204', cond: 'NM', finish: 'foil', price: 40, desc: 'Enchanted-adjacent art, foil. Mint from pack.', ageDays: 14, imageCount: 2 },
  { seller: 'u-maya', title: 'Eevee Heroes Japanese Booster Box promos', game: 'pokemon', set: 'Eevee Heroes (JP)', num: 'various', lang: 'Japanese', cond: 'NM', price: 55, qty: 2, desc: 'Set of Japanese promo pulls, all NM, list in photos.', ageDays: 21, imageCount: 6 },
  { seller: 'u-maya', title: 'Sylveon VMAX Alt Art', game: 'pokemon', set: 'Evolving Skies', num: '212/203', cond: 'LP', finish: 'holo', price: 180, desc: 'Tiny whitening bottom-left corner, otherwise clean. See macro shots.', ageDays: 30, imageCount: 4 },
  { seller: 'u-maya', title: 'Mewtwo GX Shiny', game: 'pokemon', set: 'Hidden Fates', num: 'SV59/SV94', cond: 'NM', finish: 'holo', price: 48, desc: 'Shiny vault Mewtwo, sleeved since pull.', ageDays: 45, imageCount: 2 },
  { seller: 'u-maya', title: 'Maleficent – Monstrous Dragon', game: 'lorcana', set: 'The First Chapter', num: '113/204', cond: 'NM', finish: 'normal', price: 22, desc: 'Non-foil legendary. Clean.', ageDays: 60, imageCount: 1 },
  { seller: 'u-maya', title: 'Base Set 2 Venusaur', game: 'pokemon', set: 'Base Set 2', num: '18/130', cond: 'HP', finish: 'holo', price: 60, desc: 'Played copy, creased corner — binder filler price for a classic holo.', ageDays: 75, imageCount: 3 },
  { seller: 'u-maya', title: 'Rayquaza VMAX Alt Art', game: 'pokemon', set: 'Evolving Skies', num: '218/203', cond: 'NM', finish: 'holo', grade: ['BGS', 'BGS 9.5'], price: 780, status: 'reserved', desc: 'BGS 9.5 gem mint, quads on the label. Reserved pending payment.', ageDays: 18, imageCount: 3 },
  { seller: 'u-maya', title: 'Snorlax VMAX', game: 'pokemon', set: 'Sword & Shield Base', num: '206/202', cond: 'NM', finish: 'holo', price: 30, status: 'sold', desc: 'Rainbow rare Snorlax, pack to sleeve.', ageDays: 90, imageCount: 2 },

  // --- Karim (MTG + misc) ---
  { seller: 'u-karim', title: 'Ragavan, Nimble Pilferer', game: 'magic', set: 'Modern Horizons 2', num: '138', cond: 'NM', price: 58, qty: 2, desc: 'Two copies available, both pack to sleeve. Price is per copy.', ageDays: 1, imageCount: 2 },
  { seller: 'u-karim', title: 'Ragavan, Nimble Pilferer (Showcase)', game: 'magic', set: 'Modern Horizons 2', num: '417', cond: 'NM', finish: 'foil', price: 95, desc: 'Sketch showcase foil. No clouding or curl, kept in a binder in AC.', ageDays: 4, imageCount: 3 },
  { seller: 'u-karim', title: 'Wrenn and Six', game: 'magic', set: 'Modern Horizons', num: '217', cond: 'LP', price: 38, desc: 'Very light shuffle wear, played sleeved only.', ageDays: 6, imageCount: 2 },
  { seller: 'u-karim', title: 'Force of Negation', game: 'magic', set: 'Modern Horizons', num: '52', cond: 'NM', price: 45, qty: 3, desc: 'Playset minus one. Per-copy price, discount if you take all three.', ageDays: 8, imageCount: 1 },
  { seller: 'u-karim', title: 'Liliana of the Veil', game: 'magic', set: 'Innistrad', num: '105', cond: 'MP', price: 28, desc: 'OG Innistrad printing, moderate edgewear — great budget copy of an icon.', ageDays: 12, imageCount: 4 },
  { seller: 'u-karim', title: 'The One Ring (Extended Art)', game: 'magic', set: 'Tales of Middle-earth', num: '380', cond: 'NM', finish: 'foil', grade: ['CGC', 'CGC 9'], price: 260, desc: 'Graded CGC 9, extended art foil. Slab has a tiny scuff, card is perfect.', ageDays: 15, imageCount: 3 },
  { seller: 'u-karim', title: 'Fetch land bundle (Zendikar Rising expeditions)', game: 'magic', set: 'Zendikar Rising Expeditions', num: 'various', cond: 'NM', finish: 'foil', price: 150, desc: 'Misty Rainforest + Scalding Tarn expeditions, both NM foils. Selling as a pair.', ageDays: 20, imageCount: 5 },
  { seller: 'u-karim', title: 'Sheoldred, the Apocalypse', game: 'magic', set: 'Dominaria United', num: '107', cond: 'NM', price: 68, desc: 'Standard all-star. Pack fresh.', ageDays: 25, imageCount: 2 },
  { seller: 'u-karim', title: 'Orcish Bowmasters', game: 'magic', set: 'Tales of Middle-earth', num: '103', cond: 'NM', price: 32, qty: 4, desc: 'Full playset available, price per copy.', ageDays: 28, imageCount: 1 },
  { seller: 'u-karim', title: 'Dark Magician (Arabic 1st print)', game: 'yugioh', set: 'Legend of Blue Eyes', num: 'LOB-005', lang: 'Other', cond: 'LP', finish: 'holo', price: 120, desc: 'Rare regional print, light wear. A real conversation piece.', ageDays: 33, imageCount: 4 },
  { seller: 'u-karim', title: 'Mox Opal', game: 'magic', set: 'Scars of Mirrodin', num: '179', cond: 'LP', price: 85, status: 'sold', desc: 'LP Mox Opal from Scars block.', ageDays: 70, imageCount: 2 },
  { seller: 'u-karim', title: 'Teferi, Hero of Dominaria', game: 'magic', set: 'Dominaria', num: '207', cond: 'NM', finish: 'foil', price: 42, status: 'removed', desc: 'Foil Teferi — delisted, trading it instead.', ageDays: 40, imageCount: 1 },

  // --- Lina (One Piece + Yu-Gi-Oh!) ---
  { seller: 'u-lina', title: 'Monkey D. Luffy Leader (Alt Art)', game: 'onepiece', set: 'Romance Dawn', num: 'OP01-003', cond: 'NM', finish: 'foil', price: 75, desc: 'Alt art leader, straight from pack to sleeve to toploader.', ageDays: 2, imageCount: 3 },
  { seller: 'u-lina', title: 'Shanks OP01 Secret Rare', game: 'onepiece', set: 'Romance Dawn', num: 'OP01-120', cond: 'NM', finish: 'foil', grade: ['PSA', 'PSA 10'], price: 480, desc: 'PSA 10 gem mint Shanks. The crown jewel of my binder — only selling to fund a box break habit.', ageDays: 7, imageCount: 4 },
  { seller: 'u-lina', title: 'Nami OP01 (Japanese)', game: 'onepiece', set: 'Romance Dawn (JP)', num: 'OP01-016', lang: 'Japanese', cond: 'NM', finish: 'foil', price: 38, desc: 'Japanese print, parallel foil.', ageDays: 10, imageCount: 2 },
  { seller: 'u-lina', title: 'Blue-Eyes White Dragon (LOB 1st Ed)', game: 'yugioh', set: 'Legend of Blue Eyes', num: 'LOB-001', cond: 'MP', finish: 'holo', price: 550, desc: '1st edition LOB Blue-Eyes. Moderate play, no creases, priced well under graded comps. Video verification welcome.', ageDays: 3, imageCount: 6 },
  { seller: 'u-lina', title: 'Dark Magician Girl (MFC 1st Ed)', game: 'yugioh', set: 'Magician\'s Force', num: 'MFC-000', cond: 'LP', finish: 'holo', price: 210, desc: 'The classic. 1st edition, light wear only.', ageDays: 11, imageCount: 4 },
  { seller: 'u-lina', title: 'Ash Blossom & Joyous Spring', game: 'yugioh', set: 'Maximum Crisis', num: 'MACR-EN036', cond: 'NM', price: 15, qty: 3, desc: 'Staple hand trap, three available.', ageDays: 16, imageCount: 1 },
  { seller: 'u-lina', title: 'Roronoa Zoro Leader Parallel', game: 'onepiece', set: 'Romance Dawn', num: 'OP01-001', cond: 'NM', finish: 'foil', price: 55, desc: 'Parallel leader Zoro.', ageDays: 19, imageCount: 2 },
  { seller: 'u-lina', title: 'Accesscode Talker (Prismatic)', game: 'yugioh', set: 'Eternity Code', num: 'ETCO-EN045', cond: 'NM', finish: 'holo', price: 34, desc: 'Prismatic secret. Clean surface under strong light.', ageDays: 24, imageCount: 2 },
  { seller: 'u-lina', title: 'Portgas D. Ace SP', game: 'onepiece', set: 'Paramount War', num: 'OP02-013', cond: 'NM', finish: 'foil', price: 120, grade: ['BGS', 'BGS 9'], desc: 'Graded BGS 9. Sub grades in photos.', ageDays: 27, imageCount: 3 },
  { seller: 'u-lina', title: 'Exodia the Forbidden One (complete set)', game: 'yugioh', set: 'Legend of Blue Eyes', num: 'LOB-124', cond: 'HP', price: 190, desc: 'All five pieces, unlimited, heavily played but complete. Sold as a set only.', ageDays: 35, imageCount: 5 },
  { seller: 'u-lina', title: 'Trafalgar Law Alt Art', game: 'onepiece', set: 'Paramount War', num: 'OP02-106', cond: 'LP', finish: 'foil', price: 88, desc: 'Slight edge silvering on the back, front is mint.', ageDays: 42, imageCount: 3 },
  { seller: 'u-lina', title: 'Ghost Rare Stardust Dragon', game: 'yugioh', set: 'The Duelist Genesis', num: 'TDGS-EN040', cond: 'DMG', finish: 'holo', price: 45, desc: 'Ghost rare with a crease — displays beautifully in a binder, priced for the damage.', ageDays: 50, imageCount: 4 },
  { seller: 'u-lina', title: 'Kaiba starter deck (sealed)', game: 'yugioh', set: 'Starter Deck: Kaiba', num: '—', cond: 'NM', price: 260, desc: 'Factory sealed Kaiba starter, minor shelf wear on the box shrink.', ageDays: 55, imageCount: 4 },
  { seller: 'u-lina', title: 'Uta OP02 promo', game: 'onepiece', set: 'Film Red promo', num: 'P-014', cond: 'NM', finish: 'foil', price: 26, status: 'sold', desc: 'Film Red promo Uta.', ageDays: 65, imageCount: 1 },
];

export function buildSeedListings(): Listing[] {
  return L.map((s, i) => {
    const id = `l-${String(i + 1).padStart(3, '0')}`;
    const count = s.imageCount ?? 2;
    return {
      id,
      sellerId: s.seller,
      title: s.title,
      game: s.game,
      setName: s.set,
      cardNumber: s.num,
      language: s.lang ?? 'English',
      condition: s.cond,
      finish: s.finish ?? 'normal',
      gradeCompany: s.grade?.[0] ?? null,
      gradeValue: s.grade?.[1] ?? null,
      price: s.price,
      currency: 'USD',
      quantity: s.qty ?? 1,
      description: s.desc,
      status: s.status ?? 'active',
      reservedForConversationId: null,
      createdAt: days(s.ageDays),
      updatedAt: days(Math.max(0, s.ageDays - 1)),
      images: Array.from({ length: count }, (_, j) => ({
        id: `${id}-img-${j}`,
        listingId: id,
        storagePath: `mock-card://${s.game}/${id}-${j}/${s.finish ?? 'normal'}/${s.cond}`,
        url: '', // resolved by MockClient.resolveImageUrl
        sortOrder: j,
      })),
    };
  });
}

// Two active conversations with message history.
// c-1: Karim buying Maya's Charizard (l-001). c-2: Maya buying Lina's Blue-Eyes (l-029).
export function buildSeedConversations(): { conversations: Conversation[]; messages: Message[] } {
  const conversations: Conversation[] = [
    {
      id: 'c-1',
      listingId: 'l-001',
      buyerId: 'u-karim',
      sellerId: 'u-maya',
      createdAt: mins(60 * 26),
      lastMessageAt: mins(12),
    },
    {
      id: 'c-2',
      listingId: 'l-029',
      buyerId: 'u-maya',
      sellerId: 'u-lina',
      createdAt: mins(60 * 49),
      lastMessageAt: mins(60 * 3),
    },
  ];

  let n = 0;
  const msg = (
    conversationId: string,
    senderId: string,
    body: string,
    minutesAgo: number,
    read = true,
  ): Message => ({
    id: `m-${String(++n).padStart(3, '0')}`,
    conversationId,
    senderId,
    kind: 'user',
    body,
    amount: null,
    offerStatus: null,
    createdAt: mins(minutesAgo),
    readAt: read ? mins(Math.max(0, minutesAgo - 2)) : null,
  });

  const messages: Message[] = [
    msg('c-1', 'u-karim', 'Hey! Is the Charizard still available? Those corner shots look better than most "LP" I\'ve seen.', 60 * 26),
    msg('c-1', 'u-maya', 'Still available! Yeah I grade conservatively — the back has the usual unlimited edgewear but the front is honestly close to NM.', 60 * 25),
    msg('c-1', 'u-karim', 'Would you do 290 if I pick it up in person this weekend?', 60 * 24),
    msg('c-1', 'u-maya', 'I can meet at 300, and I\'ll throw in a couple of the Celebrations promos. Hamra area works for me.', 60 * 23),
    msg('c-1', 'u-karim', 'Deal at 300 with the promos. Saturday afternoon somewhere near AUB?', 40),
    msg('c-1', 'u-maya', 'Saturday works. Caribou on Bliss street, 3pm? I\'ll bring a loupe so you can check it properly.', 25),
    msg('c-1', 'u-karim', 'Perfect, see you then. I\'ll bring cash exact.', 14),
    {
      id: 'm-offer-1',
      conversationId: 'c-1',
      senderId: 'u-karim',
      kind: 'offer',
      body: 'Cash on collection Saturday — locking it in.',
      amount: 300,
      offerStatus: 'proposed',
      createdAt: mins(12),
      readAt: null,
    },

    msg('c-2', 'u-maya', 'Hi Lina — the LOB Blue-Eyes, is that price flexible at all? MP 1st eds have been moving around 500.', 60 * 49),
    msg('c-2', 'u-lina', 'Hey Maya! I\'ve seen those but mine has no creases at all, which is rare for MP. I could do 530.', 60 * 47),
    msg('c-2', 'u-maya', 'Could you do a quick video under light so I can see the surface? If it\'s as clean as you say, 530 works.', 60 * 28),
    msg('c-2', 'u-lina', 'Of course — recording one tonight. I\'ll ship tracked and insured, or we can meet halfway in Jounieh.', 60 * 3),
  ];

  return { conversations, messages };
}

/**
 * Synthetic bulk listings for perf testing: VITE_MOCK_STRESS=<n> adds n
 * generated listings on top of the curated seed (see TESTING.md M7).
 */
export function buildStressListings(count: number): Listing[] {
  const games: Game[] = ['pokemon', 'magic', 'yugioh', 'onepiece', 'lorcana', 'other'];
  const conds: Condition[] = ['NM', 'LP', 'MP', 'HP', 'DMG'];
  const finishes: Finish[] = ['normal', 'holo', 'reverse', 'foil'];
  const sellers = ['u-maya', 'u-karim', 'u-lina'];
  const nouns = ['Dragon', 'Wizard', 'Leader', 'Trainer', 'Beast', 'Spirit', 'Captain', 'Golem'];
  const adjs = ['Ancient', 'Shiny', 'Promo', 'Alt Art', 'First Edition', 'Stamped', 'Error', 'Full Art'];
  return Array.from({ length: count }, (_, i) => {
    const id = `ls-${String(i + 1).padStart(4, '0')}`;
    const game = games[i % games.length];
    const cond = conds[i % conds.length];
    const finish = finishes[i % finishes.length];
    const graded = i % 11 === 0;
    return {
      id,
      sellerId: sellers[i % sellers.length],
      title: `${adjs[i % adjs.length]} ${nouns[(i >> 3) % nouns.length]} #${i + 1}`,
      game,
      setName: `Stress Set ${1 + (i % 12)}`,
      cardNumber: `${(i % 200) + 1}/200`,
      language: i % 7 === 0 ? 'Japanese' : 'English',
      condition: cond,
      finish,
      gradeCompany: graded ? 'PSA' : null,
      gradeValue: graded ? `PSA ${(i % 10) + 1}` : null,
      price: Math.round((5 + (i * 37) % 995) * 100) / 100,
      currency: 'USD',
      quantity: 1 + (i % 3),
      description: 'Synthetic listing generated for the 1,000-listing browse stress test.',
      status: 'active',
      reservedForConversationId: null,
      createdAt: days(1 + (i % 300)),
      updatedAt: days(i % 300),
      images: [
        {
          id: `${id}-img-0`,
          listingId: id,
          // Bucketed seed (not per-listing): synthetic cards share ~20
          // procedural images per game so the canvas cache absorbs the
          // cost of drawing 1,000+ covers.
          storagePath: `mock-card://${game}/bulk-${i % 20}/${finish}/${cond}`,
          url: '',
          sortOrder: 0,
        },
      ],
    };
  });
}

export const seedFavorites: Array<{ userId: string; listingId: string }> = [
  { userId: 'u-karim', listingId: 'l-004' },
  { userId: 'u-karim', listingId: 'l-029' },
  { userId: 'u-maya', listingId: 'l-027' },
  { userId: 'u-maya', listingId: 'l-014' },
  { userId: 'u-lina', listingId: 'l-001' },
];

export const seedReviews = [
  {
    id: 'r-1',
    conversationId: 'c-old-1',
    listingId: 'l-013',
    reviewerId: 'u-karim',
    revieweeId: 'u-maya',
    rating: 5,
    body: 'Smooth deal, card exactly as described. Met in person, easy to coordinate.',
    createdAt: days(80),
  },
  {
    id: 'r-2',
    conversationId: 'c-old-1',
    listingId: 'l-013',
    reviewerId: 'u-maya',
    revieweeId: 'u-karim',
    rating: 5,
    body: 'Great buyer — on time, no haggling games. Would trade again.',
    createdAt: days(80),
  },
  {
    id: 'r-3',
    conversationId: 'c-old-2',
    listingId: 'l-024',
    reviewerId: 'u-lina',
    revieweeId: 'u-karim',
    rating: 4,
    body: 'Card was fine, shipping took a bit longer than promised.',
    createdAt: days(50),
  },
];
