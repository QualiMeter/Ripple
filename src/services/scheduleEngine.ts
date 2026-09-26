import type { Dependency } from '../types/dependency'
import type { CurrentProjectIssues, ImpactAnalysis, ImpactReason, LastChange } from '../types/impact'
import type { Project } from '../types/project'
import type { ScheduleShiftPreview, TaskScheduleShift } from '../types/schedule'
import type { ProjectTask, TaskUpdateRequest } from '../types/task'
import { analyzeStatusChange } from './statusAnalysis'
import { analyzeCriticalPath } from './criticalPath'

const dayMs = 86_400_000

export function differenceInDays(later: string, earlier: string): number {
  return Math.round((Date.parse(later) - Date.parse(earlier)) / dayMs)
}

function addDays(date: string, days: number): string {
  return new Date(Date.parse(date) + days * dayMs).toISOString().slice(0, 10)
}

export function inclusiveDuration(startDate: string, endDate: string): number {
  return Math.max(1, differenceInDays(endDate, startDate) + 1)
}

function latestTaskEnd(tasks: ProjectTask[], fallback: string): string {
  return tasks.reduce((latest, task) => task.endDate > latest ? task.endDate : latest, fallback)
}

function deriveRiskState(task: ProjectTask): ProjectTask['riskState'] {
  if (task.status === 'completed') return 'none'
  if (task.endDate > task.plannedEndDate) return 'at-risk'
  return task.riskState === 'watch' ? 'watch' : 'none'
}

