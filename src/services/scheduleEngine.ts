import type { Dependency } from '../types/dependency'
import type { ImpactAnalysis } from '../types/impact'
import type { Project } from '../types/project'
import type { ProjectTask } from '../types/task'

const dayMs = 86_400_000

export function differenceInDays(later: string, earlier: string): number {
  return Math.round((Date.parse(later) - Date.parse(earlier)) / dayMs)
}

export function findDownstreamTaskIds(sourceTaskId: string, dependencies: Dependency[]): string[] {
  const visited = new Set<string>()
  const queue = [sourceTaskId]

  while (queue.length) {
    const current = queue.shift()!
    dependencies
      .filter((dependency) => dependency.predecessorTaskId === current)
      .forEach((dependency) => {
        if (!visited.has(dependency.successorTaskId)) {
          visited.add(dependency.successorTaskId)
          queue.push(dependency.successorTaskId)
        }
      })
  }

  return [...visited]
}

export function buildImpactAnalysis(project: Project, tasks: ProjectTask[], dependencies: Dependency[], sourceTaskId: string): ImpactAnalysis {
  const affectedTaskIds = findDownstreamTaskIds(sourceTaskId, dependencies)
  const projectedProjectEndDate = tasks.reduce(
    (latest, task) => (task.endDate > latest ? task.endDate : latest),
    project.targetEndDate,
  )
  const atRiskTasks = tasks.filter((task) => task.riskState === 'at-risk')

  return {
    sourceTaskId,
    affectedTaskIds,
    criticalTaskIds: tasks.filter((task) => task.isCritical).map((task) => task.id),
    atRiskTaskIds: atRiskTasks.map((task) => task.id),
    previousProjectEndDate: project.targetEndDate,
    projectedProjectEndDate,
    deadlineShiftDays: Math.max(0, differenceInDays(projectedProjectEndDate, project.targetEndDate)),
    requiresIntervention: projectedProjectEndDate > project.targetEndDate,
    reasons: [
      { taskId: sourceTaskId, reason: 'Задержка данных от поставщика сдвинула завершение API на 3 рабочих дня.', severity: 'critical' },
      { taskId: 'frontend', reason: 'Интеграцию интерфейса нельзя начать до готовности API.', severity: 'warning' },
      { taskId: 'release', reason: 'Критическая цепочка теперь завершается позже планового срока.', severity: 'critical' },
    ],
    analyzedAt: '2026-10-16T09:42:00.000Z',
  }
}
