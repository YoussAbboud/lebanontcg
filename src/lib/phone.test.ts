import { describe, expect, it } from 'vitest';
import { formatPhone, normalizePhone, whatsappHref } from './phone';

describe('normalizePhone', () => {
  it('reads numbers without a country code as Lebanese', () => {
    expect(normalizePhone('70 123 456')).toBe('+96170123456');
    expect(normalizePhone('03 123 456')).toBe('+9613123456');
    expect(normalizePhone('03-123456')).toBe('+9613123456');
  });

  it('keeps an explicit country code', () => {
    expect(normalizePhone('+961 70 123 456')).toBe('+96170123456');
    expect(normalizePhone('00961 70 123 456')).toBe('+96170123456');
    expect(normalizePhone('+33 6 12 34 56 78')).toBe('+33612345678');
  });

  it('rejects things that are not phone numbers', () => {
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone('call me')).toBeNull();
    expect(normalizePhone('12')).toBeNull();
    expect(normalizePhone('+961 70 123 456 789')).toBeNull();
    expect(normalizePhone('+0 123 4567')).toBeNull();
    expect(normalizePhone('+1234567890123456')).toBeNull();
  });
});

describe('formatPhone', () => {
  it('groups Lebanese mobiles and landlines', () => {
    expect(formatPhone('+96170123456')).toBe('+961 70 123 456');
    expect(formatPhone('+9613123456')).toBe('+961 3 123 456');
  });

  it('leaves other countries as stored', () => {
    expect(formatPhone('+33612345678')).toBe('+33612345678');
  });
});

describe('links', () => {
  it('builds a WhatsApp link from the international digits', () => {
    expect(whatsappHref('+96170123456')).toBe('https://wa.me/96170123456');
  });
});
