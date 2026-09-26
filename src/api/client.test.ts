import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiRequest } from './client'
import { getErrorMessage } from '../utils/error'

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

  it('surfaces the PascalCase backend business-rule message to the UI helper', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ Code: 'business_rule', Message: 'Транзакция backend не выполнена', Errors: null }), { status: 409, headers: { 'Content-Type': 'application/json' } })))
    const error = await apiRequest('/api/v1/example').catch((caught) => caught)
    expect(error).toMatchObject({ status: 409, message: 'Транзакция backend не выполнена' })
    expect(getErrorMessage(error, 'Общая ошибка')).toBe('Транзакция backend не выполнена')
  })
})
