import type { ProjectWorkspace } from '../types/workspace'
import type { ScheduleShiftPreview } from '../types/schedule'
import type { ProjectTask } from '../types/task'
import { formatFullDate } from '../utils/date'
import { pluralizeRu } from '../utils/plural'
import { differenceInDays, calculateScheduleShiftPreview } from './scheduleEngine'
import { describeScheduleConflict } from './scheduleConflictPresentation'
import { analyzeTeamWorkloadAttention } from './teamWorkload'
import { getTaskStatusLabel } from './statusAnalysis'

export type ProjectRecommendationAction =
  | { type: 'preview-shift'; sourceTaskId: string; label: string }
  | { type: 'open-task'; taskId: string; label: string }
  | { type: 'view-workload'; label: string }

export interface ProjectRecommendation {
  id: string
  problem: string
  evidence: string
  proposedAction: string
  expectedEffect: string
  alternatives?: string[]
  affectedTaskIds: string[]
  tone: 'danger' | 'warning' | 'success'
  action?: ProjectRecommendationAction
}

function previewForSource(workspace: ProjectWorkspace, sourceTaskId: string, backendPreview?: ScheduleShiftPreview | null): ScheduleShiftPreview {
  if (backendPreview?.sourceTaskId === sourceTaskId) return backendPreview
  return calculateScheduleShiftPreview(workspace.project.id, workspace.tasks, workspace.dependencies, sourceTaskId)
}

function buildScheduleRecommendation(workspace: ProjectWorkspace, backendPreview?: ScheduleShiftPreview | null): ProjectRecommendation | null {
  const presentations = workspace.currentIssues.scheduleConflicts
    .map((reason) => ({ reason, conflict: describeScheduleConflict(reason, workspace.tasks, workspace.dependencies) }))
    .filter((item) => item.conflict && !item.conflict.completedSuccessor)
  const first = presentations[0]
  if (!first?.conflict) return null
  const preview = previewForSource(workspace, first.reason.sourceTaskId, backendPreview)
  const successorShift = preview.taskShifts.find((shift) => shift.taskId === first.conflict!.successor.id)
  const otherShiftCount = preview.taskShifts.filter((shift) => shift.taskId !== first.conflict!.successor.id && !shift.completedRequiresManualResolution).length
  const manualCount = preview.taskShifts.filter((shift) => shift.completedRequiresManualResolution).length
  const proposedAction = successorShift
    ? `Перенести «${first.conflict.successor.title}» на ${formatFullDate(successorShift.proposedStartDate)}–${formatFullDate(successorShift.proposedEndDate)}${otherShiftCount > 0 ? ` и сдвинуть ещё ${otherShiftCount} ${pluralizeRu(otherShiftCount, ['зависимую задачу', 'зависимые задачи', 'зависимых задач'])} с сохранением длительности` : ''}.`
    : `Перенести «${first.conflict.successor.title}» не раньше ${formatFullDate(first.conflict.earliestStartDate)}, сохранив длительность задачи.`
  const projectEndEffect = preview.projectEndShiftDays === 0
    ? `Конфликт будет устранён без изменения текущего прогноза завершения ${formatFullDate(preview.currentProjectEndDate)}.`
    : `Конфликт будет устранён, прогноз завершения изменится с ${formatFullDate(preview.currentProjectEndDate)} на ${formatFullDate(preview.proposedProjectEndDate)} (${preview.projectEndShiftDays > 0 ? '+' : ''}${preview.projectEndShiftDays} ${pluralizeRu(Math.abs(preview.projectEndShiftDays), ['день', 'дня', 'дней'])}).`
  return {
    id: 'schedule-conflicts',
    problem: 'Конфликт зависимости',
    evidence: `«${first.conflict.successor.title}» начинается ${formatFullDate(first.conflict.successor.startDate)}, хотя после «${first.conflict.predecessor.title}» может стартовать не раньше ${formatFullDate(first.conflict.earliestStartDate)}.`,
    proposedAction,
    expectedEffect: manualCount > 0
      ? `${projectEndEffect} ${manualCount} ${pluralizeRu(manualCount, ['завершённая задача потребует', 'завершённые задачи потребуют', 'завершённых задач потребуют'])} отдельного ручного решения.`
      : projectEndEffect,
    affectedTaskIds: [...new Set([first.conflict.successor.id, ...preview.taskShifts.map((shift) => shift.taskId)])],
    tone: 'danger',
    action: { type: 'preview-shift', sourceTaskId: first.reason.sourceTaskId, label: 'Посмотреть и применить' },
  }
}

