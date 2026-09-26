import type { Project, ProjectBoundaryIssue } from '../types/project'
import type { ProjectTask } from '../types/task'
import { formatShortDate } from '../utils/date'

export function analyzeProjectBoundaries(project: Project, tasks: ProjectTask[]): ProjectBoundaryIssue[] {
  return tasks.flatMap((task): ProjectBoundaryIssue[] => {
    const reasons: string[] = []
    if (task.startDate < project.startDate) {
      reasons.push(`начинается ${formatShortDate(task.startDate)}, проект начинается ${formatShortDate(project.startDate)}`)
    }
    if (task.endDate > project.targetEndDate) {
      reasons.push(`завершается ${formatShortDate(task.endDate)}, проект заканчивается ${formatShortDate(project.targetEndDate)}`)
    }
    return reasons.length > 0 ? [{ taskId: task.id, taskTitle: task.title, reasons }] : []
  })
}
