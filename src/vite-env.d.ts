/// <reference types="vite/client" />

/** Set per build in vite.config.ts; matches /version.json. */
declare const __BUILD_ID__: string;

interface ImportMetaEnv {
  readonly VITE_MOCK?: string;
  readonly VITE_MOCK_STRESS?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
