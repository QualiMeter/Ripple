import type { ProjectTask, TaskCreateRequest, TaskUpdateRequest } from '../types/task'
import { apiRequest } from './client'

export interface TasksApi {
  createTask(projectId: string, request: TaskCreateRequest): Promise<ProjectTask>
  updateTask(taskId: string, update: TaskUpdateRequest): Promise<ProjectTask>
  deleteTask(taskId: string): Promise<void>
}

const httpTasksApi: TasksApi = {
  createTask: (projectId, request) => apiRequest<ProjectTask>(`/api/projects/${projectId}/tasks`, { method: 'POST', body: JSON.stringify(request) }),
  updateTask: (taskId, update) => apiRequest<ProjectTask>(`/api/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify(update) }),
  deleteTask: (taskId) => apiRequest<void>(`/api/tasks/${taskId}`, { method: 'DELETE' }),
}

const mode = import.meta.env.VITE_API_MODE ?? 'mock'

export const tasksApi: TasksApi = mode === 'http'
  ? httpTasksApi
  : {
      createTask: async (projectId, request) => {
        const { mockTasksApi } = await import('./mockTasks.api')
        return mockTasksApi.createTask(projectId, request)
      },
      updateTask: async (taskId, update) => {
        const { mockTasksApi } = await import('./mockTasks.api')
        return mockTasksApi.updateTask(taskId, update)
      },
      deleteTask: async (taskId) => {
        const { mockTasksApi } = await import('./mockTasks.api')
        return mockTasksApi.deleteTask(taskId)
      },
    }
