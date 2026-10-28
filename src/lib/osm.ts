// OpenStreetMap tiles: the one outside service the site uses, for maps in
// chat (the location picker and the preview on a shared location). Tiles
// are plain images from tile.openstreetmap.org, allowed by the CSP's
// img-src; OSM's tile policy asks for visible attribution and a referrer
// (Referrer-Policy sends our origin).

import type { SharedPoint } from './location';

export const osmTileUrl = (z: number, x: number, y: number): string =>
  `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
export const OSM_TILE_TEMPLATE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const OSM_COPYRIGHT_URL = 'https://www.openstreetmap.org/copyright';

/** Where the picker opens when there is no point yet: all of Lebanon. */
export const LEBANON_VIEW = { latitude: 33.87, longitude: 35.86, zoom: 8 };

const TILE = 256;

/** Web Mercator pixel position of a point at zoom z. */
export function worldPixel(p: SharedPoint, z: number): { x: number; y: number } {
  const size = TILE * 2 ** z;
  const sin = Math.sin((p.latitude * Math.PI) / 180);
  return {
    x: ((p.longitude + 180) / 360) * size,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size,
  };
}

export interface PlacedTile {
  url: string;
  left: number;
  top: number;
}

/** The tiles covering a width × height window centred on p, with their
    offsets inside the window. */
export function tilesAround(p: SharedPoint, z: number, width: number, height: number): PlacedTile[] {
  const c = worldPixel(p, z);
  const ox = c.x - width / 2;
  const oy = c.y - height / 2;
  const n = 2 ** z;
  const tiles: PlacedTile[] = [];
  for (let ty = Math.floor(oy / TILE); ty <= Math.floor((oy + height - 1) / TILE); ty++) {
    if (ty < 0 || ty >= n) continue;
    for (let tx = Math.floor(ox / TILE); tx <= Math.floor((ox + width - 1) / TILE); tx++) {
      const wrapped = ((tx % n) + n) % n;
      tiles.push({ url: osmTileUrl(z, wrapped, ty), left: tx * TILE - ox, top: ty * TILE - oy });
    }
  }
  return tiles;
}
