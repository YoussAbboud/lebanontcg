import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { formatCoords, roundCoord, type SharedPoint } from '../lib/location';
import { LEBANON_VIEW, OSM_COPYRIGHT_URL, OSM_TILE_TEMPLATE } from '../lib/osm';
import './maps.css';

/**
 * "Choose on the map": a full OpenStreetMap you pan under a fixed pin, the
 * way ride and delivery apps do it, so a thumb never has to hit a marker.
 * Loaded on demand (React.lazy) so Leaflet only downloads when opened.
 */
export default function MapPicker({
  start,
  onPick,
  onClose,
}: {
  start: SharedPoint | null;
  onPick: (point: SharedPoint) => void;
  onClose: () => void;
}) {
  const mapEl = useRef<HTMLDivElement>(null);
  const [center, setCenter] = useState<SharedPoint>(
    start ?? { latitude: LEBANON_VIEW.latitude, longitude: LEBANON_VIEW.longitude },
  );

  useEffect(() => {
    if (!mapEl.current) return;
    const map = L.map(mapEl.current, { zoomControl: true }).setView(
      start ? [start.latitude, start.longitude] : [LEBANON_VIEW.latitude, LEBANON_VIEW.longitude],
      start ? 16 : LEBANON_VIEW.zoom,
    );
    L.tileLayer(OSM_TILE_TEMPLATE, {
      maxZoom: 19,
      attribution: `© <a href="${OSM_COPYRIGHT_URL}" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors`,
      referrerPolicy: 'strict-origin-when-cross-origin',
    }).addTo(map);
    const sync = () => {
      const c = map.getCenter();
      setCenter({ latitude: roundCoord(c.lat), longitude: roundCoord(((c.lng + 540) % 360) - 180) });
    };
    map.on('move', sync);
    sync();
    return () => {
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- built once; `start` only seeds the view
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Portalled to <body>: inside the page's main area it would sit under the sticky header.
  return createPortal(
    <div
      className="mappick-overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="mappick" role="dialog" aria-modal="true" aria-labelledby="mappick-title">
        <div className="mappick-head">
          <h2 id="mappick-title" className="display mappick-title">Choose a meeting place</h2>
          <p className="mappick-sub">Move the map until the pin sits on the spot. Somewhere public.</p>
        </div>
        <div className="mappick-map">
          <div ref={mapEl} className="mappick-leaflet" />
          <span className="map-pin map-pin-lg" aria-hidden="true" />
        </div>
        <div className="mappick-foot">
          <span className="mono-value mappick-coords">{formatCoords(center)}</span>
          <button type="button" className="btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-acid" onClick={() => onPick(center)}>
            Use this spot
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
