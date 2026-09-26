import type { ProjectTask } from '../types/task'
import type { CurrentProjectIssues } from '../types/impact'
import { listCurrentIssues } from './currentProjectAnalysis'

export function selectTasksRequiringAttention(
  tasks: ProjectTask[],
  affectedTaskIds: string[],
  criticalTaskIds: string[],
  currentIssues: CurrentProjectIssues,
): ProjectTask[] {
  const affectedTaskIdSet = new Set(affectedTaskIds)
  const criticalTaskIdSet = new Set(criticalTaskIds)
  const currentIssueTaskIds = new Set(listCurrentIssues(currentIssues).flatMap((issue) => [
    issue.sourceTaskId,
    ...issue.affectedTaskIds,
  ]))
  return tasks
    .filter((task) => task.status !== 'completed')
    .filter((task) => (
      criticalTaskIdSet.has(task.id)
      || task.riskState !== 'none'
      || affectedTaskIdSet.has(task.id)
      || currentIssueTaskIds.has(task.id)
    ))
    .sort((left, right) => (
      Number(affectedTaskIdSet.has(right.id)) - Number(affectedTaskIdSet.has(left.id))
      || Number(right.riskState === 'at-risk') - Number(left.riskState === 'at-risk')
      || left.endDate.localeCompare(right.endDate)
    ))
}
