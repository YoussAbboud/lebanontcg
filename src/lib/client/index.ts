import type { MarketplaceClient } from './MarketplaceClient';
import { MockClient } from './MockClient';
import { runtimeConfig } from '../config';

let instance: MarketplaceClient | null = null;

export function isMockMode(): boolean {
  return runtimeConfig().mock;
}

export async function createClient(): Promise<MarketplaceClient> {
  if (instance) return instance;
  const config = runtimeConfig();
  if (config.mock) {
    instance = new MockClient();
  } else {
    const { SupabaseMarketplaceClient } = await import('./SupabaseClient');
    instance = new SupabaseMarketplaceClient(config.supabaseUrl, config.supabaseKey);
  }
  return instance!;
}
