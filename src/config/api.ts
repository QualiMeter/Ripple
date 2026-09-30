export const apiMode = import.meta.env.VITE_API_MODE ?? 'mock'

export const apiBaseUrl = (import.meta.env.VITE_API_URL ?? 'https://92.63.102.15/api')
  .replace(/\/+$/, '')

export function apiUrl(path: string): string {
  return `${apiBaseUrl}/${path.replace(/^\/+/, '')}`
}

export const realtimeBaseUrl = apiBaseUrl.replace(/\/api$/i, '')

export function realtimeUrl(path: string): string {
  return `${realtimeBaseUrl}/${path.replace(/^\/+/, '')}`
}

export const isHttpApiMode = apiMode === 'http'