function buildDeadlineRecommendation(workspace: ProjectWorkspace, preview?: ScheduleShiftPreview | null): ProjectRecommendation | null {
  const proposedEnd = preview?.proposedProjectEndDate && preview.proposedProjectEndDate > workspace.impact.projectedProjectEndDate
    ? preview.proposedProjectEndDate
    : workspace.impact.projectedProjectEndDate
  const overrunDays = differenceInDays(proposedEnd, workspace.project.targetEndDate)
  if (overrunDays <= 0) return null
  const criticalTasks = workspace.impact.criticalTaskIds
    .map((id) => workspace.tasks.find((task) => task.id === id))
    .filter((task): task is ProjectTask => task !== undefined)
    .filter((task) => task.status !== 'completed')
  const tasksPastDeadline = workspace.tasks.filter((task) => task.endDate > workspace.project.targetEndDate)
  const reviewTaskCount = criticalTasks.length
  const sourceTaskId = preview?.sourceTaskId || workspace.currentIssues.scheduleConflicts[0]?.sourceTaskId
  return {
    id: 'project-deadline',
    problem: 'Выход за плановый срок проекта',
    evidence: `После учёта текущего расписания проект завершится ${formatFullDate(proposedEnd)} вместо ${formatFullDate(workspace.project.targetEndDate)} — позже на ${overrunDays} ${pluralizeRu(overrunDays, ['календарный день', 'календарных дня', 'календарных дней'])}.`,
    proposedAction: preview?.taskShifts.length
      ? `Безопасный вариант по текущему расчёту — применить показанный сдвиг и продлить срок проекта до ${formatFullDate(proposedEnd)}.`
      : `Выбрать между продлением срока до ${formatFullDate(proposedEnd)} и ручным изменением работ критической цепочки.`,
    expectedEffect: `При продлении до ${formatFullDate(proposedEnd)} задачи останутся в рассчитанных датах, а выход за границу проекта исчезнет. Сохранение прежнего срока потребует отдельного пересмотра ${reviewTaskCount > 0 ? `${reviewTaskCount} ${pluralizeRu(reviewTaskCount, ['задачи', 'задач', 'задач'])}` : 'задач'} критической цепочки.`,
    alternatives: [
      `Продлить плановый срок на ${overrunDays} ${pluralizeRu(overrunDays, ['день', 'дня', 'дней'])} — до ${formatFullDate(proposedEnd)}.`,
      `Сохранить срок ${formatFullDate(workspace.project.targetEndDate)} и вручную сократить либо перераспределить задачи критической цепочки${criticalTasks.length > 0 ? `: ${criticalTasks.map((task) => `«${task.title}»`).join(', ')}` : ''}.`,
    ],
    affectedTaskIds: [...new Set([...criticalTasks, ...tasksPastDeadline].map((task) => task.id))],
    tone: 'warning',
    action: sourceTaskId ? { type: 'preview-shift', sourceTaskId, label: 'Посмотреть изменения' } : undefined,
  }
}

function buildCompletedConflictRecommendation(workspace: ProjectWorkspace): ProjectRecommendation | null {
  const conflict = workspace.currentIssues.scheduleConflicts
    .map((reason) => describeScheduleConflict(reason, workspace.tasks, workspace.dependencies))
    .find((item) => item?.completedSuccessor)
  if (!conflict) return null
  return {
    id: 'completed-conflict',
    problem: 'Завершённая задача конфликтует с зависимостью',
    evidence: `«${conflict.successor.title}» отмечена завершённой, но начинается ${formatFullDate(conflict.successor.startDate)} — раньше допустимой даты ${formatFullDate(conflict.earliestStartDate)} после «${conflict.predecessor.title}».`,
    proposedAction: 'Сверить фактические даты и при необходимости вручную исправить задачу или связь. Автоматический сдвиг завершённой задачи запрещён.',
    expectedEffect: 'После исправления фактических данных анализ перестанет считать эту зависимость конфликтной; остальные даты автоматически не изменятся.',
    affectedTaskIds: [conflict.successor.id, conflict.predecessor.id],
    tone: 'danger',
    action: { type: 'open-task', taskId: conflict.successor.id, label: `Открыть ${conflict.successor.title}` },
  }
}

