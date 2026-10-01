import type { ScheduleShiftPreview, TaskScheduleShift } from '../types/schedule'
import type { ProjectWorkspace } from '../types/workspace'
import { formatFullDate } from '../utils/date'
import { buildTaskReassignmentPreview, type TaskReassignmentPreview } from './taskReassignment'
import { findDownstreamTaskIds } from './dependencyGraph'
import { getSchedulePreviewSourceIds } from './schedulePreviewSource'
import {
  applyScheduleShiftPreview,
  calculateScheduleShiftPreview,
  differenceInDays,
} from './scheduleEngine'
import { findDependencyDateConflicts } from './scheduleRules'
import { describeScheduleConflict } from './scheduleConflictPresentation'
import { analyzeTeamWorkloadAttention } from './teamWorkload'

export interface RecoveryCause {
  title: string
  detail: string
  affectedTaskIds: string[]
}

export interface ScheduleShiftRecoveryOption {
  type: 'schedule-shift'
  sourceTaskId: string
  preview: ScheduleShiftPreview
  taskShifts: TaskScheduleShift[]
  conflictsBefore: number
  conflictsAfter: number
  remainingProblem: string
}

export interface PreserveDeadlineRecoveryOption {
  type: 'preserve-deadline'
  daysToRecover: number
  criticalTaskIds: string[]
  remainingProblem: string
}

export interface WorkloadRecoveryOption {
  type: 'workload-reassignment'
  preview: TaskReassignmentPreview
  remainingProblem: string
}

export interface ManualRecoveryOption {
  type: 'manual-task-review'
  taskId: string
  taskTitle: string
  reason: string
  remainingProblem: string
}

export type RecoveryOption = ScheduleShiftRecoveryOption
  | PreserveDeadlineRecoveryOption
  | WorkloadRecoveryOption
  | ManualRecoveryOption

export interface RecoveryPlan {
  interventionRequired: boolean
  plannedEndDate: string
  projectedEndDate: string
  delayDays: number
  criticalTaskIds: string[]
  criticalChainTaskIds: string[]
  affectedTaskIds: string[]
  cause: RecoveryCause
  options: RecoveryOption[]
}

export interface ScheduleRecoveryResult {
  conflictsBefore: number
  conflictsAfter: number
  delayDaysBefore: number
  delayDaysAfter: number
  projectedEndDateBefore: string
  projectedEndDateAfter: string
  changedTaskCount: number
}

function longestCriticalChain(workspace: ProjectWorkspace): string[] {
  const critical = new Set(workspace.impact.criticalTaskIds.filter((id) => workspace.tasks.some((task) => task.id === id)))
  if (critical.size === 0) return []
  const successors = new Map<string, string[]>()
  const incoming = new Set<string>()
  workspace.dependencies.forEach((dependency) => {
    if (!critical.has(dependency.predecessorTaskId) || !critical.has(dependency.successorTaskId)) return
    successors.set(dependency.predecessorTaskId, [...(successors.get(dependency.predecessorTaskId) ?? []), dependency.successorTaskId])
    incoming.add(dependency.successorTaskId)
  })
  const taskOrder = new Map(workspace.tasks.map((task, index) => [task.id, index]))
  const starts = [...critical].filter((id) => !incoming.has(id))
  const candidates = starts.length > 0 ? starts : [...critical]
  const visit = (taskId: string, path: string[]): string[] => {
    if (path.includes(taskId)) return path
    const nextPath = [...path, taskId]
    const next = (successors.get(taskId) ?? []).filter((id) => !nextPath.includes(id))
    if (next.length === 0) return nextPath
    return next.map((id) => visit(id, nextPath)).sort((left, right) => right.length - left.length
      || (taskOrder.get(left[0]) ?? 0) - (taskOrder.get(right[0]) ?? 0))[0]
  }
  return candidates.map((id) => visit(id, [])).sort((left, right) => right.length - left.length
    || (taskOrder.get(left[0]) ?? 0) - (taskOrder.get(right[0]) ?? 0))[0]
}

