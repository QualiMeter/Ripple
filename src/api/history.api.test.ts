import { afterEach, describe, expect, it, vi } from 'vitest'
import { historyApi, isHistoryRealtimeEntity, mapServerHistoryEntries } from './history.api'

const dto = {
  id: 'abc',
  operationType: 'task-updated',
  description: 'Изменена задача',
  createdAt: '2026-09-27T10:00:00Z',
  isCurrent: true,
}

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
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...dto, isCurrent: false }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    expect((await historyApi.listHistory('project'))[0]).toMatchObject({
      id: 'abc',
      canUndo: true,
      isCurrent: true,
      undone: false,
    })

    await historyApi.undoHistoryEntry('project', 'abc')
    const urls = fetchMock.mock.calls.map(([input]) => String(input))
    expect(urls[1]).toMatch(/\/api\/v1\/projects\/project\/history\/abc\/undo$/)
    expect(urls.some((url) => /\/history\/undo$/.test(url))).toBe(false)
  })

  it('treats the latest entry as current when there were no rollbacks', () => {
    const entries = mapServerHistoryEntries('project', [
      { ...dto, id: 'old', createdAt: '2026-09-27T09:00:00Z', isCurrent: false },
      { ...dto, id: 'latest', createdAt: '2026-09-27T11:00:00Z', isCurrent: false },
    ])

    expect(entries[0]).toMatchObject({
      id: 'latest',
      canUndo: true,
      isCurrent: true,
      undone: false,
    })
    expect(entries[1]).toMatchObject({
      id: 'old',
      canUndo: true,
      isCurrent: true,
      undone: false,
    })
  })

  it('uses backend isCurrent as the undo cursor after a rollback', () => {
    const entries = mapServerHistoryEntries('project', [
      { ...dto, id: 'A', createdAt: '2026-09-27T09:00:00Z', isCurrent: false },
      { ...dto, id: 'B', createdAt: '2026-09-27T10:00:00Z', isCurrent: true },
      { ...dto, id: 'C', createdAt: '2026-09-27T11:00:00Z', isCurrent: false },
    ])

    expect(entries).toEqual([
      expect.objectContaining({ id: 'C', canUndo: false, isCurrent: false, undone: true }),
      expect.objectContaining({ id: 'B', canUndo: true, isCurrent: true, undone: false }),
      expect.objectContaining({ id: 'A', canUndo: true, isCurrent: true, undone: false }),
    ])
  })
})