function buildStatusRecommendation(workspace: ProjectWorkspace): ProjectRecommendation | null {
  const issue = workspace.currentIssues.statusConflicts[0]
  if (!issue) return null
  const source = workspace.tasks.find((task) => task.id === issue.sourceTaskId)
  const predecessors = source
    ? workspace.dependencies.filter((dependency) => dependency.successorTaskId === source.id)
      .map((dependency) => workspace.tasks.find((task) => task.id === dependency.predecessorTaskId))
      .filter((task): task is ProjectTask => task !== undefined)
      .filter((task) => task.status !== 'completed')
    : []
  if (!source || predecessors.length === 0) {
    return {
      id: 'status-conflicts',
      problem: 'Конфликт статусов',
      evidence: issue.reason,
      proposedAction: 'Выбрать один из двух вариантов после сверки фактического состояния связанных работ.',
      expectedEffect: 'После подтверждения факта статусы можно привести в соответствие с графом без автоматического изменения дат.',
      alternatives: ['Подтвердить текущий статус и зафиксировать фактическое начало.', 'Вернуть задачу в предыдущий статус, если работа фактически не начиналась.'],
      affectedTaskIds: issue.affectedTaskIds,
      tone: 'warning',
      action: source ? { type: 'open-task', taskId: source.id, label: `Открыть ${source.title}` } : undefined,
    }
  }
  const predecessorNames = predecessors.map((task) => `«${task.title}»`).join(', ')
  const proposedAction = source.status === 'in-progress'
    ? `Подтвердить, действительно ли «${source.title}» уже началась. Если нет — вернуть статус «Не в работе».`
    : `Сверить завершение «${source.title}» с незавершёнными предшественниками и исправить ошибочный статус.`
  return {
    id: 'status-conflicts',
    problem: 'Статус задачи противоречит зависимостям',
    evidence: `«${source.title}» находится в статусе «${getTaskStatusLabel(source.status)}», хотя ${predecessors.length === 1 ? 'предшественник' : 'предшественники'} ${predecessorNames} ещё не ${predecessors.length === 1 ? 'завершён' : 'завершены'}.`,
    proposedAction,
    expectedEffect: `Если работа не начиналась, статус «Не в работе» устранит логический конфликт. Если текущий статус подтверждён, руководителю нужно отдельно согласовать работу до завершения ${predecessors.length === 1 ? 'предшественника' : 'предшественников'}.`,
    alternatives: ['Подтвердить фактическое начало и оставить текущий статус.', 'Вернуть статус «Не в работе», если задача ещё не выполняется.'],
    affectedTaskIds: [source.id, ...predecessors.map((task) => task.id)],
    tone: 'warning',
    action: { type: 'open-task', taskId: source.id, label: `Открыть ${source.title}` },
  }
}

function buildOverdueRecommendation(workspace: ProjectWorkspace): ProjectRecommendation | null {
  const issue = workspace.currentIssues.deadlineIssues[0]
  if (!issue) return null
  const task = workspace.tasks.find((candidate) => issue.affectedTaskIds.includes(candidate.id) || candidate.id === issue.sourceTaskId)
  if (!task) return null
  return {
    id: 'overdue-tasks',
    problem: 'Просроченная задача',
    evidence: `«${task.title}» должна была завершиться ${formatFullDate(task.endDate)}, статус всё ещё «${getTaskStatusLabel(task.status)}».`,
    proposedAction: `Сначала подтвердить фактический статус «${task.title}». Если задача не завершена — обновить срок и повторно оценить зависимые задачи.`,
    expectedEffect: 'При подтверждённом завершении текущая просрочка исчезнет. При новом сроке Ripple пересчитает фактическое влияние на последующие задачи и окончание проекта.',
    alternatives: ['Отметить задачу завершённой, только если работа действительно закончена.', 'Указать новый реалистичный срок и пересчитать последствия.'],
    affectedTaskIds: issue.affectedTaskIds,
    tone: 'danger',
    action: { type: 'open-task', taskId: task.id, label: `Открыть ${task.title}` },
  }
}

