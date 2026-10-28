/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    // Flag SVGs (src/lib/flags.ts) stay separate files so a page only fetches
    // the flags it shows; everything else keeps Vite's default 4 KB inlining.
    assetsInlineLimit: (file) => (file.includes('/flag-icons/') ? false : undefined),
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
