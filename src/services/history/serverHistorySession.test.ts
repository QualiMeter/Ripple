import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'
import type { HistoryApi } from '../../api/history.api'
import { ProjectHistory } from './projectHistory'
import { createLocalHistoryStorage } from './historyStorage'
import { HistoryUndoAlreadyAppliedError, undoServerHistoryEntry } from './serverHistoryActions'
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

  it('refreshes once on a new project visit and shares a burst of refresh requests', async () => {
    let resolve!: (entries: typeof serverEntry[]) => void
    const listHistory = vi.fn()
      .mockImplementationOnce(() => new Promise((done) => { resolve = done }))
      .mockResolvedValue([serverEntry])
    const service = api({ listHistory })
    const session = new ServerHistorySession()
    const first = session.refresh('project', service)
    const burst = session.refresh('project', service)
    expect(service.listHistory).toHaveBeenCalledTimes(1)
    resolve([serverEntry])
    await expect(Promise.all([first, burst])).resolves.toEqual([[serverEntry], [serverEntry]])

    await session.refresh('project', service)
    expect(service.listHistory).toHaveBeenCalledTimes(2)
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

  it('refreshes history after 404 and exposes a clear error', async () => {
    const service = api({ undoHistoryEntry: vi.fn().mockRejectedValue(new ApiError(404, 'backend error')) })
    const session = new ServerHistorySession()
    await expect(undoServerHistoryEntry('project', 'abc', service, session)).rejects.toThrow('Изменение не найдено. История проекта могла обновиться.')
    expect(service.listHistory).toHaveBeenCalledTimes(1)
  })

  it('treats 409 as synchronized only when refreshed history is unavailable', async () => {
    const service = api({
      undoHistoryEntry: vi.fn().mockRejectedValue(new ApiError(409, 'already undone')),
      listHistory: vi.fn().mockResolvedValue([{ ...serverEntry, canUndo: false }]),
    })
    const session = new ServerHistorySession()
    await expect(undoServerHistoryEntry('project', 'abc', service, session)).rejects.toBeInstanceOf(HistoryUndoAlreadyAppliedError)
    expect(service.listHistory).toHaveBeenCalledTimes(1)
    expect(session.get('project')?.[0].canUndo).toBe(false)
  })

  it('does not mask a backend 409 when refreshed history is still undoable', async () => {
    const service = api({ undoHistoryEntry: vi.fn().mockRejectedValue(new ApiError(409, 'already undone')) })
    const session = new ServerHistorySession()
    await expect(undoServerHistoryEntry('project', 'abc', service, session)).rejects.toThrow('Backend вернул 409')
    expect(session.get('project')?.[0].canUndo).toBe(true)
  })

  it('does not send undo when the current session already marks the entry unavailable', async () => {
    const service = api()
    const session = new ServerHistorySession()
    await session.load('project', service)
    session.markUndone('project', 'abc')
    await expect(undoServerHistoryEntry('project', 'abc', service, session)).rejects.toBeInstanceOf(HistoryUndoAlreadyAppliedError)
    expect(service.undoHistoryEntry).not.toHaveBeenCalled()
  })

  it('marks a history entry as undone without blocking other updates', async () => {
    const session = new ServerHistorySession()
    await session.load('project', api())
    expect(session.markUndone('project', 'abc')[0]).toMatchObject({ canUndo: false, undone: true })
    expect(session.upsert('project', { ...serverEntry, id: 'next' })).toHaveLength(2)
  })
})
