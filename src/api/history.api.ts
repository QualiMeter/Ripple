import { apiRequest } from './client'
import type { ChangeHistoryDto } from './backend/types'
import type { ServerHistoryEntry } from '../services/history/historyTypes'

export interface HistoryApi {
  listHistory(projectId: string): Promise<ServerHistoryEntry[]>
  undoHistoryEntry(projectId: string, historyId: string): Promise<ServerHistoryEntry>
}

export function isHistoryRealtimeEntity(entity: string): boolean {
  const normalized = entity.toLowerCase()
  return normalized === 'history' || normalized === 'change_history'
}

function newestFirst<T extends { createdAt: string }>(entries: T[]): T[] {
  return [...entries].sort((left, right) => right.createdAt.localeCompare(left.createdAt))
}

/**
 * Backend больше не присылает canUndo.
 *
 * isCurrent у backend используется как указатель текущей позиции истории после откатов.
 * Для остального frontend история нормализуется в привычное состояние:
 * - записи новее текущей считаются отменёнными;
 * - текущая и более старые записи считаются применёнными;
 * - если откатов ещё не было и backend не отметил current явно,
 *   текущей считается самая свежая запись.
 *
 * canUndo остаётся только внутренним frontend-полем и вычисляется локально.
 * Последовательный откат всё равно разрешает кнопку только для самой свежей
 * применённой записи через getLatestUndoableHistoryEntryId().
 */
export function mapServerHistoryEntries(projectId: string, dtos: ChangeHistoryDto[]): ServerHistoryEntry[] {
  const sorted = newestFirst(dtos)
  if (sorted.length === 0) return []

  const explicitCurrentIndex = sorted.findIndex((entry) => entry.isCurrent)
  const currentIndex = explicitCurrentIndex >= 0 ? explicitCurrentIndex : 0

  return sorted.map((dto, index) => {
    const undone = index < currentIndex
    const applied = !undone
    return {
      source: 'server',
      projectId,
      id: dto.id,
      operationType: dto.operationType,
      description: dto.description,
      createdAt: dto.createdAt,
      canUndo: applied,
      isCurrent: applied,
      undone,
    }
  })
}

export function mapServerHistoryEntry(projectId: string, dto: ChangeHistoryDto): ServerHistoryEntry {
  return {
    source: 'server',
    projectId,
    id: dto.id,
    operationType: dto.operationType,
    description: dto.description,
    createdAt: dto.createdAt,
    canUndo: dto.isCurrent,
    isCurrent: dto.isCurrent,
    undone: !dto.isCurrent,
  }
}

export function serverHistoryEntryFromRealtimeData(projectId: string, data: unknown): ServerHistoryEntry | null {
  if (!data || typeof data !== 'object') return null
  const outer = data as Record<string, unknown>
  const value = outer.history && typeof outer.history === 'object' ? outer.history as Record<string, unknown> : outer
  if (typeof value.id !== 'string' || typeof value.operationType !== 'string' || typeof value.description !== 'string'
    || typeof value.createdAt !== 'string' || typeof value.isCurrent !== 'boolean') return null
  return mapServerHistoryEntry(projectId, value as unknown as ChangeHistoryDto)
}

export const historyApi: HistoryApi = {
  async listHistory(projectId) {
    const entries = await apiRequest<ChangeHistoryDto[]>(`/v1/projects/${projectId}/history`)
    return mapServerHistoryEntries(projectId, entries)
  },
  async undoHistoryEntry(projectId, historyId) {
    const entry = await apiRequest<ChangeHistoryDto>(`/v1/projects/${projectId}/history/${historyId}/undo`, { method: 'POST' })
    return mapServerHistoryEntry(projectId, entry)
  },
}
