import type { Dependency } from '../types/dependency'

export function isDependencyInImpactPath(
  dependency: Dependency,
  sourceTaskId: string,
  affectedTaskIds: string[],
): boolean {
  const affectedTaskIdSet = new Set(affectedTaskIds)
  return affectedTaskIdSet.has(dependency.successorTaskId)
    && (dependency.predecessorTaskId === sourceTaskId
      || affectedTaskIdSet.has(dependency.predecessorTaskId))
}
