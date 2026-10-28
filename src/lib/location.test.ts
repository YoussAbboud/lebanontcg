import { describe, expect, it } from 'vitest';
import { formatCoords, googleMapsHref, roundCoord, wazeHref } from './location';

describe('formatting and links', () => {
  const p = { latitude: 33.93212, longitude: 35.58934 };
  it('rounds to 5 decimals, the precision the database keeps', () => {
    expect(roundCoord(33.9321249)).toBe(33.93212);
    expect(formatCoords({ latitude: 33.9, longitude: 35.5 })).toBe('33.90000, 35.50000');
  });
  it('links out to Google Maps and Waze', () => {
    expect(googleMapsHref(p)).toBe('https://www.google.com/maps/search/?api=1&query=33.93212,35.58934');
    expect(wazeHref(p)).toBe('https://waze.com/ul?ll=33.93212,35.58934&navigate=yes');
  });
});
