import { afterEach, describe, expect, it, vi } from 'vitest'
import { historyApi, isHistoryRealtimeEntity } from './history.api'

const dto = { id: 'abc', operationType: 'task-updated', description: 'Изменена задача', createdAt: '2026-09-27T10:00:00Z', canUndo: true }

describe('HistoryApi', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('recognizes only server history realtime entities', () => {
    expect(isHistoryRealtimeEntity('history')).toBe(true)
    expect(isHistoryRealtimeEntity('change_history')).toBe(true)
    expect(isHistoryRealtimeEntity('task')).toBe(false)
    expect(isHistoryRealtimeEntity('project')).toBe(false)
  })

  it('loads project history and undoes the selected history id', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([dto]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...dto, canUndo: false }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    expect((await historyApi.listHistory('project'))[0].id).toBe('abc')
    await historyApi.undoHistoryEntry('project', 'abc')
    const urls = fetchMock.mock.calls.map(([input]) => String(input))
    expect(urls[1]).toMatch(/\/api\/v1\/projects\/project\/history\/abc\/undo$/)
    expect(urls.some((url) => /\/history\/undo$/.test(url))).toBe(false)
  })
})
