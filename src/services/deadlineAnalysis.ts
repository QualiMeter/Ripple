import type { ImpactReason } from '../types/impact'
import type { Dependency } from '../types/dependency'
import type { Project } from '../types/project'
import type { ProjectTask } from '../types/task'
import { calendarDaysBetween, formatFullDate, getTodayIsoDate } from '../utils/date'
import { getTaskStatusLabel } from './statusAnalysis'
import { findDownstreamTaskIds } from './dependencyGraph'

export interface TaskOverdueInfo {
  taskId: string
  deadline: string
  overdueDays: number
  downstreamTaskCount: number
}

export function analyzeTaskOverdue(
  task: ProjectTask,
  dependencies: Dependency[],
  today = getTodayIsoDate(),
): TaskOverdueInfo | null {
  if (task.status === 'completed' || today <= task.endDate) return null
  return {
    taskId: task.id,
    deadline: task.endDate,
    overdueDays: calendarDaysBetween(task.endDate, today),
    downstreamTaskCount: findDownstreamTaskIds(task.id, dependencies).length,
  }
}

export function findCurrentDeadlineIssues(
  project: Project,
  tasks: ProjectTask[],
  today = getTodayIsoDate(),
  dependencies: Dependency[] = [],
): ImpactReason[] {
  const unfinished = tasks.filter((task) => task.status !== 'completed')
  const taskIssues = unfinished
    .flatMap((task): ImpactReason[] => {
      const overdue = analyzeTaskOverdue(task, dependencies, today)
      if (!overdue) return []
      return [{
        sourceTaskId: task.id,
        affectedTaskIds: [task.id],
        severity: 'warning',
        reason: `Плановый срок задачи «${task.title}» истёк ${formatFullDate(overdue.deadline)}.`,
        consequence: `Текущий статус: «${getTaskStatusLabel(task.status)}».`,
        action: { type: 'open-task', taskId: task.id },
      }]
    })

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
