import type { CreateProjectRequest, Project, ProjectSummary, UpdateProjectRequest } from '../types/project'
import type { ProjectWorkspace } from '../types/workspace'
import { apiRequest } from './client'
import type { ProjectDetailsDto } from './backend/types'
import { mapProject, toCreateProjectDto, toUpdateProjectDto } from './backend/mappers'
import { composeHttpWorkspace, fetchProjectDetails, listHttpProjectSummaries } from './backend/workspace'

export interface ProjectsApi {
  listProjects(): Promise<ProjectSummary[]>
  createProject(request: CreateProjectRequest): Promise<Project>
  updateProject(projectId: string, request: UpdateProjectRequest): Promise<Project>
  getWorkspace(projectId: string): Promise<ProjectWorkspace>
}

export const httpProjectsApi: ProjectsApi = {
  listProjects: listHttpProjectSummaries,
  async createProject(request) {
    const dto = await apiRequest<ProjectDetailsDto>('/api/v1/projects', { method: 'POST', body: JSON.stringify(toCreateProjectDto(request)) })
    return mapProject(dto)
  },
  async updateProject(projectId, request) {
    const current = mapProject(await fetchProjectDetails(projectId))
    const dto = await apiRequest<ProjectDetailsDto>(`/api/v1/projects/${projectId}`, { method: 'PUT', body: JSON.stringify(toUpdateProjectDto(current, request)) })
    return mapProject(dto)
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
      updateProject: async (projectId, request) => {
        const { mockProjectsApi } = await import('./mockProjects.api')
        return mockProjectsApi.updateProject(projectId, request)
      },
      getWorkspace: async (projectId) => {
        const { mockProjectsApi } = await import('./mockProjects.api')
        return mockProjectsApi.getWorkspace(projectId)
      },
    }
