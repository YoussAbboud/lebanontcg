import type { MarketplaceClient } from './MarketplaceClient';
import { MockClient } from './MockClient';

let instance: MarketplaceClient | null = null;

export function isMockMode(): boolean {
  // Mock is the zero-config default: anything except an explicit "0" runs
  // offline. Live mode additionally requires the Supabase env vars.
  return import.meta.env.VITE_MOCK !== '0';
}

export async function createClient(): Promise<MarketplaceClient> {
  if (instance) return instance;
  if (isMockMode()) {
    instance = new MockClient();
  } else {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error(
        'VITE_MOCK=0 but VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set. ' +
          'Copy .env.example to .env and fill in your Supabase project settings.',
      );
    }
    const { SupabaseMarketplaceClient } = await import('./SupabaseClient');
    // Cast until the real implementation lands in M6 (constructor throws today).
    instance = new SupabaseMarketplaceClient(url, key) as unknown as MarketplaceClient;
  }
  return instance!;
}
