import type { CreateProjectRequest, Project, ProjectSummary, UpdateProjectRequest } from '../types/project'
import type { ProjectWorkspace } from '../types/workspace'
import { apiRequest } from './client'

export interface ProjectsApi {
  listProjects(): Promise<ProjectSummary[]>
  createProject(request: CreateProjectRequest): Promise<Project>
  updateProject(projectId: string, request: UpdateProjectRequest): Promise<Project>
  getWorkspace(projectId: string): Promise<ProjectWorkspace>
}

const httpProjectsApi: ProjectsApi = {
  listProjects: () => apiRequest<ProjectSummary[]>('/api/projects'),
  createProject: (request) => apiRequest<Project>('/api/projects', { method: 'POST', body: JSON.stringify(request) }),
  updateProject: (projectId, request) => apiRequest<Project>(`/api/projects/${projectId}`, { method: 'PATCH', body: JSON.stringify(request) }),
  getWorkspace: (projectId) => apiRequest<ProjectWorkspace>(`/api/projects/${projectId}/workspace`),
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
