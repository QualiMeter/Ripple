import type { CreateProjectRequest, Project, ProjectNavigationItem, UpdateProjectRequest } from '../types/project'
import type { ProjectWorkspace } from '../types/workspace'
import { apiRequest } from './client'
import type { ProjectDetailsDto } from './backend/types'
import { mapProject, toCreateProjectDto, toUpdateProjectDto } from './backend/mappers'
import { composeHttpWorkspace, listHttpProjectNavigationItems } from './backend/workspace'
import { clearHttpProjectSession } from './backend/session'

export interface ProjectsApi {
  listProjects(): Promise<ProjectNavigationItem[]>
  createProject(request: CreateProjectRequest): Promise<Project>
  updateProject(projectId: string, current: Project, request: UpdateProjectRequest): Promise<Project>
  deleteProject(projectId: string): Promise<void>
  getWorkspace(projectId: string): Promise<ProjectWorkspace>
}

export const httpProjectsApi: ProjectsApi = {
  listProjects: listHttpProjectNavigationItems,
  async createProject(request) {
    const dto = await apiRequest<ProjectDetailsDto>('/api/v1/projects', { method: 'POST', body: JSON.stringify(toCreateProjectDto(request)) })
    return mapProject(dto)
  },
  async updateProject(projectId, current, request) {
    const dto = await apiRequest<ProjectDetailsDto>(`/api/v1/projects/${projectId}`, { method: 'PUT', body: JSON.stringify(toUpdateProjectDto(current, request)) })
    return mapProject(dto)
  },
  async deleteProject(projectId) {
    await apiRequest<void>(`/api/v1/projects/${projectId}`, { method: 'DELETE' })
    clearHttpProjectSession(projectId)
  },
  getWorkspace: composeHttpWorkspace,
}

const mode = import.meta.env.VITE_API_MODE ?? 'mock'

export const projectsApi: ProjectsApi = mode === 'http'
  ? httpProjectsApi
  : {
      listProjects: async () => {
        const { mockProjectsApi } = await import('./mockProjects.api')
        return mockProjectsApi.listProjects()
      },
      createProject: async (request) => {
        const { mockProjectsApi } = await import('./mockProjects.api')
        return mockProjectsApi.createProject(request)
      },
      updateProject: async (projectId, current, request) => {
        const { mockProjectsApi } = await import('./mockProjects.api')
        return mockProjectsApi.updateProject(projectId, current, request)
      },
      deleteProject: async (projectId) => {
        const { mockProjectsApi } = await import('./mockProjects.api')
        return mockProjectsApi.deleteProject(projectId)
      },
      getWorkspace: async (projectId) => {
        const { mockProjectsApi } = await import('./mockProjects.api')
        return mockProjectsApi.getWorkspace(projectId)
      },
    }
