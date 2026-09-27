import type { ProjectHistoryEntry } from './historyTypes'

export interface ProjectHistoryStorage {
  read(projectId: string): ProjectHistoryEntry[]
  write(projectId: string, entries: ProjectHistoryEntry[]): void
}

export const historyStorageKey = (projectId: string) => `ripple:project-history:v1:${projectId}`

export function createLocalHistoryStorage(storage?: Pick<Storage, 'getItem' | 'setItem'>): ProjectHistoryStorage {
  const resolveStorage = () => storage ?? (typeof window === 'undefined' ? undefined : window.localStorage)
  return {
    read(projectId) {
      try {
        const value = resolveStorage()?.getItem(historyStorageKey(projectId))
        if (!value) return []
        const parsed: unknown = JSON.parse(value)
        return Array.isArray(parsed) ? parsed as ProjectHistoryEntry[] : []
      } catch {
        return []
      }
    },
    write(projectId, entries) {
      try {
        resolveStorage()?.setItem(historyStorageKey(projectId), JSON.stringify(entries))
      } catch {
        // History is a best-effort browser feature and must not break a mutation.
      }
    },
  }
}
