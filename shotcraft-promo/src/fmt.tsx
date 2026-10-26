// Output format. One timeline renders both cuts: landscape 1920×1080 and vertical 1080×1920. Shots read the frame size
// from here instead of assuming 1920×1080; timing, beats and the SFX table are shared, so the cuts stay frame-identical in time.
import React, { createContext, useContext } from 'react';

export type Fmt = { W: number; H: number; v: boolean };
export const LANDSCAPE: Fmt = { W: 1920, H: 1080, v: false };
export const VERTICAL: Fmt = { W: 1080, H: 1920, v: true };

const FmtContext = createContext<Fmt>(LANDSCAPE);
export const FmtProvider: React.FC<{ vertical?: boolean; children: React.ReactNode }> = ({ vertical, children }) => (
  <FmtContext.Provider value={vertical ? VERTICAL : LANDSCAPE}>{children}</FmtContext.Provider>
);
export const useFmt = () => useContext(FmtContext);
