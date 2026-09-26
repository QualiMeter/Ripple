import type { ProjectWorkspace } from '../types/workspace'
import { projectsApi } from '../api/projects.api'
import { tasksApi } from '../api/tasks.api'
import { dependenciesApi } from '../api/dependencies.api'
import { scheduleApi } from '../api/schedule.api'
import type { CreateDependencyRequest } from '../types/dependency'
import type { TaskCreateRequest, TaskUpdateRequest } from '../types/task'
import type { ScheduleShiftPreview } from '../types/schedule'
import type { CreateProjectRequest, Project, ProjectSummary, UpdateProjectRequest } from '../types/project'
import { validateProjectInput } from './projectValidation'

export interface ProjectService {
  listProjects(): Promise<ProjectSummary[]>
  createProject(request: CreateProjectRequest): Promise<Project>
  updateProject(projectId: string, request: UpdateProjectRequest): Promise<ProjectWorkspace>
  getWorkspace(projectId: string): Promise<ProjectWorkspace>
  updateTask(projectId: string, taskId: string, update: TaskUpdateRequest): Promise<ProjectWorkspace>
  createTask(projectId: string, request: TaskCreateRequest): Promise<ProjectWorkspace>
  deleteTask(projectId: string, taskId: string): Promise<ProjectWorkspace>
  createDependency(projectId: string, request: CreateDependencyRequest): Promise<ProjectWorkspace>
  deleteDependency(projectId: string, dependencyId: string): Promise<ProjectWorkspace>
  previewScheduleShift(projectId: string, sourceTaskId: string): Promise<ScheduleShiftPreview>
  applyScheduleShift(projectId: string, preview: ScheduleShiftPreview): Promise<ProjectWorkspace>
}

export const projectService: ProjectService = {
  listProjects: () => projectsApi.listProjects(),
  async createProject(request) {
    validateProjectInput(request)
    return projectsApi.createProject({ ...request, name: request.name.trim() })
  },
  async updateProject(projectId, request) {
    const current = await projectsApi.getWorkspace(projectId)
    validateProjectInput({
      name: request.name ?? current.project.name,
      startDate: request.startDate ?? current.project.startDate,
      targetEndDate: request.targetEndDate ?? current.project.targetEndDate,
    })
    await projectsApi.updateProject(projectId, request)
    return projectsApi.getWorkspace(projectId)
  },
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
  previewScheduleShift: (projectId, sourceTaskId) => scheduleApi.previewShift(projectId, { sourceTaskId }),
  async applyScheduleShift(projectId, preview) {
    await scheduleApi.applyShift(projectId, preview)
    return projectsApi.getWorkspace(projectId)
  },
}
