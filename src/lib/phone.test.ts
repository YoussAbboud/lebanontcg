import { describe, expect, it } from 'vitest';
import { formatPhone, nationalPart, normalizePhone, whatsappHref } from './phone';
import { COUNTRIES, countryOfPhone, searchCountries } from './countries';
import { flagUrl } from './flags';

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

  it('splits other numbers after their calling code', () => {
    expect(formatPhone('+33612345678')).toBe('+33 612345678');
    expect(formatPhone('+12025550123')).toBe('+1 2025550123');
  });
});

describe('links', () => {
  it('builds a WhatsApp link from the international digits', () => {
    expect(whatsappHref('+96170123456')).toBe('https://wa.me/96170123456');
  });
});

describe('the picked country code', () => {
  it('prefixes a national number with the picked code', () => {
    expect(normalizePhone('06 12 34 56 78', '33')).toBe('+33612345678');
    expect(normalizePhone('50 123 4567', '971')).toBe('+971501234567');
  });

  it('keeps the leading 0 where the country does (Italy)', () => {
    expect(normalizePhone('06 1234 5678', '39')).toBe('+390612345678');
  });

  it('lets a typed + or 00 prefix win over the picker', () => {
    expect(normalizePhone('+961 70 123 456', '33')).toBe('+96170123456');
    expect(normalizePhone('0033 6 12 34 56 78', '961')).toBe('+33612345678');
  });

  it('gives back the national part for prefilling', () => {
    expect(nationalPart('+96170123456', '961')).toBe('70 123 456');
    expect(nationalPart('+33612345678', '33')).toBe('612345678');
  });
});

describe('countries', () => {
  it('starts with Lebanon and has a flag for every entry', () => {
    expect(COUNTRIES[0]).toMatchObject({ iso: 'LB', dial: '961', name: 'Lebanon' });
    expect(COUNTRIES.length).toBeGreaterThan(200);
    expect(COUNTRIES.every((c) => flagUrl(c.iso))).toBe(true);
  });

  it('finds the country of a number, longest code first', () => {
    expect(countryOfPhone('+96170123456')?.iso).toBe('LB');
    expect(countryOfPhone('+971501234567')?.iso).toBe('AE');
    expect(countryOfPhone('+12025550123')?.iso).toBe('US');
    expect(countryOfPhone('+447700900123')?.iso).toBe('GB');
  });

  it('searches by name, ISO code or calling code', () => {
    expect(searchCountries('leb')[0].iso).toBe('LB');
    expect(searchCountries('fr').some((c) => c.iso === 'FR')).toBe(true);
    expect(searchCountries('+961').map((c) => c.iso)).toEqual(['LB']);
  });
});
