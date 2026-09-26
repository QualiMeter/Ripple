import type { Dependency } from '../types/dependency'
import type { ImpactAnalysis, LastChange } from '../types/impact'
import type { Project } from '../types/project'
import type { ProjectTask, TaskUpdateRequest } from '../types/task'

const dayMs = 86_400_000

export type TaskScheduleOverrides = Record<string, TaskUpdateRequest>

export function differenceInDays(later: string, earlier: string): number {
  return Math.round((Date.parse(later) - Date.parse(earlier)) / dayMs)
}

function addDays(date: string, days: number): string {
  return new Date(Date.parse(date) + days * dayMs).toISOString().slice(0, 10)
}

function nextWorkingDay(date: string): string {
  let candidate = addDays(date, 1)
  while ([0, 6].includes(new Date(`${candidate}T00:00:00Z`).getUTCDay())) {
    candidate = addDays(candidate, 1)
  }
  return candidate
}

function inclusiveDuration(startDate: string, endDate: string): number {
  return Math.max(1, differenceInDays(endDate, startDate) + 1)
}

function applyTaskOverride(task: ProjectTask, update: TaskUpdateRequest): ProjectTask {
  const startDate = update.startDate ?? task.startDate
  const currentDuration = inclusiveDuration(task.startDate, task.endDate)
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
    progress: update.status === 'completed' ? 100 : task.progress,
    changeNote: undefined,
  }
}

function deriveRiskState(task: ProjectTask, baselineTask: ProjectTask): ProjectTask['riskState'] {
  if (task.status === 'completed') return 'none'
  if (task.endDate > task.plannedEndDate) return 'at-risk'
  return baselineTask.riskState === 'watch' ? 'watch' : 'none'
}

export interface ScheduleRecalculationResult {
  tasks: ProjectTask[]
  updatedTask: ProjectTask
  affectedTaskIds: string[]
}

export interface ScheduleBuildResult {
  tasks: ProjectTask[]
  affectedTaskIds: string[]
}

export function rebuildSchedule(
  baselineTasks: ProjectTask[],
  dependencies: Dependency[],
  taskOverrides: TaskScheduleOverrides,
  previousTasks: ProjectTask[] = baselineTasks,
  affectedCandidateIds: string[] = [],
): ScheduleBuildResult {
  const tasksById = new Map(baselineTasks.map((task) => [
    task.id,
    applyTaskOverride({ ...task }, taskOverrides[task.id] ?? {}),
  ]))

  for (let iteration = 0; iteration < baselineTasks.length; iteration += 1) {
    let changed = false

    for (const dependency of dependencies) {
      const predecessor = tasksById.get(dependency.predecessorTaskId)
      const successor = tasksById.get(dependency.successorTaskId)
      if (!predecessor || !successor || successor.status === 'completed') continue

      const earliestStart = nextWorkingDay(predecessor.endDate)
      if (successor.startDate >= earliestStart) continue

      const shiftDays = differenceInDays(earliestStart, successor.startDate)
      tasksById.set(successor.id, {
        ...successor,
        startDate: addDays(successor.startDate, shiftDays),
        endDate: addDays(successor.endDate, shiftDays),
      })
      changed = true
    }

    if (!changed) break
  }

  const baselineById = new Map(baselineTasks.map((task) => [task.id, task]))
  const previousById = new Map(previousTasks.map((task) => [task.id, task]))
  const affectedTaskIds = affectedCandidateIds.filter((taskId) => {
    const previousTask = previousById.get(taskId)
    const nextTask = tasksById.get(taskId)
    return Boolean(previousTask && nextTask && nextTask.status !== 'completed' && (
      previousTask.startDate !== nextTask.startDate || previousTask.endDate !== nextTask.endDate
    ))
  })
  const affectedTaskIdSet = new Set(affectedTaskIds)

  const tasks = baselineTasks.map((baselineTask) => {
    const task = tasksById.get(baselineTask.id) ?? baselineTask
    const shiftDays = differenceInDays(task.startDate, baselineTask.plannedStartDate)
    return {
      ...task,
      riskState: deriveRiskState(task, baselineById.get(task.id) ?? baselineTask),
      changeNote: affectedTaskIdSet.has(task.id)
        ? shiftDays === 0
          ? 'Срок восстановлен после пересчёта зависимостей'
          : `${shiftDays > 0 ? 'Сдвиг' : 'Возврат'} на ${Math.abs(shiftDays)} дн. после пересчёта зависимостей`
        : undefined,
    }
  })

  return { tasks, affectedTaskIds }
}

export function recalculateSchedule(
  baselineTasks: ProjectTask[],
  dependencies: Dependency[],
  taskOverrides: TaskScheduleOverrides,
  sourceTaskId: string,
  previousTasks: ProjectTask[] = baselineTasks,
  affectedCandidateIds = findDownstreamTaskIds(sourceTaskId, dependencies),
): ScheduleRecalculationResult {
  if (!baselineTasks.some((task) => task.id === sourceTaskId)) throw new Error('Задача не найдена')
  const result = rebuildSchedule(
    baselineTasks,
    dependencies,
    taskOverrides,
    previousTasks,
    affectedCandidateIds,
  )

  return {
    ...result,
    updatedTask: result.tasks.find((task) => task.id === sourceTaskId)!,
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
  lastChange?: LastChange,
  previousProjectedEndDate = project.targetEndDate,
): ImpactAnalysis {
  const projectedProjectEndDate = tasks.length > 0
    ? tasks.reduce((latest, task) => task.endDate > latest ? task.endDate : latest, tasks[0].endDate)
    : project.targetEndDate
  const sourceTask = tasks.find((task) => task.id === sourceTaskId)
  const reasons = affectedTaskIds.map((taskId) => ({
    taskId,
    reason: 'Срок задачи изменён при пересчёте зависимостей.',
    severity: 'warning' as const,
  }))
  const deadlineShiftDays = differenceInDays(projectedProjectEndDate, project.targetEndDate)
  const projectEndChangeDays = differenceInDays(projectedProjectEndDate, previousProjectedEndDate)

  return {
    sourceTaskId,
    lastChange: lastChange ?? {
      kind: 'task-updated',
      taskId: sourceTaskId,
      taskTitle: sourceTask?.title ?? 'Изменённая задача',
      changes: [],
    },
    affectedTaskIds,
    criticalTaskIds: tasks.filter((task) => task.isCritical).map((task) => task.id),
    atRiskTaskIds: tasks
      .filter((task) => task.status !== 'completed' && task.riskState === 'at-risk')
      .map((task) => task.id),
    previousProjectEndDate: previousProjectedEndDate,
    projectedProjectEndDate,
    projectEndChangeDays,
    deadlineShiftDays,
    requiresIntervention: deadlineShiftDays > 0,
    reasons,
    analyzedAt: new Date().toISOString(),
  }
}
