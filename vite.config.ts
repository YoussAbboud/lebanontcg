/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// One id per build, baked into the bundle and published as /version.json,
// so a tab left open across a deploy can tell it's running old code
// (src/lib/freshness.ts) and reload onto the new one.
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env;
const BUILD_ID = env?.VERCEL_GIT_COMMIT_SHA || String(Date.now());

function versionFile(): Plugin {
  return {
    name: 'version-file',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ build: BUILD_ID }),
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), versionFile()],
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
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
