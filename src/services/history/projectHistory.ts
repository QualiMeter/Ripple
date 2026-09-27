import { createLocalHistoryStorage, type ProjectHistoryStorage } from './historyStorage'
import type { NewProjectHistoryEntry, ProjectHistoryEntry, ProjectHistoryKind } from './historyTypes'

const maxEntries = 100
const unavailableKinds = new Set<ProjectHistoryKind>(['task-created', 'task-deleted', 'employee-deleted', 'change-reverted'])

function createId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `history-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export class ProjectHistory {
  constructor(private readonly storage: ProjectHistoryStorage) {}

  list(projectId: string): ProjectHistoryEntry[] {
    return this.storage.read(projectId).sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  }

  record(input: NewProjectHistoryEntry): ProjectHistoryEntry {
    const entry: ProjectHistoryEntry = {
      ...input,
      id: input.id ?? createId(),
      createdAt: input.createdAt ?? new Date().toISOString(),
      revertStatus: input.revertStatus ?? (unavailableKinds.has(input.kind) ? 'unavailable' : 'available'),
    }
    this.storage.write(input.projectId, [entry, ...this.list(input.projectId)].slice(0, maxEntries))
    return entry
  }

  markReverted(projectId: string, entryId: string, revertEventId: string): void {
    const entries = this.list(projectId).map((entry) => entry.id === entryId
      ? { ...entry, revertStatus: 'reverted' as const, revertEventId }
      : entry)
    this.storage.write(projectId, entries)
  }
}

export const projectHistory = new ProjectHistory(createLocalHistoryStorage())

export async function recordAfterSuccessfulMutation<T>(
  mutation: () => Promise<T>,
  record: (result: T) => void,
): Promise<T> {
  const result = await mutation()
  record(result)
  return result
}
