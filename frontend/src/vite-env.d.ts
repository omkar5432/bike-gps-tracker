/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_MAPTILER_API_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url' {
  const workerUrl: string
  export default workerUrl
}
