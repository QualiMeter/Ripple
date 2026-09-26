const baseUrl = (import.meta.env.VITE_API_URL ?? 'https://mvp-action.up.railway.app').replace(/\/+$/, '')

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const normalizedPath = `/${path.replace(/^\/+/, '')}`
  const response = await fetch(`${baseUrl}${normalizedPath}`, {
    ...init,
    headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
  })
  if (!response.ok) {
    let message = `API request failed: ${response.status}`
    const responseBody = await response.text().catch(() => '')
    if (responseBody.trim()) {
      try {
        const body = JSON.parse(responseBody) as { detail?: string; title?: string; message?: string; errors?: Record<string, string[]> }
        message = body.detail ?? body.message ?? body.title ?? Object.values(body.errors ?? {}).flat()[0] ?? message
      } catch {
        message = responseBody.trim()
      }
    }
    throw new ApiError(response.status, message)
  }
  if (response.status === 204) return undefined as T
  const text = await response.text()
  return (text ? JSON.parse(text) : undefined) as T
}
