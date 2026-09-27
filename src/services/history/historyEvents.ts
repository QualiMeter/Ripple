import type { Dependency } from '../../types/dependency'
import type { Employee } from '../../types/employee'
import type { ProjectSummary } from '../../types/project'
import type { ScheduleShiftPreview } from '../../types/schedule'
import type { ProjectTask } from '../../types/task'
import type { HistorySnapshot, NewProjectHistoryEntry } from './historyTypes'

const taskFields = ['title', 'startDate', 'endDate', 'assigneeId', 'status'] as const
const projectFields = ['name', 'startDate', 'targetEndDate'] as const

function changedSnapshots<T extends object, K extends keyof T>(before: T, after: T, fields: readonly K[]) {
  const beforeSnapshot: HistorySnapshot = {}
  const afterSnapshot: HistorySnapshot = {}
  fields.forEach((field) => {
    if (before[field] !== after[field]) {
      beforeSnapshot[String(field)] = before[field]
      afterSnapshot[String(field)] = after[field]
    }
  })
  return { before: beforeSnapshot, after: afterSnapshot }
}

export function taskSnapshot(task: ProjectTask): HistorySnapshot {
  return Object.fromEntries(taskFields.map((field) => [field, task[field]]))
}

export function taskUpdatedEvent(projectId: string, beforeTask: ProjectTask, afterTask: ProjectTask): NewProjectHistoryEntry {
  return { projectId, kind: 'task-updated', title: 'Изменена задача', description: afterTask.title, entityType: 'task', entityId: afterTask.id, ...changedSnapshots(beforeTask, afterTask, taskFields) }
}

export function projectUpdatedEvent(projectId: string, beforeProject: ProjectSummary, afterProject: ProjectSummary): NewProjectHistoryEntry {
  return { projectId, kind: 'project-updated', title: 'Изменён проект', description: afterProject.name, entityType: 'project', entityId: projectId, ...changedSnapshots(beforeProject, afterProject, projectFields) }
}

export function dependencySnapshot(dependency: Pick<Dependency, 'id' | 'predecessorTaskId' | 'successorTaskId'>): HistorySnapshot {
  return { id: dependency.id, predecessorTaskId: dependency.predecessorTaskId, successorTaskId: dependency.successorTaskId }
}

export function employeeSnapshot(employee: Pick<Employee, 'id' | 'name'>): HistorySnapshot {
  return { id: employee.id, name: employee.name }
}

export function scheduleShiftEvent(projectId: string, preview: ScheduleShiftPreview): NewProjectHistoryEntry {
  return {
    projectId,
    kind: 'schedule-shift-applied',
    title: 'Автоматический сдвиг',
    description: `Изменено задач: ${preview.taskShifts.length}`,
    entityType: 'schedule',
    entityId: preview.sourceTaskId,
    before: {
      tasks: preview.taskShifts.map((shift) => ({ taskId: shift.taskId, startDate: shift.currentStartDate, endDate: shift.currentEndDate })),
      projectEndDate: preview.currentProjectEndDate,
    },
    after: {
      tasks: preview.taskShifts.map((shift) => ({ taskId: shift.taskId, startDate: shift.proposedStartDate, endDate: shift.proposedEndDate })),
      projectEndDate: preview.proposedProjectEndDate,
    },
  }
}
