/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_API_MODE?: 'mock' | 'http'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
