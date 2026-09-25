import type { ProjectTask, TaskUpdateRequest } from '../types/task'
import { apiRequest } from './client'

export interface TasksApi {
  updateTask(taskId: string, update: TaskUpdateRequest): Promise<ProjectTask>
  deleteTask(taskId: string): Promise<void>
}

const httpTasksApi: TasksApi = {
  updateTask: (taskId, update) => apiRequest<ProjectTask>(`/api/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify(update) }),
  deleteTask: (taskId) => apiRequest<void>(`/api/tasks/${taskId}`, { method: 'DELETE' }),
}

const mode = import.meta.env.VITE_API_MODE ?? 'mock'

export const tasksApi: TasksApi = mode === 'http'
  ? httpTasksApi
  : {
      updateTask: async (taskId, update) => {
        const { mockTasksApi } = await import('./mockTasks.api')
        return mockTasksApi.updateTask(taskId, update)
      },
      deleteTask: async (taskId) => {
        const { mockTasksApi } = await import('./mockTasks.api')
        return mockTasksApi.deleteTask(taskId)
      },
    }
