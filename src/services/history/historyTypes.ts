export type ProjectHistoryKind =
  | 'project-updated'
  | 'task-created'
  | 'task-updated'
  | 'task-deleted'
  | 'dependency-created'
  | 'dependency-deleted'
  | 'employee-created'
  | 'employee-updated'
  | 'employee-deleted'
  | 'schedule-shift-applied'
  | 'change-reverted'

export type HistoryEntityType = 'project' | 'task' | 'dependency' | 'employee' | 'schedule'
export type HistoryRevertStatus = 'available' | 'unavailable' | 'reverted'
export type HistorySnapshot = Record<string, unknown>

export interface ProjectHistoryEntry {
  id: string
  projectId: string
  createdAt: string
  kind: ProjectHistoryKind
  title: string
  description: string
  entityType: HistoryEntityType
  entityId?: string
  before?: HistorySnapshot
  after?: HistorySnapshot
  revertStatus: HistoryRevertStatus
  revertEventId?: string
  revertsEntryId?: string
}

export interface ServerHistoryEntry {
  source: 'server'
  id: string
  projectId: string
  operationType: string
  description: string
  createdAt: string
  canUndo: boolean
  undone?: boolean
}

export type HistoryEntry = ProjectHistoryEntry | ServerHistoryEntry

export function isServerHistoryEntry(entry: HistoryEntry): entry is ServerHistoryEntry {
  return 'source' in entry && entry.source === 'server'
}

export type NewProjectHistoryEntry = Omit<ProjectHistoryEntry, 'id' | 'createdAt' | 'revertStatus'> & {
  id?: string
  createdAt?: string
  revertStatus?: HistoryRevertStatus
}
