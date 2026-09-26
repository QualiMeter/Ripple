import type { TaskStatus } from './task'

export type TaskFieldChange =
  | { field: 'title' | 'startDate' | 'endDate'; previousValue: string; nextValue: string }
  | { field: 'status'; previousValue: TaskStatus; nextValue: TaskStatus }
  | { field: 'assigneeId'; previousValue: string; nextValue: string }

export type LastChange =
  | { kind: 'task-updated'; taskId: string; taskTitle: string; changes: TaskFieldChange[] }
  | { kind: 'task-created'; taskId: string; taskTitle: string }
  | { kind: 'task-deleted'; taskId: string; taskTitle: string }
  | { kind: 'dependency-created'; dependencyId: string; predecessorTaskId: string; successorTaskId: string }
  | { kind: 'dependency-deleted'; dependencyId: string; predecessorTaskId: string; successorTaskId: string }
  | { kind: 'schedule-shift-applied'; sourceTaskId: string; shiftedTaskIds: string[] }

export interface ImpactReason {
  sourceTaskId: string
  affectedTaskIds: string[]
  reason: string
  consequence: string
  severity: 'info' | 'warning' | 'error'
  action?:
    | { type: 'open-task'; taskId: string }
    | { type: 'preview-shift' }
}

export interface ImpactAnalysis {
  sourceTaskId: string
  lastChange: LastChange
  affectedTaskIds: string[]
  criticalTaskIds: string[]
  atRiskTaskIds: string[]
  previousProjectEndDate: string
  projectedProjectEndDate: string
  projectEndChangeDays: number
  deadlineShiftDays: number
  requiresIntervention: boolean
  reasons: ImpactReason[]
  analyzedAt: string
}

export interface RecoveryScenario {
  id: string
  title: string
  description: string
  expectedProjectEndDate: string
  recoveredDays: number
  actions: string[]
  confidence: 'high' | 'medium' | 'low'
}
