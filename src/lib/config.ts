// Public runtime configuration.
//
// The Supabase project URL and publishable key are PUBLIC values — they
// ship to every browser and RLS is what protects the data. They live here
// as fallbacks because git-based hosts (Vercel included) don't feed
// committed .env files into the build; platform environment variables
// always win when present.
const FALLBACK_SUPABASE_URL = 'https://pisckiopuulgvtlukueo.supabase.co';
const FALLBACK_SUPABASE_KEY = 'sb_publishable__aJyC2b3m0z2dpcuAVutJg_JvM9h-fh';

export interface RuntimeConfig {
  mock: boolean;
  supabaseUrl: string;
  supabaseKey: string;
}

/**
 * Pure resolver (unit-tested):
 *  - VITE_MOCK=1 → mock, VITE_MOCK=0 → live, regardless of credentials.
 *  - Unset → live when credentials resolve (env or fallback), else mock.
 */
export function resolveConfig(env: {
  mock?: string;
  url?: string;
  key?: string;
}): RuntimeConfig {
  const supabaseUrl = env.url || FALLBACK_SUPABASE_URL;
  const supabaseKey = env.key || FALLBACK_SUPABASE_KEY;
  const mock =
    env.mock === '1' ? true : env.mock === '0' ? false : !(supabaseUrl && supabaseKey);
  return { mock, supabaseUrl, supabaseKey };
}

export function runtimeConfig(): RuntimeConfig {
  return resolveConfig({
    mock: import.meta.env.VITE_MOCK,
    url: import.meta.env.VITE_SUPABASE_URL,
    key: import.meta.env.VITE_SUPABASE_ANON_KEY,
  });
}
