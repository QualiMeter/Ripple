import { ApiError } from '../../api/client'
import type { HistoryApi } from '../../api/history.api'
import type { ProjectWorkspace } from '../../types/workspace'
import type { ServerHistoryEntry } from './historyTypes'
import type { ServerHistorySession } from './serverHistorySession'

export class HistoryUndoAlreadyAppliedError extends Error {
  constructor() {
    super('Изменение уже отменено.')
    this.name = 'HistoryUndoAlreadyAppliedError'
  }
}

function isUnavailable(entry: ServerHistoryEntry | undefined): boolean {
  return Boolean(entry && (!entry.canUndo || !entry.isCurrent || entry.undone))
}

export async function undoServerHistoryEntry(
  projectId: string,
  historyId: string,
  api: HistoryApi,
  session: ServerHistorySession,
): Promise<ServerHistoryEntry[]> {
  const current = session.get(projectId)?.find((entry) => entry.id === historyId)
  if (isUnavailable(current)) throw new HistoryUndoAlreadyAppliedError()
  try {
    const response = await api.undoHistoryEntry(projectId, historyId)
    session.markUndone(projectId, historyId)
    return session.upsert(projectId, { ...response, canUndo: false, isCurrent: false, undone: true })
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 409)) {
      const refreshed = await session.refresh(projectId, api).catch(() => session.get(projectId) ?? [])
      if (error.status === 404) throw new Error('Изменение не найдено. История проекта могла обновиться.')
      if (isUnavailable(refreshed.find((entry) => entry.id === historyId))) throw new HistoryUndoAlreadyAppliedError()
      throw new Error('Backend вернул 409, но изменение по-прежнему доступно для отката. Проверьте состояние проекта перед повторной попыткой.')
    }
    throw error
  }
}

export interface ServerHistoryUndoSynchronization {
  entries: ServerHistoryEntry[]
  workspace: ProjectWorkspace | null
}

export async function undoServerHistoryAndSynchronize(
  projectId: string,
  historyId: string,
  api: HistoryApi,
  session: ServerHistorySession,
  loadWorkspace: (projectId: string) => Promise<ProjectWorkspace>,
): Promise<ServerHistoryUndoSynchronization> {
  const entriesAfterUndo = await undoServerHistoryEntry(projectId, historyId, api, session)
  const workspace = await loadWorkspace(projectId).catch(() => null)
  const entries = await session.refresh(projectId, api).catch(() => entriesAfterUndo)
  return { entries, workspace }
}
