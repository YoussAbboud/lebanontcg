import { describe, expect, it } from 'vitest';
import { formatCoords, googleMapsHref, parsePoint, roundCoord, wazeHref } from './location';

const point = (latitude: number, longitude: number) => ({ ok: true, point: { latitude, longitude } });

describe('parsePoint', () => {
  it('reads plain coordinates', () => {
    expect(parsePoint('33.89380, 35.50180')).toEqual(point(33.8938, 35.5018));
    expect(parsePoint('-33.8688,151.2093')).toEqual(point(-33.8688, 151.2093));
  });

  it('prefers a Google Maps place pin over the map centre', () => {
    const url =
      'https://www.google.com/maps/place/ABC+Dbayeh/@33.9300,35.5800,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d33.932123!4d35.589345';
    expect(parsePoint(url)).toEqual(point(33.93212, 35.58935));
  });

  it('reads the map centre, query links, Apple Maps and Waze', () => {
    expect(parsePoint('https://www.google.com/maps/@33.8938,35.5018,15z')).toEqual(point(33.8938, 35.5018));
    expect(parsePoint('https://www.google.com/maps?q=33.8938,35.5018')).toEqual(point(33.8938, 35.5018));
    expect(parsePoint('https://maps.apple.com/?ll=33.8938,35.5018&q=Pin')).toEqual(point(33.8938, 35.5018));
    expect(parsePoint('https://waze.com/ul?ll=33.8938%2C35.5018&navigate=yes')).toEqual(point(33.8938, 35.5018));
  });

  it('explains short links and rejects the rest', () => {
    expect(parsePoint('https://maps.app.goo.gl/AbCdEf123')).toEqual({ ok: false, reason: 'short-link' });
    expect(parsePoint('ABC Mall')).toEqual({ ok: false, reason: 'unreadable' });
    expect(parsePoint('95.1, 35.5')).toEqual({ ok: false, reason: 'unreadable' });
  });
});

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
