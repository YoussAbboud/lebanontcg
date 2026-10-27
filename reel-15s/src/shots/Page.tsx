// Real mobile pages at reel scale: the 390-px-wide page fills the 1080 frame (×2.769). `scroll` is the page y (CSS px)
// at the top of the frame. Layers: a 1× full-page base (only ever seen while speed-blurred) + 3× tiles where the camera
// rests, so every readable frame is a 3× capture.
import React from 'react';
import { Img, staticFile } from 'remotion';
import layout from '../layout.json';
import { W } from '../timing';

export const PAGE_S = W / layout.vw; // 2.769
export const VH = layout.vh; // CSS px visible in one frame (693)
export const toScreenY = (pageY: number, scroll: number) => (pageY - scroll) * PAGE_S;
export type Rect = { x: number; y: number; w: number; h: number };
export const rectOnScreen = (r: Rect, scroll: number): Rect => ({ x: r.x * PAGE_S, y: toScreenY(r.y, scroll), w: r.w * PAGE_S, h: r.h * PAGE_S });

const Tile: React.FC<{ src: string; y: number; h: number; scroll: number }> = ({ src, y, h, scroll }) => (
  <Img src={staticFile(src)} style={{ position: 'absolute', left: 0, top: toScreenY(y, scroll), width: W, height: h * PAGE_S }} />
);

export const BrowsePage: React.FC<{ scroll: number; children?: React.ReactNode }> = ({ scroll, children }) => {
  const { tiles, pageH } = layout.browse;
  const vis = (y: number, h: number) => y + h > scroll - 50 && y < scroll + VH + 50;
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#0b0c10', overflow: 'hidden' }}>
      <Tile src="textures/browse-1x.png" y={0} h={pageH} scroll={scroll} />
      {vis(tiles.top.y, tiles.top.h) && <Tile src="textures/browse-top-3x.png" y={tiles.top.y} h={tiles.top.h} scroll={scroll} />}
      {vis(tiles.target.y, tiles.target.h) && <Tile src="textures/browse-target-3x.png" y={tiles.target.y} h={tiles.target.h} scroll={scroll} />}
      {children}
    </div>
  );
};

export const ListingPage: React.FC<{ scroll: number; hideFace?: boolean }> = ({ scroll, hideFace }) => {
  const { pageH, face } = layout.listing;
  const f = rectOnScreen(face, scroll);
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#0b0c10', overflow: 'hidden' }}>
      <Tile src="textures/listing-3x.png" y={0} h={pageH} scroll={scroll} />
      {/* the photo slot, emptied while the shared-element card art is in flight to it */}
      {hideFace && <div style={{ position: 'absolute', left: f.x, top: f.y, width: f.w, height: f.h, borderRadius: 12 * PAGE_S, background: '#16181d' }} />}
    </div>
  );
};
