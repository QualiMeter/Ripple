import type { ProjectTask, TaskCreateRequest, TaskUpdateRequest } from '../types/task'
import type { ImpactReason } from '../types/impact'
import type { TaskMutationResult } from '../types/mutation'
import { apiRequest } from './client'
import type { AnalysisMessageDto, TaskMutationResponse } from './backend/types'
import { mapAnalysisMessage, mapTask, rememberPlannedDates, toCreateTaskDto, toUpdateTaskDto } from './backend/mappers'

export interface TasksApi {
  getTask(projectId: string, taskId: string): Promise<ProjectTask>
  createTask(projectId: string, request: TaskCreateRequest): Promise<TaskMutationResult>
  updateTask(projectId: string, taskId: string, currentTask: ProjectTask, update: TaskUpdateRequest): Promise<TaskMutationResult>
  deleteTask(projectId: string, taskId: string): Promise<ImpactReason[]>
}

export const httpTasksApi: TasksApi = {
  async getTask(projectId, taskId) {
    return mapTask(await apiRequest<import('./backend/types').TaskDetailsDto>(`/api/v1/projects/${projectId}/tasks/${taskId}`))
  },
  async createTask(projectId, request) {
    const response = await apiRequest<TaskMutationResponse>(`/api/v1/projects/${projectId}/tasks`, { method: 'POST', body: JSON.stringify(toCreateTaskDto(request)) })
    rememberPlannedDates(projectId, response.task.id, response.task.startDate, response.task.endDate)
    const task = mapTask(response.task)
    return { task, analysis: response.analysis.map(mapAnalysisMessage) }
  },
  async updateTask(projectId, taskId, currentTask, update) {
    const response = await apiRequest<TaskMutationResponse>(`/api/v1/projects/${projectId}/tasks/${taskId}`, { method: 'PUT', body: JSON.stringify(toUpdateTaskDto(currentTask, update)) })
    const task = mapTask(response.task)
    return { task, analysis: response.analysis.map(mapAnalysisMessage) }
  },
  async deleteTask(projectId, taskId) {
    const analysis = await apiRequest<AnalysisMessageDto[] | undefined>(`/api/v1/projects/${projectId}/tasks/${taskId}?confirm=true`, { method: 'DELETE' })
    return (analysis ?? []).map(mapAnalysisMessage)
  },
}

const mode = import.meta.env.VITE_API_MODE ?? 'mock'

export const tasksApi: TasksApi = mode === 'http'
  ? httpTasksApi
  : {
      getTask: async (_projectId, taskId) => {
        const task = (await import('../mocks/workspaceStore')).getMockProjectState(_projectId).tasks.find((candidate) => candidate.id === taskId)
        if (!task) throw new Error('Задача не найдена.')
        return task
      },
      createTask: async (projectId, request) => {
        const { mockTasksApi } = await import('./mockTasks.api')
        return { task: await mockTasksApi.createTask(projectId, request), analysis: [] }
      },
      updateTask: async (_projectId, taskId, _currentTask, update) => {
        const { mockTasksApi } = await import('./mockTasks.api')
        return { task: await mockTasksApi.updateTask(taskId, update), analysis: [] }
      },
      deleteTask: async (_projectId, taskId) => {
        const { mockTasksApi } = await import('./mockTasks.api')
        await mockTasksApi.deleteTask(taskId)
        return []
      },
    }
