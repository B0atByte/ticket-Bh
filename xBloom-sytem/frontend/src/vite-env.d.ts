/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Injected by vite.config define — unique per build/dev-server start.
declare const __BUILD_ID__: string;