function buildWorkloadRecommendation(workspace: ProjectWorkspace): ProjectRecommendation | null {
  const attention = analyzeTeamWorkloadAttention(workspace.assignees, workspace.tasks)
  const workload = attention.primary
  if (!workload) return null
  const suggestion = attention.reassignment
  const targetTask = suggestion ? workspace.tasks.find((task) => task.id === suggestion.taskId) : undefined
  const candidate = suggestion?.candidate
  const proposedAction = targetTask && candidate
    ? `Рассмотреть передачу задачи «${targetTask.title}» сотруднику ${candidate.employeeName}. Кандидат выбран только по расписанию; компетенции необходимо подтвердить руководителю.`
    : 'Сравнить расписание команды и выбрать одну из пересекающихся задач для возможного перераспределения. Компетенции должен подтвердить руководитель.'
  const expectedEffect = suggestion && candidate
    ? `После моделируемого переноса пик ${workload.employeeName} снизится с ${suggestion.sourceBefore.peakConcurrency} до ${suggestion.sourceAfter.peakConcurrency}, а пик ${candidate.employeeName} изменится с ${candidate.before.peakConcurrency} до ${candidate.after.peakConcurrency}. Параллельная работа кандидата изменится на ${candidate.delta.parallelDays >= 0 ? '+' : ''}${candidate.delta.parallelDays} ${pluralizeRu(Math.abs(candidate.delta.parallelDays), ['день', 'дня', 'дней'])}.`
    : 'После выбора задачи Ripple сможет сравнить изменение пиков и параллельных дней до фактического переназначения.'
  return {
    id: workload.primaryFactor === 'fragmented' ? 'team-fragmented-workload' : 'team-schedule-load',
    problem: workload.primaryFactor === 'fragmented' ? 'Фрагментированная загрузка' : workload.level === 'high' ? 'Высокая плановая нагрузка' : 'Повышенная плановая нагрузка',
    evidence: `${workload.employeeName}: ${workload.reasons.join('; ').replace(/^./, (value) => value.toLowerCase())}.`,
    proposedAction,
    expectedEffect,
    affectedTaskIds: workload.peakTaskIds,
    tone: 'warning',
    action: { type: 'view-workload', label: 'Сравнить нагрузку' },
  }
}

export function buildProjectRecommendations(workspace: ProjectWorkspace, backendPreview?: ScheduleShiftPreview | null): ProjectRecommendation[] {
  const schedule = buildScheduleRecommendation(workspace, backendPreview)
  const effectivePreview = schedule
    ? previewForSource(workspace, schedule.action?.type === 'preview-shift' ? schedule.action.sourceTaskId : '', backendPreview)
    : backendPreview
  const recommendations = [
    schedule,
    buildDeadlineRecommendation(workspace, effectivePreview),
    buildCompletedConflictRecommendation(workspace),
    buildStatusRecommendation(workspace),
    buildOverdueRecommendation(workspace),
    buildWorkloadRecommendation(workspace),
  ].filter((item): item is ProjectRecommendation => Boolean(item))

  if (recommendations.length === 0) {
    return [{
      id: 'no-action-required',
      problem: 'Вмешательство не требуется',
      evidence: 'Текущий план не содержит конфликтов, просрочек или значимого давления расписания.',
      proposedAction: 'Продолжать работу по текущему плану.',
      expectedEffect: 'Даты и статусы останутся без изменений; Ripple продолжит отслеживать новые последствия.',
      affectedTaskIds: [],
      tone: 'success',
    }]
  }
  return recommendations.slice(0, 3)
}
