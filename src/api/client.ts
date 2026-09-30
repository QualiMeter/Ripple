import { apiUrl } from '../config/api'

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const normalizedPath = `/${path.replace(/^\/+/, '')}`
  const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData
  const response = await fetch(apiUrl(normalizedPath), {
    ...init,
    headers: { ...(init?.body && !isFormData ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
  })
  if (!response.ok) {
    let message = `API request failed: ${response.status}`
    const responseBody = await response.text().catch(() => '')
    if (responseBody.trim()) {
      try {
        const body = JSON.parse(responseBody) as {
          detail?: string; Detail?: string; title?: string; Title?: string; message?: string; Message?: string
          errors?: Record<string, string[]>; Errors?: Record<string, string[]>
        }
        message = body.detail ?? body.Detail ?? body.message ?? body.Message ?? body.title ?? body.Title
          ?? Object.values(body.errors ?? body.Errors ?? {}).flat()[0] ?? message
      } catch {
        message = responseBody.trim()
      }
    }
    throw new ApiError(response.status, message)
  }
  return response
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(path, init)
  if (response.status === 204) return undefined as T
  const text = await response.text()
  return (text ? JSON.parse(text) : undefined) as T
}
