// LebanonTCG brand pieces (replaces the library's video-shotcraft Brand.tsx in this project).
// Logo = the site's flag-card mark (src/assets/flag.gif, first frame) + "LEBANONTCG" in Chakra Petch 700 + acid dot,
// exactly as the header lockup in src/components/AppShell.tsx. Copy comes only from the product's own text.
import React from 'react';
import { Img, staticFile } from 'remotion';
import { C } from '../theme';
import { FONT } from './Polish';

export const BRAND = {
  name: 'LebanonTCG',
  url: 'www.lebanontcg.com',
  acid: C.acid,
  ink: C.ink,
  font: FONT.display,
} as const;

export const COPY = {
  tagline: 'We connect collectors. You handle the deal.', // footer line
  heroSub: 'List what you own, message the person who has what you want.', // home hero
  noFees: 'No checkout, no fees, you agree the terms yourselves.', // home hero
  antiSnipe: 'A bid in the final minute extends the clock so nobody is sniped.', // Terms
  description: "Lebanon's peer-to-peer card marketplace", // site description (trimmed)
  games: 'Pokémon, Magic, Yu-Gi-Oh! and One Piece.', // site description
  pregrade: 'A centering report, a defect read, an estimated PSA band.', // Pre-Grade lede (trimmed)
} as const;

export const FlagMark: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 96, style }) => (
  <Img src={staticFile('brand/flag.png')} style={{ width: size, height: size, objectFit: 'contain', display: 'block', ...style }} />
);
