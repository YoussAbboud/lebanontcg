import { describe, expect, it } from 'vitest';
import {
  detectIosBrowser,
  detectPlatform,
  isSamsungBrowser,
  parseSnooze,
  shouldOfferInstall,
  SNOOZE_DAYS,
} from './install';

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/125.0.6422.80 Mobile/15E148 Safari/604.1';
const IPAD =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const PIXEL_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36';
const SAMSUNG =
  'Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36';
const MAC_DESKTOP =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

describe('detectPlatform', () => {
  it('tells iPhones, Androids and desktops apart', () => {
    expect(detectPlatform(IPHONE_SAFARI)).toBe('ios');
    expect(detectPlatform(IPHONE_CHROME)).toBe('ios');
    expect(detectPlatform(PIXEL_CHROME)).toBe('android');
    expect(detectPlatform(SAMSUNG)).toBe('android');
    expect(detectPlatform(WINDOWS)).toBe('other');
  });

  it('treats a touch "Mac" as an iPad and a real Mac as a desktop', () => {
    expect(detectPlatform(IPAD, 5)).toBe('ios');
    expect(detectPlatform(MAC_DESKTOP, 0)).toBe('other');
  });
});

describe('browser flavours', () => {
  it('knows where the iOS Share button lives', () => {
    expect(detectIosBrowser(IPHONE_SAFARI)).toBe('safari');
    expect(detectIosBrowser(IPHONE_CHROME)).toBe('other');
  });

  it('spots Samsung Internet', () => {
    expect(isSamsungBrowser(SAMSUNG)).toBe(true);
    expect(isSamsungBrowser(PIXEL_CHROME)).toBe(false);
  });
});

describe('parseSnooze', () => {
  const now = 1_700_000_000_000;

  it('reads a live snooze, a permanent dismissal, and nothing else', () => {
    expect(parseSnooze(JSON.stringify({ until: now + 1000 }), now)).toEqual({ kind: 'until', until: now + 1000 });
    expect(parseSnooze(JSON.stringify({ never: true }), now)).toEqual({ kind: 'never' });
    expect(parseSnooze(JSON.stringify({ until: now - 1 }), now)).toBeNull();
    expect(parseSnooze(null, now)).toBeNull();
    expect(parseSnooze('{not json', now)).toBeNull();
    expect(parseSnooze(JSON.stringify({ until: 'soon' }), now)).toBeNull();
  });

  it('a "not now" lasts two weeks', () => {
    const until = now + SNOOZE_DAYS * 86_400_000;
    expect(parseSnooze(JSON.stringify({ until }), until - 1)).not.toBeNull();
    expect(parseSnooze(JSON.stringify({ until }), until)).toBeNull();
  });
});

describe('shouldOfferInstall', () => {
  const base = { platform: 'ios' as const, standalone: false, mobile: true, snooze: null };

  it('offers on a phone browser that has not said no', () => {
    expect(shouldOfferInstall(base)).toBe(true);
    expect(shouldOfferInstall({ ...base, platform: 'android' })).toBe(true);
  });

  it('stays quiet once installed, on desktops, and while snoozed', () => {
    expect(shouldOfferInstall({ ...base, standalone: true })).toBe(false);
    expect(shouldOfferInstall({ ...base, mobile: false })).toBe(false);
    expect(shouldOfferInstall({ ...base, platform: 'other' })).toBe(false);
    expect(shouldOfferInstall({ ...base, snooze: { kind: 'never' } })).toBe(false);
    expect(shouldOfferInstall({ ...base, snooze: { kind: 'until', until: 1 } })).toBe(false);
  });
});
