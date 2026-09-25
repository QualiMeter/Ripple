import type { ProjectWorkspace } from '../types/workspace'
import { apiRequest } from './client'

export interface ProjectsApi {
  getWorkspace(projectId: string): Promise<ProjectWorkspace>
}

const httpProjectsApi: ProjectsApi = {
  getWorkspace: (projectId) => apiRequest<ProjectWorkspace>(`/api/projects/${projectId}/workspace`),
}

const mode = import.meta.env.VITE_API_MODE ?? 'mock'

export const projectsApi: ProjectsApi = mode === 'http'
  ? httpProjectsApi
  : {
      getWorkspace: async (projectId) => {
        const { mockProjectsApi } = await import('./mockProjects.api')
        return mockProjectsApi.getWorkspace(projectId)
      },
    }
