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

export function mapServerHistoryEntry(projectId: string, dto: ChangeHistoryDto): ServerHistoryEntry {
  return {
    source: 'server', projectId, id: dto.id, operationType: dto.operationType,
    description: dto.description, createdAt: dto.createdAt, canUndo: dto.canUndo,
  }
}

export function serverHistoryEntryFromRealtimeData(projectId: string, data: unknown): ServerHistoryEntry | null {
  if (!data || typeof data !== 'object') return null
  const outer = data as Record<string, unknown>
  const value = outer.history && typeof outer.history === 'object' ? outer.history as Record<string, unknown> : outer
  if (typeof value.id !== 'string' || typeof value.operationType !== 'string' || typeof value.description !== 'string'
    || typeof value.createdAt !== 'string' || typeof value.canUndo !== 'boolean') return null
  return mapServerHistoryEntry(projectId, value as unknown as ChangeHistoryDto)
}

export const historyApi: HistoryApi = {
  async listHistory(projectId) {
    const entries = await apiRequest<ChangeHistoryDto[]>(`/api/v1/projects/${projectId}/history`)
    return entries.map((entry) => mapServerHistoryEntry(projectId, entry))
  },
  async undoHistoryEntry(projectId, historyId) {
    const entry = await apiRequest<ChangeHistoryDto>(`/api/v1/projects/${projectId}/history/${historyId}/undo`, { method: 'POST' })
    return mapServerHistoryEntry(projectId, entry)
  },
}
