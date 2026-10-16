// Vercel serverless function: link previews for listings and profiles.
//
// WhatsApp, Facebook, Telegram, Twitter and friends do not run
// JavaScript, so a shared /listing/:id link would show the generic site
// card. vercel.json rewrites those scrapers (matched by User-Agent) here;
// this serves the REAL app shell (index.html) with the <head> metadata
// replaced for the thing being shared, so a scraper that does run
// JavaScript still gets the full page. People and search engines are
// never routed here — Google renders the SPA and reads the head the
// client writes (src/lib/usePageMeta.ts). Keep the copy in step.
//
// SELF-CONTAINED on purpose (see api/pregrade/assess.ts for why).

const SITE_URL = 'https://www.lebanontcg.com';
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://pisckiopuulgvtlukueo.supabase.co';
const SUPABASE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable__aJyC2b3m0z2dpcuAVutJg_JvM9h-fh';

// Mirror of GAME_LABELS in src/lib/types.ts.
const GAME_LABELS: Record<string, string> = {
  pokemon: 'Pokémon',
  magic: 'Magic: The Gathering',
  yugioh: 'Yu-Gi-Oh!',
  onepiece: 'One Piece',
  lorcana: 'Lorcana',
  other: 'Other',
};
const CONDITION_LABELS: Record<string, string> = {
  NM: 'Near Mint',
  LP: 'Lightly Played',
  MP: 'Moderately Played',
  HP: 'Heavily Played',
  DMG: 'Damaged',
};

interface ListingRow {
  id: string;
  title: string;
  game: string;
  condition: string;
  grade_company: string | null;
  grade_value: string | null;
  price: number | string;
  currency: string;
  status: string;
  sale_type: string;
  description: string;
  seller: { username: string | null; display_name: string } | null;
  listing_images: Array<{ storage_path: string; sort_order: number }>;
}

interface ProfileRow {
  username: string | null;
  display_name: string;
  bio: string;
  avatar_url: string | null;
  rating_avg: number | null;
  rating_count: number;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function one<T>(path: string): Promise<T | null> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      authorization: `Bearer ${SUPABASE_KEY}`,
      accept: 'application/vnd.pgrst.object+json',
    },
  });
  if (!r.ok) return null;
  return (await r.json()) as T;
}

function imageUrl(storagePath: string): string {
  if (/^(https?:|data:)/.test(storagePath)) return storagePath;
  return `${SUPABASE_URL}/storage/v1/object/public/listing-images/${storagePath}`;
}

interface Head {
  title: string;
  description: string;
  url: string;
  image: string;
  type: string;
  jsonLd: Record<string, unknown> | null;
  noindex: boolean;
}

async function listingHead(id: string): Promise<Head | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const l = await one<ListingRow>(
    `listings?select=id,title,game,condition,grade_company,grade_value,price,currency,status,sale_type,description,` +
      `seller:profiles!listings_seller_id_fkey(username,display_name),listing_images(storage_path,sort_order)&id=eq.${id}`,
  );
  if (!l) return null;
  const images = [...(l.listing_images ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((i) => imageUrl(i.storage_path));
  const price = `${l.currency === 'USD' ? '$' : `${l.currency} `}${Number(l.price)}`;
  const graded = l.grade_company && l.grade_value ? `${l.grade_company} ${l.grade_value}` : (CONDITION_LABELS[l.condition] ?? l.condition);
  const lead = l.sale_type === 'auction' ? `Live auction, current bid ${price}` : price;
  const seller = l.seller?.display_name ?? 'a collector';
  const url = `${SITE_URL}/listing/${l.id}`;
  return {
    title: `${l.title} — ${price} · LebanonTCG`,
    description: `${l.title} — ${GAME_LABELS[l.game] ?? l.game}, ${graded}. ${lead}, listed by ${seller} on LebanonTCG.`,
    url,
    image: images[0] ?? `${SITE_URL}/og.png`,
    type: 'product',
    noindex: l.status === 'removed',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: l.title,
      image: images,
      description: l.description || undefined,
      category: GAME_LABELS[l.game] ?? l.game,
      url,
      offers: {
        '@type': 'Offer',
        url,
        price: Number(l.price),
        priceCurrency: l.currency,
        availability:
          l.status === 'sold' ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
        itemCondition:
          l.condition === 'DMG'
            ? 'https://schema.org/DamagedCondition'
            : 'https://schema.org/UsedCondition',
        seller: l.seller
          ? {
              '@type': 'Person',
              name: l.seller.display_name,
              url: l.seller.username ? `${SITE_URL}/u/${l.seller.username}` : undefined,
            }
          : undefined,
      },
    },
  };
}

