import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiRequest } from './client'

describe('apiRequest', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('normalizes paths and accepts an empty successful response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(apiRequest<void>('/api/v1/example')).resolves.toBeUndefined()
    expect(fetchMock.mock.calls[0][0]).not.toContain('//api/v1')
  })

  it('surfaces a ProblemDetails message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: 'Цикл запрещён' }), { status: 400, headers: { 'Content-Type': 'application/json' } })))
    await expect(apiRequest('/api/v1/example')).rejects.toMatchObject({ status: 400, message: 'Цикл запрещён', name: 'ApiError' } satisfies Partial<ApiError>)
  })
})
