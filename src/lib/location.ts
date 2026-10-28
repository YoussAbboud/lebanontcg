// Locations shared in chat: a point plus an optional place name, picked from
// the device's position or on an OpenStreetMap (see osm.ts). The card links
// out to Google Maps and Waze, which people in Lebanon use to get there.

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
