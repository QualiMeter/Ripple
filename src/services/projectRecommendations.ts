import type { ProjectWorkspace } from '../types/workspace'
import { pluralizeRu } from '../utils/plural'
import { differenceInDays } from './scheduleEngine'
import { describeScheduleConflict } from './scheduleConflictPresentation'
import { analyzeTeamWorkloadAttention, type EmployeeWorkload } from './teamWorkload'
import { formatFullDate } from '../utils/date'

export type ProjectRecommendationAction =
  | { type: 'preview-shift'; sourceTaskId: string; label: string }
  | { type: 'open-task'; taskId: string; label: string }
  | { type: 'view-workload'; label: string }

export interface ProjectRecommendation {
  id: string
  title: string
  description: string
  affectedTaskIds: string[]
  recommendation: string
  tone: 'danger' | 'warning' | 'success'
  action?: ProjectRecommendationAction
}

function formatWorkloadPeriod(workload: EmployeeWorkload): string {
  if (!workload.peakStartDate || !workload.peakEndDate) return ''
  return workload.peakStartDate === workload.peakEndDate
    ? formatFullDate(workload.peakStartDate)
    : `${formatFullDate(workload.peakStartDate)}–${formatFullDate(workload.peakEndDate)}`
}

export function buildProjectRecommendations(workspace: ProjectWorkspace): ProjectRecommendation[] {
  const { currentIssues, tasks, dependencies, impact, project } = workspace
  const scheduleConflicts = currentIssues.scheduleConflicts
    .map((reason) => ({ reason, conflict: describeScheduleConflict(reason, tasks, dependencies) }))
    .filter((item) => Boolean(item.conflict))
  const manualConflicts = scheduleConflicts.filter((item) => item.conflict!.completedSuccessor)
  const shiftableConflicts = scheduleConflicts.filter((item) => !item.conflict!.completedSuccessor)
  const recommendations: ProjectRecommendation[] = []

  if (shiftableConflicts.length > 0) {
    const count = shiftableConflicts.length
    recommendations.push({
      id: 'schedule-conflicts',
      title: 'Устранить конфликт расписания',
      description: `${count} ${pluralizeRu(count, ['зависимая задача начинается', 'зависимые задачи начинаются', 'зависимых задач начинаются'])} раньше допустимой даты.`,
      affectedTaskIds: [...new Set(shiftableConflicts.flatMap(({ reason }) => reason.affectedTaskIds))],
      recommendation: 'Рассчитать автоматический сдвиг',
      tone: 'danger',
      action: { type: 'preview-shift', sourceTaskId: shiftableConflicts[0].reason.sourceTaskId, label: 'Рассчитать автоматический сдвиг' },
    })
  }

  const deadlineOverrunDays = differenceInDays(impact.projectedProjectEndDate, project.targetEndDate)
  if (deadlineOverrunDays > 0) {
    recommendations.push({
      id: 'project-deadline',
      title: 'Определиться со сроком проекта',
      description: `Текущий план выходит за плановый срок на ${deadlineOverrunDays} ${pluralizeRu(deadlineOverrunDays, ['календарный день', 'календарных дня', 'календарных дней'])}. После проверки сдвига решите, менять ли срок проекта.`,
      affectedTaskIds: tasks.filter((task) => task.endDate > project.targetEndDate).map((task) => task.id),
      recommendation: 'Рассмотреть продление проекта',
      tone: 'warning',
    })
  }

  if (manualConflicts.length > 0) {
    const task = manualConflicts[0].conflict!.successor
    recommendations.push({
      id: 'completed-conflict',
      title: 'Требуется ручное решение',
      description: `Завершённая задача «${task.title}» участвует в конфликте и не может быть перенесена автоматически.`,
      affectedTaskIds: [task.id],
      recommendation: 'Открыть задачу и проверить фактические даты',
      tone: 'danger',
      action: { type: 'open-task', taskId: task.id, label: 'Открыть задачу' },
    })
  }

  if (currentIssues.statusConflicts.length > 0) {
    const reason = currentIssues.statusConflicts[0]
    const taskId = reason.affectedTaskIds[0] ?? reason.sourceTaskId
    recommendations.push({
      id: 'status-conflicts',
      title: 'Проверить статусы задач',
      description: `${currentIssues.statusConflicts.length} ${pluralizeRu(currentIssues.statusConflicts.length, ['задача имеет', 'задачи имеют', 'задач имеют'])} логический конфликт статусов со связанными работами.`,
      affectedTaskIds: [...new Set(currentIssues.statusConflicts.flatMap((item) => item.affectedTaskIds))],
      recommendation: 'Проверить статус',
      tone: 'warning',
      action: { type: 'open-task', taskId, label: 'Открыть задачу' },
    })
  }

  if (currentIssues.deadlineIssues.length > 0 && recommendations.length < 4) {
    const reason = currentIssues.deadlineIssues[0]
    recommendations.push({
      id: 'overdue-tasks',
      title: 'Проверить просроченную задачу',
      description: reason.reason,
      affectedTaskIds: [...new Set(currentIssues.deadlineIssues.flatMap((item) => item.affectedTaskIds))],
      recommendation: 'Изменить сроки или уточнить статус',
      tone: 'danger',
      action: { type: 'open-task', taskId: reason.affectedTaskIds[0] ?? reason.sourceTaskId, label: 'Открыть задачу' },
    })
  }

  const workloadAttention = analyzeTeamWorkloadAttention(workspace.assignees, tasks)
  const imbalance = workloadAttention.imbalance
  if (imbalance && recommendations.length < 4) {
    const { overloaded, idleEmployeeNames } = imbalance
    const period = formatWorkloadPeriod(overloaded)
    recommendations.push({
      id: 'team-workload',
      title: 'Неравномерная загрузка команды',
      description: `${overloaded.employeeName} ведёт ${overloaded.maxConcurrentTasks} ${pluralizeRu(overloaded.maxConcurrentTasks, ['задачу', 'задачи', 'задач'])} одновременно (${period}). Без активных задач в этот период: ${idleEmployeeNames.join(', ')}.`,
      affectedTaskIds: overloaded.peakTaskIds,
      recommendation: 'Проверить возможность перераспределения одной из задач',
      tone: 'warning',
      action: { type: 'view-workload', label: 'Посмотреть загрузку' },
    })
  } else if (workloadAttention.highWorkloads.length > 0 && recommendations.length < 4) {
    const highWorkload = workloadAttention.highWorkloads[0]
    recommendations.push({
      id: 'team-high-workload',
      title: 'Высокая параллельная загрузка',
      description: `${highWorkload.employeeName} ведёт ${highWorkload.maxConcurrentTasks} ${pluralizeRu(highWorkload.maxConcurrentTasks, ['задачу', 'задачи', 'задач'])} одновременно (${formatWorkloadPeriod(highWorkload)}).`,
      affectedTaskIds: highWorkload.peakTaskIds,
      recommendation: 'Проверить распределение работ',
      tone: 'warning',
      action: { type: 'view-workload', label: 'Посмотреть загрузку' },
    })
  }

  if (recommendations.length === 0) {
    return [{
      id: 'no-action-required',
      title: 'Вмешательство не требуется',
      description: 'Текущий план не содержит конфликтов, требующих действий.',
      affectedTaskIds: [],
      recommendation: 'Продолжать работу по текущему плану',
      tone: 'success',
    }]
  }

  return recommendations.slice(0, 3)
}
