import type { ProjectWorkspace } from '../types/workspace'
import { projectsApi } from '../api/projects.api'
import { tasksApi } from '../api/tasks.api'
import { dependenciesApi } from '../api/dependencies.api'
import { scheduleApi } from '../api/schedule.api'
import type { CreateDependencyRequest } from '../types/dependency'
import type { TaskCreateRequest, TaskUpdateRequest } from '../types/task'
import type { ScheduleShiftPreview } from '../types/schedule'

export interface ProjectService {
  getWorkspace(projectId: string): Promise<ProjectWorkspace>
  updateTask(projectId: string, taskId: string, update: TaskUpdateRequest): Promise<ProjectWorkspace>
  createTask(projectId: string, request: TaskCreateRequest): Promise<ProjectWorkspace>
  deleteTask(projectId: string, taskId: string): Promise<ProjectWorkspace>
  createDependency(projectId: string, request: CreateDependencyRequest): Promise<ProjectWorkspace>
  deleteDependency(projectId: string, dependencyId: string): Promise<ProjectWorkspace>
  previewScheduleShift(projectId: string): Promise<ScheduleShiftPreview>
  applyScheduleShift(projectId: string, preview: ScheduleShiftPreview): Promise<ProjectWorkspace>
}

export const projectService: ProjectService = {
  getWorkspace: (projectId) => projectsApi.getWorkspace(projectId),
  async updateTask(projectId, taskId, update) {
    await tasksApi.updateTask(taskId, update)
    return projectsApi.getWorkspace(projectId)
  },
  async createTask(projectId, request) {
    await tasksApi.createTask(projectId, request)
    return projectsApi.getWorkspace(projectId)
  },
  async deleteTask(projectId, taskId) {
    await tasksApi.deleteTask(taskId)
    return projectsApi.getWorkspace(projectId)
  },
  async createDependency(projectId, request) {
    await dependenciesApi.createDependency(projectId, request)
    return projectsApi.getWorkspace(projectId)
  },
  async deleteDependency(projectId, dependencyId) {
    await dependenciesApi.deleteDependency(dependencyId)
    return projectsApi.getWorkspace(projectId)
  },
  previewScheduleShift: (projectId) => scheduleApi.previewShift(projectId),
  async applyScheduleShift(projectId, preview) {
    await scheduleApi.applyShift(projectId, preview)
    return projectsApi.getWorkspace(projectId)
  },
}
