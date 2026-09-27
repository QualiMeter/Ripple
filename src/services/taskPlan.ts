import type { Dependency } from '../types/dependency'
import type { CurrentProjectIssues } from '../types/impact'
import type { ProjectTask } from '../types/task'
import { analyzeTaskOverdue, type TaskOverdueInfo } from './deadlineAnalysis'
import { describeScheduleConflict } from './scheduleConflictPresentation'
import { getTaskEarliestStart } from './scheduleRules'
import { selectTasksRequiringAttention } from './taskAttention'

export type TaskPlanFilter = 'attention' | 'all' | 'critical' | 'buffer' | 'conflicts' | 'overdue'

export interface TaskPlanRow {
  task: ProjectTask
  slackDays: number
  critical: boolean
  hasScheduleConflict: boolean
  overdue: TaskOverdueInfo | null
  predecessors: ProjectTask[]
  earliestAllowedStart: string | null
}

export function buildTaskPlanRows({ tasks, dependencies, criticalTaskIds, slackDaysByTaskId, currentIssues, today }: {
  tasks: ProjectTask[]
  dependencies: Dependency[]
  criticalTaskIds: string[]
  slackDaysByTaskId: Record<string, number>
  currentIssues: CurrentProjectIssues
  today: string
}): TaskPlanRow[] {
  const tasksById = new Map(tasks.map((task) => [task.id, task]))
  const criticalIds = new Set(criticalTaskIds)
  const conflictSuccessorIds = new Set(currentIssues.scheduleConflicts.flatMap((reason) => {
    const conflict = describeScheduleConflict(reason, tasks, dependencies)
    return conflict ? [conflict.successor.id] : []
  }))

  return tasks.map((task) => {
    const predecessors = dependencies
      .filter((dependency) => dependency.successorTaskId === task.id)
      .map((dependency) => tasksById.get(dependency.predecessorTaskId))
      .filter((predecessor): predecessor is ProjectTask => Boolean(predecessor))
      .sort((left, right) => right.endDate.localeCompare(left.endDate))
    const slackDays = slackDaysByTaskId[task.id] ?? 0
    return {
      task,
      slackDays,
      critical: criticalIds.has(task.id) || slackDays <= 0,
      hasScheduleConflict: conflictSuccessorIds.has(task.id),
      overdue: analyzeTaskOverdue(task, dependencies, today),
      predecessors,
      earliestAllowedStart: getTaskEarliestStart(task.id, tasksById, dependencies),
    }
  })
}

export function filterTaskPlanRows(rows: TaskPlanRow[], filter: TaskPlanFilter, tasks: ProjectTask[], affectedTaskIds: string[], criticalTaskIds: string[], currentIssues: CurrentProjectIssues): TaskPlanRow[] {
  if (filter === 'all') return rows
  if (filter === 'critical') return rows.filter((row) => row.critical)
  if (filter === 'buffer') return rows.filter((row) => row.slackDays > 0)
  if (filter === 'conflicts') return rows.filter((row) => row.hasScheduleConflict)
  if (filter === 'overdue') return rows.filter((row) => row.overdue !== null)
  const rowsByTaskId = new Map(rows.map((row) => [row.task.id, row]))
  return selectTasksRequiringAttention(tasks, affectedTaskIds, criticalTaskIds, currentIssues)
    .map((task) => rowsByTaskId.get(task.id))
    .filter((row): row is TaskPlanRow => Boolean(row))
}

export function countTaskPlanFilters(rows: TaskPlanRow[], tasks: ProjectTask[], affectedTaskIds: string[], criticalTaskIds: string[], currentIssues: CurrentProjectIssues): Record<TaskPlanFilter, number> {
  return {
    attention: filterTaskPlanRows(rows, 'attention', tasks, affectedTaskIds, criticalTaskIds, currentIssues).length,
    all: rows.length,
    critical: rows.filter((row) => row.critical).length,
    buffer: rows.filter((row) => row.slackDays > 0).length,
    conflicts: rows.filter((row) => row.hasScheduleConflict).length,
    overdue: rows.filter((row) => row.overdue !== null).length,
  }
}
