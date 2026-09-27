import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'
import type { HistoryApi } from '../../api/history.api'
import { ProjectHistory } from './projectHistory'
import { createLocalHistoryStorage } from './historyStorage'
import { undoServerHistoryEntry } from './serverHistoryActions'
import { ServerHistorySession } from './serverHistorySession'

const serverEntry = { source: 'server' as const, id: 'abc', projectId: 'project', operationType: 'task-updated', description: 'Изменена задача', createdAt: '2026-09-27T10:00:00Z', canUndo: true }

function api(overrides: Partial<HistoryApi> = {}): HistoryApi {
  return {
    listHistory: vi.fn().mockResolvedValue([serverEntry]),
    undoHistoryEntry: vi.fn().mockResolvedValue({ ...serverEntry, canUndo: false }),
    ...overrides,
  }
}

describe('ServerHistorySession', () => {
  it('does not load before requested and loads only once across repeated tab opens', async () => {
    const service = api()
    const session = new ServerHistorySession()
    expect(service.listHistory).not.toHaveBeenCalled()
    await session.load('project', service)
    await session.load('project', service)
    expect(service.listHistory).toHaveBeenCalledTimes(1)
  })

  it('keeps server history separate from browser-local history', async () => {
    const storage = new Map<string, string>()
    const local = new ProjectHistory(createLocalHistoryStorage({ getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => { storage.set(key, value) } }))
    local.record({ projectId: 'project', kind: 'task-created', title: 'Локальная', description: 'Локальная запись', entityType: 'task' })
    const session = new ServerHistorySession()
    const entries = await session.load('project', api())
    expect(entries.map((entry) => entry.id)).toEqual(['abc'])
    expect(local.list('project')).toHaveLength(1)
  })

  it.each([
    [404, 'Изменение не найдено. История проекта могла обновиться.'],
    [409, 'Это изменение уже было отменено.'],
  ])('refreshes history and exposes the %i undo error', async (status, message) => {
    const service = api({ undoHistoryEntry: vi.fn().mockRejectedValue(new ApiError(status, 'backend error')) })
    const session = new ServerHistorySession()
    await expect(undoServerHistoryEntry('project', 'abc', service, session)).rejects.toThrow(message)
    expect(service.listHistory).toHaveBeenCalledTimes(1)
    if (status === 409) expect(session.get('project')?.[0]).toMatchObject({ canUndo: false, undone: true })
  })

  it('marks a history entry as undone without blocking other updates', async () => {
    const session = new ServerHistorySession()
    await session.load('project', api())
    expect(session.markUndone('project', 'abc')[0]).toMatchObject({ canUndo: false, undone: true })
    expect(session.upsert('project', { ...serverEntry, id: 'next' })).toHaveLength(2)
  })
})
