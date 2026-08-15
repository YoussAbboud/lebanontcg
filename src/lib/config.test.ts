import { describe, expect, it } from 'vitest';
import { resolveConfig } from './config';

describe('resolveConfig', () => {
  it('explicit VITE_MOCK=1 forces mock even with credentials', () => {
    expect(resolveConfig({ mock: '1', url: 'https://x.supabase.co', key: 'k' }).mock).toBe(true);
  });

  it('explicit VITE_MOCK=0 forces live', () => {
    const c = resolveConfig({ mock: '0', url: 'https://x.supabase.co', key: 'k' });
    expect(c.mock).toBe(false);
    expect(c.supabaseUrl).toBe('https://x.supabase.co');
  });

  it('unset mock defaults to live because fallbacks resolve', () => {
    const c = resolveConfig({});
    expect(c.mock).toBe(false);
    expect(c.supabaseUrl).toMatch(/^https:\/\/.+\.supabase\.co$/);
    expect(c.supabaseKey.startsWith('sb_publishable_')).toBe(true);
  });

  it('env vars override the fallbacks', () => {
    const c = resolveConfig({ mock: '0', url: 'https://other.supabase.co', key: 'sb_publishable_other' });
    expect(c.supabaseUrl).toBe('https://other.supabase.co');
    expect(c.supabaseKey).toBe('sb_publishable_other');
  });
});