async function profileHead(username: string): Promise<Head | null> {
  if (!/^[a-z0-9_]{3,20}$/.test(username)) return null;
  const p = await one<ProfileRow>(
    `profiles?select=username,display_name,bio,avatar_url,rating_avg,rating_count&username=ilike.${username}`,
  );
  if (!p) return null;
  const handle = p.username ? `@${p.username}` : p.display_name;
  const rating =
    p.rating_count > 0 && p.rating_avg !== null
      ? ` Rated ${Number(p.rating_avg).toFixed(1)}/5 from ${p.rating_count} review${p.rating_count === 1 ? '' : 's'}.`
      : '';
  const url = `${SITE_URL}/u/${p.username ?? username}`;
  return {
    title: `${p.display_name} (${handle}) · LebanonTCG`,
    description: `${p.display_name} (${handle}) on LebanonTCG.${rating}${p.bio ? ` ${p.bio.slice(0, 140)}` : ''}`,
    url,
    image: p.avatar_url && /^https?:/.test(p.avatar_url) ? p.avatar_url : `${SITE_URL}/og.png`,
    type: 'profile',
    noindex: false,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: p.display_name,
      alternateName: p.username ?? undefined,
      description: p.bio || undefined,
      url,
    },
  };
}

/** The deployed app shell, fetched from this same deployment so asset
    hashes match. The host is allow-listed: a forged Host header must not
    turn this into a fetch-anything proxy. */
async function appShell(host: string | undefined): Promise<string | null> {
  const safeHost =
    host && /^(www\.)?lebanontcg\.com$|^[a-z0-9-]+\.vercel\.app$/i.test(host) ? host : 'www.lebanontcg.com';
  const r = await fetch(`https://${safeHost}/index.html`, {
    headers: { 'user-agent': 'lebanontcg-share/1.0' },
  });
  if (!r.ok) return null;
  return r.text();
}

function rewriteHead(html: string, h: Head): string {
  // Drop the static tags we are about to replace, then inject ours
  // before </head>. The JSON-LD WebSite block stays; a page may carry both.
  let out = html
    .replace(/<title>[^<]*<\/title>/i, '')
    .replace(/<meta (?:name|property)="(?:description|robots|og:title|og:description|og:url|og:image|og:image:width|og:image:height|og:image:alt|og:type|twitter:card|twitter:title|twitter:description|twitter:image)"[^>]*>\s*/gi, '')
    .replace(/<link rel="canonical"[^>]*>\s*/i, '');
  const tags = [
    `<title>${esc(h.title)}</title>`,
    `<meta name="description" content="${esc(h.description)}" />`,
    `<meta name="robots" content="${h.noindex ? 'noindex, nofollow' : 'index, follow'}" />`,
    `<link rel="canonical" href="${esc(h.url)}" />`,
    `<meta property="og:type" content="${h.type}" />`,
    `<meta property="og:url" content="${esc(h.url)}" />`,
    `<meta property="og:title" content="${esc(h.title)}" />`,
    `<meta property="og:description" content="${esc(h.description)}" />`,
    `<meta property="og:image" content="${esc(h.image)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(h.title)}" />`,
    `<meta name="twitter:description" content="${esc(h.description)}" />`,
    `<meta name="twitter:image" content="${esc(h.image)}" />`,
    h.jsonLd
      ? `<script type="application/ld+json">${JSON.stringify(h.jsonLd).replace(/</g, '\\u003c')}</script>`
      : '',
  ].join('\n    ');
  out = out.replace(/<\/head>/i, `    ${tags}\n  </head>`);
  return out;
}

export default async function handler(req: any, res: any) {
  const q = (req.query ?? {}) as { id?: string; u?: string };
  const host = (req.headers['x-forwarded-host'] || req.headers.host) as string | undefined;
  try {
    const head = q.id ? await listingHead(String(q.id)) : q.u ? await profileHead(String(q.u).toLowerCase()) : null;
    const shell = await appShell(host);
    if (!shell) {
      // No shell to decorate: send the scraper on to the plain page.
      res.status(302);
      res.setHeader('Location', q.id ? `/listing/${q.id}` : q.u ? `/u/${q.u}` : '/');
      res.send('');
      return;
    }
    const html = head ? rewriteHead(shell, head) : shell;
    res.status(head ? 200 : 404);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
    res.setHeader('X-Robots-Tag', head && !head.noindex ? 'all' : 'noindex');
    res.send(html);
  } catch {
    res.status(302);
    res.setHeader('Location', q.id ? `/listing/${q.id}` : q.u ? `/u/${q.u}` : '/');
    res.send('');
  }
}
