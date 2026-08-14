// Placeholder until M6 wires the real Supabase implementation.
// Only loaded when VITE_MOCK=0.
import type { MarketplaceClient } from './MarketplaceClient';

export class SupabaseMarketplaceClient {
  constructor(_url: string, _key: string) {
    throw new Error('SupabaseMarketplaceClient lands in milestone M6 — run with VITE_MOCK=1.');
  }
}

// Type-level check that the class will satisfy the interface once implemented.
export type _Check = MarketplaceClient;
