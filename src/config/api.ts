export const apiMode = import.meta.env.VITE_API_MODE ?? 'mock'

export const apiBaseUrl = (import.meta.env.VITE_API_URL ?? 'https://mvp-action.up.railway.app')
  .replace(/\/+$/, '')

export function apiUrl(path: string): string {
  return `${apiBaseUrl}/${path.replace(/^\/+/, '')}`
}

export const isHttpApiMode = apiMode === 'http'