function buildCause(workspace: ProjectWorkspace, workloadTaskIds: string[]): RecoveryCause {
  const scheduleConflict = workspace.currentIssues.scheduleConflicts
    .map((reason) => describeScheduleConflict(reason, workspace.tasks, workspace.dependencies))
    .find(Boolean)
  if (scheduleConflict) {
    const downstream = findDownstreamTaskIds(scheduleConflict.successor.id, workspace.dependencies)
    return {
      title: `«${scheduleConflict.successor.title}» нарушает зависимость после «${scheduleConflict.predecessor.title}».`,
      detail: `Задача начинается ${formatFullDate(scheduleConflict.successor.startDate)}, допустимый старт — не раньше ${formatFullDate(scheduleConflict.earliestStartDate)}.`,
      affectedTaskIds: [...new Set([scheduleConflict.successor.id, ...downstream])],
    }
  }
  const sourceTask = workspace.tasks.find((task) => task.id === workspace.impact.sourceTaskId)
  if (sourceTask) {
    const critical = workspace.impact.criticalTaskIds.includes(sourceTask.id)
    return {
      title: `Изменение задачи «${sourceTask.title}» повлияло на текущий план.`,
      detail: critical ? 'Задача находится на критической цепочке и не имеет запаса по срокам.' : 'Ripple пересчитал последствия по текущему графу зависимостей.',
      affectedTaskIds: [...new Set([sourceTask.id, ...findDownstreamTaskIds(sourceTask.id, workspace.dependencies)])],
    }
  }
  if (workloadTaskIds.length > 0) {
    return {
      title: 'Расписание команды создаёт высокую параллельную нагрузку.',
      detail: 'Ripple нашёл вариант перераспределения, рассчитанный только по датам задач.',
      affectedTaskIds: workloadTaskIds,
    }
  }
  return {
    title: `Текущий прогноз выходит за плановый срок на ${Math.max(0, differenceInDays(workspace.impact.projectedProjectEndDate, workspace.project.targetEndDate))} дн.`,
    detail: 'Для возврата к плану требуется решение руководителя по критической цепочке.',
    affectedTaskIds: workspace.impact.criticalTaskIds,
  }
}

function getSchedulePreview(workspace: ProjectWorkspace, backendPreview?: ScheduleShiftPreview | null): ScheduleShiftPreview | null {
  const sourceTaskId = getSchedulePreviewSourceIds(workspace.currentIssues)[0]
  if (!sourceTaskId) return null
  if (backendPreview?.sourceTaskId === sourceTaskId) return backendPreview
  return calculateScheduleShiftPreview(workspace.project.id, workspace.tasks, workspace.dependencies, sourceTaskId)
}

export function buildScheduleRecoveryResult(workspace: ProjectWorkspace, preview: ScheduleShiftPreview): ScheduleRecoveryResult {
  const proposedTasks = applyScheduleShiftPreview(workspace.tasks, preview)
  const projectedEndDateAfter = preview.proposedProjectEndDate
  return {
    conflictsBefore: findDependencyDateConflicts(workspace.tasks, workspace.dependencies).length,
    conflictsAfter: findDependencyDateConflicts(proposedTasks, workspace.dependencies).length,
    delayDaysBefore: Math.max(0, differenceInDays(workspace.impact.projectedProjectEndDate, workspace.project.targetEndDate)),
    delayDaysAfter: Math.max(0, differenceInDays(projectedEndDateAfter, workspace.project.targetEndDate)),
    projectedEndDateBefore: workspace.impact.projectedProjectEndDate,
    projectedEndDateAfter,
    changedTaskCount: preview.taskShifts.filter((shift) => {
      const task = workspace.tasks.find((candidate) => candidate.id === shift.taskId)
      return task?.status !== 'completed' && !shift.completedRequiresManualResolution
    }).length,
  }
}

