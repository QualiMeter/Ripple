import type { CurrentProjectIssues, ImpactAnalysis, ImpactReason } from '../types/impact'
import type { Project, ProjectSummary } from '../types/project'
import type { ProjectTask } from '../types/task'
import { getTodayIsoDate } from '../utils/date'

export type CurrentIssueCategory = 'schedule' | 'status' | 'deadline'

export interface RelatedCurrentIssue {
  category: CurrentIssueCategory
  reason: ImpactReason
}

export function listCurrentIssues(currentIssues: CurrentProjectIssues): ImpactReason[] {
  return [
    ...currentIssues.scheduleConflicts,
    ...currentIssues.statusConflicts,
    ...currentIssues.deadlineIssues,
  ]
}

export function getCurrentIssueCount(currentIssues: CurrentProjectIssues): number {
  return listCurrentIssues(currentIssues).length
}

export function getTaskCurrentIssues(
  currentIssues: CurrentProjectIssues,
  taskId: string,
): RelatedCurrentIssue[] {
  const related = (category: CurrentIssueCategory, reasons: ImpactReason[]) => reasons
    .filter((reason) => reason.sourceTaskId === taskId || reason.affectedTaskIds.includes(taskId))
    .map((reason) => ({ category, reason }))
  return [
    ...related('status', currentIssues.statusConflicts),
    ...related('schedule', currentIssues.scheduleConflicts),
    ...related('deadline', currentIssues.deadlineIssues),
  ].sort((left, right) => {
    const priority = { error: 3, warning: 2, info: 1 }
    return priority[right.reason.severity] - priority[left.reason.severity]
  })
}

export function getCurrentIssueLabel(issue: RelatedCurrentIssue): string {
  if (issue.category === 'status') {
    return issue.reason.severity === 'error' ? 'Ошибка состояния' : 'Конфликт состояния'
  }
  if (issue.category === 'schedule') return 'Конфликт расписания'
  return 'Срок просрочен'
}

export function hasActionableCurrentIssues(currentIssues: CurrentProjectIssues): boolean {
  return listCurrentIssues(currentIssues).some((reason) => reason.severity === 'warning' || reason.severity === 'error')
}

export function includeCurrentIssuesInImpact(
  impact: ImpactAnalysis,
  currentIssues: CurrentProjectIssues,
): ImpactAnalysis {
  return {
    ...impact,
    requiresIntervention: impact.requiresIntervention || hasActionableCurrentIssues(currentIssues),
  }
}

export function deriveProjectHealth(
  project: Project,
  tasks: ProjectTask[],
  currentIssues: CurrentProjectIssues,
  atRiskTaskIds: string[],
  projectedEndDate: string,
  today = getTodayIsoDate(),
): ProjectSummary['health'] {
  if (today > project.targetEndDate && tasks.some((task) => task.status !== 'completed')) return 'off-track'
  if (
    getCurrentIssueCount(currentIssues) > 0
    || atRiskTaskIds.length > 0
    || projectedEndDate > project.targetEndDate
  ) return 'at-risk'
  return 'on-track'
}
