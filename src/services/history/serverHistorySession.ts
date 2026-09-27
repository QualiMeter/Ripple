import type { HistoryApi } from '../../api/history.api'
import type { ServerHistoryEntry } from './historyTypes'

export class ServerHistorySession {
  private readonly entriesByProject = new Map<string, ServerHistoryEntry[]>()
  private readonly loadingByProject = new Map<string, Promise<ServerHistoryEntry[]>>()
  private readonly undoneIds = new Set<string>()

  private normalize(entries: ServerHistoryEntry[]): ServerHistoryEntry[] {
    return [...entries]
      .map((entry) => this.undoneIds.has(entry.id) ? { ...entry, canUndo: false, undone: true } : entry)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  }

  get(projectId: string): ServerHistoryEntry[] | undefined {
    return this.entriesByProject.get(projectId)
  }

  load(projectId: string, api: HistoryApi): Promise<ServerHistoryEntry[]> {
    const cached = this.get(projectId)
    if (cached) return Promise.resolve(cached)
    const pending = this.loadingByProject.get(projectId)
    if (pending) return pending
    const request = api.listHistory(projectId)
      .then((entries) => {
        const normalized = this.normalize(entries)
        this.entriesByProject.set(projectId, normalized)
        return normalized
      })
      .finally(() => this.loadingByProject.delete(projectId))
    this.loadingByProject.set(projectId, request)
    return request
  }

  async refresh(projectId: string, api: HistoryApi): Promise<ServerHistoryEntry[]> {
    const pending = this.loadingByProject.get(projectId)
    if (pending) return pending
    const request = api.listHistory(projectId)
      .then((entries) => {
        const normalized = this.normalize(entries)
        this.entriesByProject.set(projectId, normalized)
        return normalized
      })
      .finally(() => this.loadingByProject.delete(projectId))
    this.loadingByProject.set(projectId, request)
    return request
  }

  upsert(projectId: string, entry: ServerHistoryEntry): ServerHistoryEntry[] {
    const current = this.get(projectId) ?? []
    const next = this.normalize(current.some((candidate) => candidate.id === entry.id)
      ? current.map((candidate) => candidate.id === entry.id ? entry : candidate)
      : [...current, entry])
    this.entriesByProject.set(projectId, next)
    return next
  }

  markUndone(projectId: string, historyId: string): ServerHistoryEntry[] {
    this.undoneIds.add(historyId)
    const next = this.normalize(this.get(projectId) ?? [])
    this.entriesByProject.set(projectId, next)
    return next
  }

  clear(): void {
    this.entriesByProject.clear()
    this.loadingByProject.clear()
    this.undoneIds.clear()
  }
}

export const serverHistorySession = new ServerHistorySession()
