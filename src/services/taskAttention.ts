import type { ProjectTask } from '../types/task'

export function selectTasksRequiringAttention(
  tasks: ProjectTask[],
  affectedTaskIds: string[],
  criticalTaskIds: string[],
): ProjectTask[] {
  const affectedTaskIdSet = new Set(affectedTaskIds)
  const criticalTaskIdSet = new Set(criticalTaskIds)
  return tasks
    .filter((task) => task.status !== 'completed')
    .filter((task) => (
      criticalTaskIdSet.has(task.id)
      || task.riskState !== 'none'
      || affectedTaskIdSet.has(task.id)
    ))
    .sort((left, right) => (
      Number(affectedTaskIdSet.has(right.id)) - Number(affectedTaskIdSet.has(left.id))
      || Number(right.riskState === 'at-risk') - Number(left.riskState === 'at-risk')
      || left.endDate.localeCompare(right.endDate)
    ))
}
