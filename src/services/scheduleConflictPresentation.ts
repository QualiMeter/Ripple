import type { Dependency } from '../types/dependency'
import type { CurrentProjectIssues, ImpactReason } from '../types/impact'
import type { ProjectTask } from '../types/task'
import { getEarliestSuccessorStart } from './scheduleRules'

export interface ScheduleConflictPresentation {
  predecessor: ProjectTask
  successor: ProjectTask
  earliestStartDate: string
  completedSuccessor: boolean
}

export function describeScheduleConflict(
  reason: ImpactReason,
  tasks: ProjectTask[],
  dependencies: Dependency[],
): ScheduleConflictPresentation | null {
  const affectedTaskIds = new Set(reason.affectedTaskIds)
  const dependency = dependencies.find((candidate) => (
    candidate.predecessorTaskId === reason.sourceTaskId
    && affectedTaskIds.has(candidate.successorTaskId)
  ))
  if (!dependency) return null
  const predecessor = tasks.find((task) => task.id === dependency.predecessorTaskId)
  const successor = tasks.find((task) => task.id === dependency.successorTaskId)
  if (!predecessor || !successor) return null
  return {
    predecessor,
    successor,
    earliestStartDate: getEarliestSuccessorStart([predecessor.endDate])!,
    completedSuccessor: successor.status === 'completed',
  }
}

export function listScheduleConflictPresentations(
  currentIssues: CurrentProjectIssues,
  tasks: ProjectTask[],
  dependencies: Dependency[],
): ScheduleConflictPresentation[] {
  return currentIssues.scheduleConflicts
    .map((reason) => describeScheduleConflict(reason, tasks, dependencies))
    .filter((conflict): conflict is ScheduleConflictPresentation => Boolean(conflict))
}
