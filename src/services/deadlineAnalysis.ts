import type { ImpactReason } from '../types/impact'
import type { Project } from '../types/project'
import type { ProjectTask } from '../types/task'
import { formatFullDate, getTodayIsoDate } from '../utils/date'
import { getTaskStatusLabel } from './statusAnalysis'

export function findCurrentDeadlineIssues(
  project: Project,
  tasks: ProjectTask[],
  today = getTodayIsoDate(),
): ImpactReason[] {
  const unfinished = tasks.filter((task) => task.status !== 'completed')
  const taskIssues = unfinished
    .filter((task) => task.endDate < today)
    .map((task): ImpactReason => ({
      sourceTaskId: task.id,
      affectedTaskIds: [task.id],
      severity: 'warning',
      reason: `Плановый срок задачи «${task.title}» истёк ${formatFullDate(task.endDate)}.`,
      consequence: `Текущий статус: «${getTaskStatusLabel(task.status)}».`,
      action: { type: 'open-task', taskId: task.id },
    }))

  if (project.targetEndDate >= today || unfinished.length === 0) return taskIssues
  return [...taskIssues, {
    sourceTaskId: project.id,
    affectedTaskIds: unfinished.map((task) => task.id),
    severity: 'warning',
    reason: `Плановый срок проекта истёк ${formatFullDate(project.targetEndDate)}. Незавершённых задач: ${unfinished.length}.`,
    consequence: 'Проверьте актуальные сроки и статусы незавершённых задач.',
    action: { type: 'open-task', taskId: unfinished[0].id },
  }]
}
