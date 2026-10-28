import type { SharedPoint } from '../lib/location';
import { OSM_COPYRIGHT_URL, tilesAround } from '../lib/osm';
import './maps.css';

const W = 280;
const H = 140;
const ZOOM = 15;

/**
 * A small, non-interactive map of a shared point: the few OpenStreetMap
 * tiles around it with a pin in the middle. Plain images, so it costs a
 * handful of tile requests and no map library.
 */
export function StaticMap({ point, label }: { point: SharedPoint; label: string }) {
  const tiles = tilesAround(point, ZOOM, W, H);
  return (
    <div className="staticmap" role="img" aria-label={`Map of ${label}`}>
      <div className="staticmap-canvas" style={{ width: W, height: H }}>
        {tiles.map((t) => (
          <img
            key={t.url}
            src={t.url}
            alt=""
            width={256}
            height={256}
            loading="lazy"
            decoding="async"
            referrerPolicy="strict-origin-when-cross-origin"
            className="staticmap-tile"
            style={{ left: t.left, top: t.top }}
          />
        ))}
        <span className="map-pin" aria-hidden="true" />
      </div>
      <a className="staticmap-credit" href={OSM_COPYRIGHT_URL} target="_blank" rel="noopener noreferrer">
        © OpenStreetMap
      </a>
    </div>
  );
}
