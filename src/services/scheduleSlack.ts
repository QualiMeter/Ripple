import type { Dependency } from '../types/dependency'
import type { CurrentProjectIssues } from '../types/impact'
import type { ProjectTask } from '../types/task'

const dayMs = 86_400_000

export interface ScheduleSlackRow {
  task: ProjectTask
  slackDays: number
  isCritical: boolean
  hasConflict: boolean
  limitingPredecessor?: ProjectTask
  earliestAllowedStart?: string
  dependencyBufferDays?: number
}

function addCalendarDay(value: string): string {
  return new Date(Date.parse(value) + dayMs).toISOString().slice(0, 10)
}

function daysBetween(start: string, end: string): number {
  return Math.round((Date.parse(end) - Date.parse(start)) / dayMs)
}

export function buildScheduleSlackRows(
  tasks: ProjectTask[],
  dependencies: Dependency[],
  slackDaysByTaskId: Record<string, number>,
  currentIssues: CurrentProjectIssues,
): ScheduleSlackRow[] {
  const taskById = new Map(tasks.map((task) => [task.id, task]))
  const conflictTaskIds = new Set(currentIssues.scheduleConflicts.flatMap((issue) => [
    issue.sourceTaskId,
    ...issue.affectedTaskIds,
  ]))

  return tasks.map((task) => {
    const limitingPredecessor = dependencies
      .filter((dependency) => dependency.type === 'finish-to-start' && dependency.successorTaskId === task.id)
      .map((dependency) => taskById.get(dependency.predecessorTaskId))
      .filter((predecessor): predecessor is ProjectTask => Boolean(predecessor))
      .sort((left, right) => right.endDate.localeCompare(left.endDate))[0]
    const earliestAllowedStart = limitingPredecessor ? addCalendarDay(limitingPredecessor.endDate) : undefined
    const slackDays = slackDaysByTaskId[task.id] ?? 0

    return {
      task,
      slackDays,
      isCritical: slackDays <= 0,
      hasConflict: conflictTaskIds.has(task.id),
      limitingPredecessor,
      earliestAllowedStart,
      dependencyBufferDays: earliestAllowedStart ? daysBetween(earliestAllowedStart, task.startDate) : undefined,
    }
  })
}