export function buildRecoveryPlan(workspace: ProjectWorkspace, backendPreview?: ScheduleShiftPreview | null): RecoveryPlan {
  const projectedEndDate = workspace.impact.projectedProjectEndDate
  const delayDays = Math.max(0, differenceInDays(projectedEndDate, workspace.project.targetEndDate))
  const criticalTaskIds = workspace.impact.criticalTaskIds.filter((id) => workspace.tasks.some((task) => task.id === id))
  const options: RecoveryOption[] = []
  const schedulePreview = getSchedulePreview(workspace, backendPreview)
  if (schedulePreview) {
    const result = buildScheduleRecoveryResult(workspace, schedulePreview)
    const taskShifts = schedulePreview.taskShifts.filter((shift) => {
      const task = workspace.tasks.find((candidate) => candidate.id === shift.taskId)
      return task?.status !== 'completed' && !shift.completedRequiresManualResolution
        && (shift.currentStartDate !== shift.proposedStartDate || shift.currentEndDate !== shift.proposedEndDate)
    })
    if (taskShifts.length > 0) {
      options.push({
        type: 'schedule-shift',
        sourceTaskId: schedulePreview.sourceTaskId,
        preview: schedulePreview,
        taskShifts,
        conflictsBefore: result.conflictsBefore,
        conflictsAfter: result.conflictsAfter,
        remainingProblem: result.delayDaysAfter > 0
          ? `Плановый срок останется ${formatFullDate(workspace.project.targetEndDate)}; прогноз будет позже него на ${result.delayDaysAfter} дн.`
          : result.conflictsAfter > 0 ? `После сдвига останется конфликтов: ${result.conflictsAfter}.` : 'Конфликты зависимостей будут устранены.',
      })
    }
  }
  if (delayDays > 0) {
    const actionableCriticalTaskIds = criticalTaskIds.filter((id) => {
      const task = workspace.tasks.find((candidate) => candidate.id === id)
      return task?.status !== 'completed' && (workspace.impact.slackDaysByTaskId[id] ?? 0) <= 0
    })
    if (actionableCriticalTaskIds.length > 0) {
      options.push({
        type: 'preserve-deadline',
        daysToRecover: delayDays,
        criticalTaskIds: actionableCriticalTaskIds,
        remainingProblem: 'Ripple не меняет длительность работ автоматически: объём, приоритеты и ресурсы должен подтвердить руководитель.',
      })
    }
  }
  const workloadAttention = analyzeTeamWorkloadAttention(workspace.assignees, workspace.tasks)
  const reassignmentPreview = workloadAttention.primary?.level === 'high' && workloadAttention.reassignment
    ? buildTaskReassignmentPreview(workspace, workloadAttention.reassignment)
    : null
  if (reassignmentPreview) {
    options.push({
      type: 'workload-reassignment',
      preview: reassignmentPreview,
      remainingProblem: 'Кандидат выбран только по расписанию; компетенции и фактическую трудоёмкость должен подтвердить руководитель.',
    })
  }
  if (workspace.currentIssues.scheduleConflicts.length > 0 && !options.some((option) => option.type === 'schedule-shift')) {
    const completedConflict = workspace.currentIssues.scheduleConflicts
      .map((reason) => describeScheduleConflict(reason, workspace.tasks, workspace.dependencies))
      .find((conflict) => conflict?.completedSuccessor)
    if (completedConflict) options.push({
      type: 'manual-task-review',
      taskId: completedConflict.successor.id,
      taskTitle: completedConflict.successor.title,
      reason: 'Завершённую задачу нельзя сдвинуть автоматически. Нужно проверить её фактические даты.',
      remainingProblem: 'До ручного уточнения дат конфликт зависимости останется в плане.',
    })
  }
  const workloadTaskIds = reassignmentPreview ? [reassignmentPreview.taskId] : []
  const cause = buildCause(workspace, workloadTaskIds)
  const affectedTaskIds = [...new Set([
    ...workspace.impact.affectedTaskIds,
    ...workspace.currentIssues.affectedTaskIds,
    ...cause.affectedTaskIds,
    ...workloadTaskIds,
  ])]
  const seriousProblem = delayDays > 0 || workspace.currentIssues.scheduleConflicts.length > 0
    || workloadAttention.primary?.level === 'high'
  return {
    interventionRequired: Boolean(seriousProblem && options.length > 0),
    plannedEndDate: workspace.project.targetEndDate,
    projectedEndDate,
    delayDays,
    criticalTaskIds,
    criticalChainTaskIds: longestCriticalChain(workspace),
    affectedTaskIds,
    cause,
    options,
  }
}
