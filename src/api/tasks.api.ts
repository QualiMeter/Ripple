import type { ProjectTask, TaskCreateRequest, TaskUpdateRequest } from '../types/task'
import { apiRequest } from './client'
import type { AnalysisMessageDto, TaskMutationResponse } from './backend/types'
import { mapTask, rememberPlannedDates, toCreateTaskDto, toUpdateTaskDto } from './backend/mappers'
import { setHttpProjectSession } from './backend/session'
import { composeHttpWorkspace } from './backend/workspace'
import { buildTaskUpdateChange } from '../services/changeContext'
import { findDownstreamTaskIds } from '../services/scheduleEngine'

export interface TasksApi {
  createTask(projectId: string, request: TaskCreateRequest): Promise<ProjectTask>
  updateTask(projectId: string, taskId: string, currentTask: ProjectTask, update: TaskUpdateRequest): Promise<ProjectTask>
  deleteTask(projectId: string, taskId: string): Promise<void>
}

export const httpTasksApi: TasksApi = {
  async createTask(projectId, request) {
    const before = await composeHttpWorkspace(projectId)
    const response = await apiRequest<TaskMutationResponse>(`/api/v1/projects/${projectId}/tasks`, { method: 'POST', body: JSON.stringify(toCreateTaskDto(request)) })
    rememberPlannedDates(projectId, response.task.id, response.task.startDate, response.task.endDate)
    const task = mapTask(response.task)
    setHttpProjectSession(projectId, {
      sourceTaskId: task.id, affectedTaskIds: [...new Set(response.analysis.flatMap((message) => message.affectedTaskIds))],
      lastChange: { kind: 'task-created', taskId: task.id, taskTitle: task.title }, analysis: response.analysis,
      previousProjectEndDate: before.project.projectedEndDate,
    })
    return task
  },
  async updateTask(projectId, taskId, currentTask, update) {
    const before = await composeHttpWorkspace(projectId)
    const response = await apiRequest<TaskMutationResponse>(`/api/v1/projects/${projectId}/tasks/${taskId}`, { method: 'PUT', body: JSON.stringify(toUpdateTaskDto(currentTask, update)) })
    const task = mapTask(response.task)
    setHttpProjectSession(projectId, {
      sourceTaskId: taskId, affectedTaskIds: [...new Set(response.analysis.flatMap((message) => message.affectedTaskIds))],
      lastChange: buildTaskUpdateChange(currentTask, task, update), analysis: response.analysis,
      previousProjectEndDate: before.project.projectedEndDate,
    })
    return task
  },
  async deleteTask(projectId, taskId) {
    const before = await composeHttpWorkspace(projectId)
    const task = before.tasks.find((candidate) => candidate.id === taskId)
    if (!task) throw new Error('Задача не найдена.')
    const affectedTaskIds = findDownstreamTaskIds(taskId, before.dependencies)
    const analysis = await apiRequest<AnalysisMessageDto[] | undefined>(`/api/v1/projects/${projectId}/tasks/${taskId}?confirm=true`, { method: 'DELETE' })
    setHttpProjectSession(projectId, {
      sourceTaskId: taskId, affectedTaskIds, lastChange: { kind: 'task-deleted', taskId, taskTitle: task.title },
      analysis: analysis ?? [], previousProjectEndDate: before.project.projectedEndDate,
    })
  },
}

const mode = import.meta.env.VITE_API_MODE ?? 'mock'

export const tasksApi: TasksApi = mode === 'http'
  ? httpTasksApi
  : {
      createTask: async (projectId, request) => {
        const { mockTasksApi } = await import('./mockTasks.api')
        return mockTasksApi.createTask(projectId, request)
      },
      updateTask: async (_projectId, taskId, _currentTask, update) => {
        const { mockTasksApi } = await import('./mockTasks.api')
        return mockTasksApi.updateTask(taskId, update)
      },
      deleteTask: async (_projectId, taskId) => {
        const { mockTasksApi } = await import('./mockTasks.api')
        return mockTasksApi.deleteTask(taskId)
      },
    }