export function applyExplicitTaskUpdate(task: ProjectTask, update: TaskUpdateRequest): ProjectTask {
  const startDate = update.startDate ?? task.startDate
  const endDate = update.endDate ?? task.endDate
  const nextTask: ProjectTask = {
    ...task,
    ...update,
    startDate,
    endDate,
    durationDays: inclusiveDuration(startDate, endDate),
    progress: update.status === 'completed' ? 100 : task.progress,
    changeNote: undefined,
  }
  return { ...nextTask, riskState: deriveRiskState(nextTask) }
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

export function findScheduleConflicts(
  tasks: ProjectTask[],
  dependencies: Dependency[],
  candidateTaskIds: string[],
): ImpactReason[] {
  const tasksById = new Map(tasks.map((task) => [task.id, task]))
  const candidates = new Set(candidateTaskIds)
  return dependencies.flatMap((dependency): ImpactReason[] => {
    const predecessor = tasksById.get(dependency.predecessorTaskId)
    const successor = tasksById.get(dependency.successorTaskId)
    if (!predecessor || !successor || !candidates.has(successor.id)) return []
    const earliestStart = addDays(predecessor.endDate, 1)
    if (successor.startDate >= earliestStart) return []
    if (successor.status === 'completed') {
      return [{
        sourceTaskId: predecessor.id,
        affectedTaskIds: [successor.id],
        reason: `Фактические даты законченной задачи «${successor.title}» конфликтуют с зависимостью от «${predecessor.title}».`,
        consequence: 'Законченную задачу нельзя сдвинуть автоматически — требуется ручное решение и проверка фактических дат.',
        severity: 'warning' as const,
        action: { type: 'open-task' as const, taskId: successor.id },
      }]
    }
    return [{
      sourceTaskId: predecessor.id,
      affectedTaskIds: [successor.id],
      reason: `Начало задачи раньше допустимой даты ${earliestStart} после завершения предшественника «${predecessor.title}».`,
      consequence: `Без ручного решения или подтверждённого сдвига задача «${successor.title}» нарушает finish-to-start зависимость.`,
      severity: 'warning' as const,
      action: { type: 'preview-shift' as const },
    }]
  })
}

export function buildCurrentProjectIssues(
  tasks: ProjectTask[],
  dependencies: Dependency[],
): CurrentProjectIssues {
  const scheduleConflicts = findScheduleConflicts(tasks, dependencies, tasks.map((task) => task.id))
  return {
    scheduleConflicts,
    affectedTaskIds: [...new Set(scheduleConflicts.flatMap((reason) => reason.affectedTaskIds))],
  }
}

export function calculateScheduleShiftPreview(
  projectId: string,
  tasks: ProjectTask[],
  dependencies: Dependency[],
  sourceTaskId: string,
): ScheduleShiftPreview {
  const proposedById = new Map(tasks.map((task) => [task.id, { ...task }]))
  const downstreamIds = new Set(findDownstreamTaskIds(sourceTaskId, dependencies))
  for (let iteration = 0; iteration < tasks.length; iteration += 1) {
    let changed = false
    for (const dependency of dependencies) {
      const predecessor = proposedById.get(dependency.predecessorTaskId)
      const successor = proposedById.get(dependency.successorTaskId)
      if (!predecessor || !successor || successor.status === 'completed' || !downstreamIds.has(successor.id)) continue
      const earliestStart = addDays(predecessor.endDate, 1)
      if (successor.startDate >= earliestStart) continue
      const shiftDays = differenceInDays(earliestStart, successor.startDate)
      proposedById.set(successor.id, {
        ...successor,
        startDate: addDays(successor.startDate, shiftDays),
        endDate: addDays(successor.endDate, shiftDays),
      })
      changed = true
    }
    if (!changed) break
  }

  const taskShifts: TaskScheduleShift[] = tasks.flatMap((task) => {
    const proposed = proposedById.get(task.id)!
    if (task.status === 'completed' || (task.startDate === proposed.startDate && task.endDate === proposed.endDate)) return []
    return [{
      taskId: task.id,
      currentStartDate: task.startDate,
      currentEndDate: task.endDate,
      proposedStartDate: proposed.startDate,
      proposedEndDate: proposed.endDate,
      shiftDays: differenceInDays(proposed.startDate, task.startDate),
    }]
  })
  const currentProjectEndDate = latestTaskEnd(tasks, '')
  const proposedProjectEndDate = latestTaskEnd([...proposedById.values()], currentProjectEndDate)
  return {
    projectId,
    sourceTaskId,
    taskShifts,
    currentProjectEndDate,
    proposedProjectEndDate,
    projectEndShiftDays: differenceInDays(proposedProjectEndDate, currentProjectEndDate),
  }
}

export function applyScheduleShiftPreview(tasks: ProjectTask[], preview: ScheduleShiftPreview): ProjectTask[] {
  const shifts = new Map(preview.taskShifts.map((shift) => [shift.taskId, shift]))
  return tasks.map((task) => {
    if (task.status === 'completed') return task.riskState === 'none' ? task : { ...task, riskState: 'none' }
    const shift = shifts.get(task.id)
    if (!shift) return task
    const nextTask = {
      ...task,
      startDate: shift.proposedStartDate,
      endDate: shift.proposedEndDate,
      durationDays: inclusiveDuration(shift.proposedStartDate, shift.proposedEndDate),
      changeNote: `Автоматический сдвиг на ${shift.shiftDays} дн. подтверждён`,
    }
    return { ...nextTask, riskState: deriveRiskState(nextTask) }
  })
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
  const projectedProjectEndDate = latestTaskEnd(tasks, project.targetEndDate)
  const sourceTask = tasks.find((task) => task.id === sourceTaskId)
  const candidateTaskIds = affectedTaskIds.filter((taskId) => tasks.some((task) => task.id === taskId))
  const scheduleReasons = findScheduleConflicts(tasks, dependencies, candidateTaskIds)
  const statusReasons = lastChange ? analyzeStatusChange(tasks, dependencies, lastChange) : []
  const reasons = [...statusReasons, ...scheduleReasons]
  const activeAffectedTaskIds = [...new Set([
    ...candidateTaskIds,
    ...reasons.flatMap((reason) => reason.affectedTaskIds),
  ])]
  const deadlineShiftDays = differenceInDays(projectedProjectEndDate, project.targetEndDate)
  const projectEndChangeDays = differenceInDays(projectedProjectEndDate, previousProjectedEndDate)
  const criticalPath = analyzeCriticalPath(tasks, dependencies)
  return {
    sourceTaskId,
    lastChange: lastChange ?? {
      kind: 'task-updated',
      taskId: sourceTaskId,
      taskTitle: sourceTask?.title ?? 'Изменённая задача',
      changes: [],
    },
    affectedTaskIds: activeAffectedTaskIds,
    criticalTaskIds: criticalPath.criticalTaskIds,
    atRiskTaskIds: tasks.filter((task) => task.status !== 'completed' && task.riskState === 'at-risk').map((task) => task.id),
    previousProjectEndDate: previousProjectedEndDate,
    projectedProjectEndDate,
    projectEndChangeDays,
    deadlineShiftDays,
    requiresIntervention: deadlineShiftDays > 0 || reasons.some((reason) => reason.severity !== 'info'),
    reasons,
    analyzedAt: new Date().toISOString(),
  }
}
