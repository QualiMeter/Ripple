import type { Dependency } from '../types/dependency'
import type { ImpactAnalysis } from '../types/impact'
import type { Project } from '../types/project'
import type { ProjectTask, TaskUpdateRequest } from '../types/task'

const dayMs = 86_400_000

export function differenceInDays(later: string, earlier: string): number {
  return Math.round((Date.parse(later) - Date.parse(earlier)) / dayMs)
}

function addDays(date: string, days: number): string {
  return new Date(Date.parse(date) + days * dayMs).toISOString().slice(0, 10)
}

function inclusiveDuration(startDate: string, endDate: string): number {
  return Math.max(1, differenceInDays(endDate, startDate) + 1)
}

function applyTaskUpdate(task: ProjectTask, update: TaskUpdateRequest): ProjectTask {
  const startDate = update.startDate ?? task.startDate
  const currentDuration = task.durationDays || inclusiveDuration(task.startDate, task.endDate)
  const endDate = update.endDate
    ?? (update.durationDays !== undefined
      ? addDays(startDate, Math.max(1, update.durationDays) - 1)
      : update.startDate
        ? addDays(startDate, currentDuration - 1)
        : task.endDate)

  return {
    ...task,
    ...update,
    startDate,
    endDate,
    durationDays: inclusiveDuration(startDate, endDate),
    riskState: endDate > task.plannedEndDate ? 'at-risk' : task.riskState,
  }
}

export interface ScheduleRecalculationResult {
  tasks: ProjectTask[]
  updatedTask: ProjectTask
  affectedTaskIds: string[]
}

export function recalculateSchedule(
  tasks: ProjectTask[],
  dependencies: Dependency[],
  taskId: string,
  update: TaskUpdateRequest,
): ScheduleRecalculationResult {
  const sourceTask = tasks.find((task) => task.id === taskId)
  if (!sourceTask) throw new Error('Задача не найдена')

  const recalculatedTasks = tasks.map((task) => (
    task.id === taskId ? applyTaskUpdate(task, update) : { ...task }
  ))
  const tasksById = new Map(recalculatedTasks.map((task) => [task.id, task]))
  const downstreamTaskIds = findDownstreamTaskIds(taskId, dependencies)
  const affectedTaskIds = new Set<string>()

  for (let iteration = 0; iteration < downstreamTaskIds.length; iteration += 1) {
    let changed = false

    for (const downstreamTaskId of downstreamTaskIds) {
      const task = tasksById.get(downstreamTaskId)
      if (!task) continue

      const predecessorEndDates = dependencies
        .filter((dependency) => dependency.successorTaskId === downstreamTaskId)
        .map((dependency) => tasksById.get(dependency.predecessorTaskId)?.endDate)
        .filter((date): date is string => Boolean(date))

      if (predecessorEndDates.length === 0) continue
      const latestPredecessorEnd = predecessorEndDates.reduce((latest, date) => date > latest ? date : latest)
      const earliestStart = addDays(latestPredecessorEnd, 1)
      if (task.startDate >= earliestStart) continue

      const shiftDays = differenceInDays(earliestStart, task.startDate)
      const shiftedTask: ProjectTask = {
        ...task,
        startDate: addDays(task.startDate, shiftDays),
        endDate: addDays(task.endDate, shiftDays),
        riskState: 'at-risk',
        changeNote: `Сдвиг на ${shiftDays} дн. из-за зависимости`,
      }
      tasksById.set(task.id, shiftedTask)
      affectedTaskIds.add(task.id)
      changed = true
    }

    if (!changed) break
  }

  const resultTasks = recalculatedTasks.map((task) => tasksById.get(task.id) ?? task)
  return {
    tasks: resultTasks,
    updatedTask: tasksById.get(taskId)!,
    affectedTaskIds: downstreamTaskIds.filter((id) => affectedTaskIds.has(id)),
  }
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

export function buildImpactAnalysis(
  project: Project,
  tasks: ProjectTask[],
  dependencies: Dependency[],
  sourceTaskId: string,
  affectedTaskIds = findDownstreamTaskIds(sourceTaskId, dependencies),
): ImpactAnalysis {
  const projectedProjectEndDate = tasks.reduce(
    (latest, task) => (task.endDate > latest ? task.endDate : latest),
    project.targetEndDate,
  )
  const atRiskTasks = tasks.filter((task) => task.riskState === 'at-risk')
  const sourceTask = tasks.find((task) => task.id === sourceTaskId)
  const sourceDelayDays = sourceTask ? Math.max(0, differenceInDays(sourceTask.endDate, sourceTask.plannedEndDate)) : 0
  const reasons = [
    {
      taskId: sourceTaskId,
      reason: sourceDelayDays > 0
        ? `Завершение задачи сдвинуто на ${sourceDelayDays} дн. относительно исходного плана.`
        : 'Параметры задачи обновлены без сдвига её планового срока.',
      severity: sourceDelayDays > 0 ? 'critical' as const : 'info' as const,
    },
    ...affectedTaskIds.map((taskId) => ({
      taskId,
      reason: 'Срок задачи сдвинут из-за изменения предшествующей работы.',
      severity: 'warning' as const,
    })),
  ]

  return {
    sourceTaskId,
    affectedTaskIds,
    criticalTaskIds: tasks.filter((task) => task.isCritical).map((task) => task.id),
    atRiskTaskIds: atRiskTasks.map((task) => task.id),
    previousProjectEndDate: project.targetEndDate,
    projectedProjectEndDate,
    deadlineShiftDays: Math.max(0, differenceInDays(projectedProjectEndDate, project.targetEndDate)),
    requiresIntervention: projectedProjectEndDate > project.targetEndDate,
    reasons,
    analyzedAt: new Date().toISOString(),
  }
}
