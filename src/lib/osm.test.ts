import { describe, expect, it } from 'vitest';
import { tilesAround, worldPixel } from './osm';

describe('OpenStreetMap tile maths', () => {
  it('agrees with the standard slippy-map tile formula', () => {
    // OSM wiki: xtile = ⌊(lon+180)/360·2ⁿ⌋, ytile = ⌊(1 − asinh(tan φ)/π)/2·2ⁿ⌋
    const slippy = (lat: number, lon: number, z: number) => {
      const n = 2 ** z;
      const phi = (lat * Math.PI) / 180;
      return [Math.floor(((lon + 180) / 360) * n), Math.floor(((1 - Math.asinh(Math.tan(phi)) / Math.PI) / 2) * n)];
    };
    for (const [lat, lon] of [[33.8938, 35.5018], [34.4367, 35.8497], [-33.8688, 151.2093], [51.5072, -0.1276]]) {
      for (const z of [8, 15, 18]) {
        const px = worldPixel({ latitude: lat, longitude: lon }, z);
        expect([Math.floor(px.x / 256), Math.floor(px.y / 256)]).toEqual(slippy(lat, lon, z));
      }
    }
  });

  it('covers the whole window and centres the point', () => {
    const p = { latitude: 33.8938, longitude: 35.5018 };
    const tiles = tilesAround(p, 15, 280, 140);
    expect(tiles.length).toBeGreaterThanOrEqual(2);
    expect(tiles.length).toBeLessThanOrEqual(6);
    // every pixel of the window falls inside some tile
    for (const [x, y] of [[0, 0], [279, 0], [0, 139], [279, 139], [140, 70]]) {
      expect(tiles.some((t) => x >= t.left && x < t.left + 256 && y >= t.top && y < t.top + 256)).toBe(true);
    }
    expect(tiles[0].url).toMatch(/^https:\/\/tile\.openstreetmap\.org\/15\/\d+\/\d+\.png$/);
  });
});
