// Vercel serverless function: the sitemap, built from the live catalogue.
// Static routes, every active listing and every seller with a handle —
// read through PostgREST as the anonymous role, so only what the public
// can already see is ever listed. Served at /sitemap.xml by a rewrite.
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

const STATIC_ROUTES: Array<{ path: string; priority: string; changefreq: string }> = [
  { path: '/', priority: '1.0', changefreq: 'hourly' },
  { path: '/browse', priority: '0.9', changefreq: 'hourly' },
  { path: '/sellers', priority: '0.7', changefreq: 'daily' },
  { path: '/plans', priority: '0.6', changefreq: 'monthly' },
  { path: '/pregrade', priority: '0.6', changefreq: 'monthly' },
  { path: '/safety', priority: '0.5', changefreq: 'monthly' },
  { path: '/terms', priority: '0.3', changefreq: 'yearly' },
  { path: '/privacy', priority: '0.3', changefreq: 'yearly' },
];

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function rows<T>(path: string): Promise<T[]> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!r.ok) return [];
  return (await r.json()) as T[];
}

export default async function handler(_req: any, res: any) {
  const [listings, sellers] = await Promise.all([
    rows<{ id: string; updated_at: string }>(
      'listings?select=id,updated_at&status=eq.active&order=updated_at.desc&limit=5000',
    ),
    rows<{ username: string; created_at: string }>(
      'profiles?select=username,created_at&username=not.is.null&order=created_at.desc&limit=5000',
    ),
  ]);

  const now = new Date().toISOString();
  const urls: string[] = [];
  for (const r of STATIC_ROUTES) {
    urls.push(
      `<url><loc>${SITE_URL}${r.path}</loc><lastmod>${now}</lastmod><changefreq>${r.changefreq}</changefreq><priority>${r.priority}</priority></url>`,
    );
  }
  for (const l of listings) {
    urls.push(
      `<url><loc>${SITE_URL}/listing/${esc(l.id)}</loc><lastmod>${esc(l.updated_at)}</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url>`,
    );
  }
  for (const s of sellers) {
    if (!/^[a-z0-9_]{3,20}$/.test(s.username)) continue;
    urls.push(
      `<url><loc>${SITE_URL}/u/${s.username}</loc><changefreq>weekly</changefreq><priority>0.5</priority></url>`,
    );
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;

  res.status(200);
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  // Fresh enough for crawlers, cheap enough for us.
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  res.send(xml);
}
