import type { ProjectTask, TaskUpdateRequest } from '../types/task'
import { apiRequest } from './client'

export interface TasksApi {
  updateTask(taskId: string, update: TaskUpdateRequest): Promise<ProjectTask>
  deleteTask(taskId: string): Promise<void>
}

export const httpTasksApi: TasksApi = {
  updateTask: (taskId, update) => apiRequest<ProjectTask>(`/api/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify(update) }),
  deleteTask: (taskId) => apiRequest<void>(`/api/tasks/${taskId}`, { method: 'DELETE' }),
}
