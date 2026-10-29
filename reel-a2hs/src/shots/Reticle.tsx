// An unclipped layer in the screen's coordinate space (same place, same camera transform, no overflow clipping), so
// the reticle's fly-in starts outside the 1080×1920 frame instead of being cut by the window's rounded edge.
import React from 'react';
import { SCREEN } from '../Screen';

export const ReticleLayer: React.FC<{ camera: React.CSSProperties; children?: React.ReactNode }> = ({ camera, children }) => (
  <div style={{ position: 'absolute', left: SCREEN.x, top: SCREEN.y, width: SCREEN.w, height: SCREEN.h, pointerEvents: 'none' }}>
    <div style={camera}>{children}</div>
  </div>
);
