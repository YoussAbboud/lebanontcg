// Locations shared in chat: a point plus an optional place name. The site
// embeds no map (no third-party map service runs on it); the card links out
// to Google Maps and Waze, which people in Lebanon already use to get there.

export interface SharedPoint {
  latitude: number;
  longitude: number;
}

/** 5 decimals ≈ 1 m — what the database keeps (numeric(8,5)). */
export const roundCoord = (n: number): number => Math.round(n * 1e5) / 1e5;

export const PLACE_MAX_LENGTH = 120;

/** "33.93212, 35.58934" */
export const formatCoords = (p: SharedPoint): string =>
  `${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`;

export const googleMapsHref = (p: SharedPoint): string =>
  `https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}`;

export const wazeHref = (p: SharedPoint): string =>
  `https://waze.com/ul?ll=${p.latitude},${p.longitude}&navigate=yes`;

/**
 * The device's current position, rounded to 5 decimals, with its accuracy
 * in metres. Rejects with a sentence the chat can show as-is.
 */
export function currentPosition(): Promise<SharedPoint & { accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('This browser can’t share a location.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: roundCoord(pos.coords.latitude),
          longitude: roundCoord(pos.coords.longitude),
          accuracy: Math.round(pos.coords.accuracy),
        }),
      (err) =>
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? 'Location access is off for this site. Allow it in your browser settings and try again.'
              : err.code === err.TIMEOUT
                ? 'Finding your location took too long. Try again, ideally outdoors or with Wi-Fi on.'
                : 'Your location isn’t available right now. Try again in a moment.',
          ),
        ),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    );
  });
}

const NUM = String.raw`(-?\d{1,3}(?:\.\d+)?)`;
// Most precise first: a place link's pin (!3d…!4d…), then a query point,
// then the map's centre (@lat,lng), then bare "lat, lng".
const PATTERNS = [
  new RegExp(String.raw`!3d${NUM}!4d${NUM}`),
  new RegExp(String.raw`[?&](?:q|query|ll|daddr|destination)=(?:loc:)?${NUM}(?:,|%2C)\s*${NUM}`, 'i'),
  new RegExp(String.raw`@${NUM},${NUM}`),
  new RegExp(String.raw`^\s*${NUM}\s*,\s*${NUM}\s*$`),
];

export type PointParse =
  | { ok: true; point: SharedPoint }
  | { ok: false; reason: 'short-link' | 'unreadable' };

/**
 * Reads a point from what people paste: coordinates ("33.89380, 35.50180")
 * or a full Google Maps, Apple Maps or Waze link. Short share links
 * (maps.app.goo.gl) only resolve over the network, which the site does not
 * do, so they come back as 'short-link' for the chat to explain.
 */
export function parsePoint(text: string): PointParse {
  const t = text.trim();
  if (/^(https?:\/\/)?(maps\.app\.goo\.gl|goo\.gl\/maps)\//i.test(t)) {
    return { ok: false, reason: 'short-link' };
  }
  for (const re of PATTERNS) {
    const m = re.exec(t);
    if (!m) continue;
    const latitude = Number(m[1]);
    const longitude = Number(m[2]);
    if (Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) {
      return { ok: true, point: { latitude: roundCoord(latitude), longitude: roundCoord(longitude) } };
    }
  }
  return { ok: false, reason: 'unreadable' };
}
