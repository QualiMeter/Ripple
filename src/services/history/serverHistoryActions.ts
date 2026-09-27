import { ApiError } from '../../api/client'
import type { HistoryApi } from '../../api/history.api'
import type { ServerHistoryEntry } from './historyTypes'
import type { ServerHistorySession } from './serverHistorySession'

export async function undoServerHistoryEntry(
  projectId: string,
  historyId: string,
  api: HistoryApi,
  session: ServerHistorySession,
): Promise<ServerHistoryEntry[]> {
  try {
    const response = await api.undoHistoryEntry(projectId, historyId)
    session.markUndone(projectId, historyId)
    session.upsert(projectId, { ...response, canUndo: false, undone: true })
    return await session.refresh(projectId, api)
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 409)) {
      if (error.status === 409) session.markUndone(projectId, historyId)
      await session.refresh(projectId, api).catch(() => undefined)
      if (error.status === 404) throw new Error('Изменение не найдено. История проекта могла обновиться.')
      throw new Error('Это изменение уже было отменено.')
    }
    throw error
  }
}
