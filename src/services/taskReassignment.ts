import type { ProjectWorkspace } from '../types/workspace'
import type { TaskUpdateRequest } from '../types/task'
import type { EmployeeWorkload, ReassignmentSuggestion } from './teamWorkload'

export interface TaskReassignmentPreview {
  taskId: string
  taskTitle: string
  sourceEmployeeId: string
  sourceEmployeeName: string
  candidateEmployeeId: string
  candidateEmployeeName: string
  sourceBefore: EmployeeWorkload
  sourceAfter: EmployeeWorkload
  candidateBefore: EmployeeWorkload
  candidateAfter: EmployeeWorkload
}

export interface TaskReassignmentPort {
  updateTask(workspace: ProjectWorkspace, taskId: string, update: TaskUpdateRequest): Promise<ProjectWorkspace>
}

export function buildTaskReassignmentPreview(
  workspace: ProjectWorkspace,
  suggestion: ReassignmentSuggestion,
): TaskReassignmentPreview | null {
  const task = workspace.tasks.find((candidate) => candidate.id === suggestion.taskId)
  const sourceEmployee = workspace.assignees.find((employee) => employee.id === suggestion.sourceEmployeeId)
  const candidateEmployee = workspace.assignees.find((employee) => employee.id === suggestion.candidate.employeeId)
  if (!task || !sourceEmployee || !candidateEmployee || task.status === 'completed') return null
  return {
    taskId: task.id,
    taskTitle: task.title,
    sourceEmployeeId: sourceEmployee.id,
    sourceEmployeeName: sourceEmployee.name,
    candidateEmployeeId: candidateEmployee.id,
    candidateEmployeeName: candidateEmployee.name,
    sourceBefore: suggestion.sourceBefore,
    sourceAfter: suggestion.sourceAfter,
    candidateBefore: suggestion.candidate.before,
    candidateAfter: suggestion.candidate.after,
  }
}

export async function applyTaskReassignment(
  workspace: ProjectWorkspace,
  preview: TaskReassignmentPreview,
  port: TaskReassignmentPort,
): Promise<ProjectWorkspace> {
  const currentTask = workspace.tasks.find((task) => task.id === preview.taskId)
  if (!currentTask) throw new Error('Задача не найдена.')
  if (currentTask.assigneeId !== preview.sourceEmployeeId) {
    throw new Error('Ответственный задачи уже изменился. Обновите рекомендацию.')
  }
  if (!workspace.assignees.some((employee) => employee.id === preview.candidateEmployeeId)) {
    throw new Error('Предложенный сотрудник больше не доступен в проекте.')
  }
  return port.updateTask(workspace, preview.taskId, { assigneeId: preview.candidateEmployeeId })
}
