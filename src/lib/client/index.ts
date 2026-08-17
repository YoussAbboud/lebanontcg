import type { MarketplaceClient } from './MarketplaceClient';
import { MockClient } from './MockClient';
import { runtimeConfig } from '../config';
import { withBusy } from '../busyCursor';

let instance: MarketplaceClient | null = null;

export function isMockMode(): boolean {
  return runtimeConfig().mock;
}

/**
 * Wrap every promise-returning method so the animated busy cursor covers
 * all data access from one place. Synchronous members (isMock, sendTyping,
 * resolveImageUrl, the subscribe* unsubscribers) pass straight through.
 */
function withBusyCursor(client: MarketplaceClient): MarketplaceClient {
  return new Proxy(client, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function') return value;
      return function (this: unknown, ...args: unknown[]) {
        const result = (value as (...a: unknown[]) => unknown).apply(target, args);
        if (result instanceof Promise) {
          return withBusy(() => result as Promise<unknown>);
        }
        return result;
      };
    },
  });
}

export async function createClient(): Promise<MarketplaceClient> {
  if (instance) return instance;
  const config = runtimeConfig();
  if (config.mock) {
    instance = withBusyCursor(new MockClient());
  } else {
    const { SupabaseMarketplaceClient } = await import('./SupabaseClient');
    instance = withBusyCursor(
      new SupabaseMarketplaceClient(config.supabaseUrl, config.supabaseKey),
    );
  }
  return instance!;
}
