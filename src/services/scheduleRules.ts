import type { Dependency } from '../types/dependency'
import type { ScheduleShiftPreview } from '../types/schedule'
import type { ProjectTask } from '../types/task'
import { addCalendarDays } from '../utils/date'
import { findDownstreamTaskIds } from './dependencyGraph'

export function getEarliestSuccessorStart(predecessorEndDates: string[]): string | null {
  if (predecessorEndDates.length === 0) return null
  const latestPredecessorEnd = predecessorEndDates.reduce((latest, date) => date > latest ? date : latest)
  return addCalendarDays(latestPredecessorEnd, 1)
}

export function getTaskEarliestStart(
  taskId: string,
  tasksById: Map<string, ProjectTask>,
  dependencies: Dependency[],
): string | null {
  const predecessorEndDates = dependencies
    .filter((dependency) => dependency.successorTaskId === taskId)
    .map((dependency) => tasksById.get(dependency.predecessorTaskId)?.endDate)
    .filter((endDate): endDate is string => Boolean(endDate))
  return getEarliestSuccessorStart(predecessorEndDates)
}

export interface DependencyDateConflict {
  dependency: Dependency
  predecessor: ProjectTask
  successor: ProjectTask
  requiredStartDate: string
}

export function findDependencyDateConflicts(
  tasks: ProjectTask[],
  dependencies: Dependency[],
): DependencyDateConflict[] {
  const tasksById = new Map(tasks.map((task) => [task.id, task]))
  return dependencies.flatMap((dependency): DependencyDateConflict[] => {
    const predecessor = tasksById.get(dependency.predecessorTaskId)
    const successor = tasksById.get(dependency.successorTaskId)
    if (!predecessor || !successor) return []
    const requiredStartDate = getEarliestSuccessorStart([predecessor.endDate])!
    if (successor.startDate >= requiredStartDate) return []
    return [{ dependency, predecessor, successor, requiredStartDate }]
  })
}

export interface InvalidPreviewDependency {
  predecessorTaskId: string
  successorTaskId: string
  predecessorEndDate: string
  proposedSuccessorStartDate: string
  requiredStartDate: string
}

export function findInvalidPreviewDependencies(
  tasks: ProjectTask[],
  dependencies: Dependency[],
  preview: ScheduleShiftPreview,
): InvalidPreviewDependency[] {
  const proposedTasks = new Map(tasks.map((task) => [task.id, { ...task }]))
  for (const shift of preview.taskShifts) {
    const task = proposedTasks.get(shift.taskId)
    if (task) proposedTasks.set(task.id, { ...task, startDate: shift.proposedStartDate, endDate: shift.proposedEndDate })
  }
  const downstreamTaskIds = new Set(findDownstreamTaskIds(preview.sourceTaskId, dependencies))
  return dependencies.flatMap((dependency): InvalidPreviewDependency[] => {
    const predecessor = proposedTasks.get(dependency.predecessorTaskId)
    const successor = proposedTasks.get(dependency.successorTaskId)
    if (!predecessor || !successor || successor.status === 'completed' || !downstreamTaskIds.has(successor.id)) return []
    const requiredStartDate = getEarliestSuccessorStart([predecessor.endDate])!
    if (successor.startDate >= requiredStartDate) return []
    return [{
      predecessorTaskId: predecessor.id,
      successorTaskId: successor.id,
      predecessorEndDate: predecessor.endDate,
      proposedSuccessorStartDate: successor.startDate,
      requiredStartDate,
    }]
  })
}

export function assertValidScheduleShiftPreview(
  tasks: ProjectTask[],
  dependencies: Dependency[],
  preview: ScheduleShiftPreview,
): void {
  if (findInvalidPreviewDependencies(tasks, dependencies, preview).length > 0) {
    throw new Error('Полученный план сдвига всё ещё нарушает зависимости. Повторите расчёт после обновления данных.')
  }
}
