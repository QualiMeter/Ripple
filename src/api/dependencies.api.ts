import type { CreateDependencyRequest, Dependency } from '../types/dependency'
import { apiRequest } from './client'

export interface DependenciesApi {
  createDependency(projectId: string, request: CreateDependencyRequest): Promise<Dependency>
  deleteDependency(dependencyId: string): Promise<void>
}

const httpDependenciesApi: DependenciesApi = {
  createDependency: (projectId, request) => apiRequest<Dependency>(`/api/projects/${projectId}/dependencies`, {
    method: 'POST',
    body: JSON.stringify(request),
  }),
  deleteDependency: (dependencyId) => apiRequest<void>(`/api/dependencies/${dependencyId}`, { method: 'DELETE' }),
}

const mode = import.meta.env.VITE_API_MODE ?? 'mock'

export const dependenciesApi: DependenciesApi = mode === 'http'
  ? httpDependenciesApi
  : {
      createDependency: async (projectId, request) => {
        const { mockDependenciesApi } = await import('./mockDependencies.api')
        return mockDependenciesApi.createDependency(projectId, request)
      },
      deleteDependency: async (dependencyId) => {
        const { mockDependenciesApi } = await import('./mockDependencies.api')
        return mockDependenciesApi.deleteDependency(dependencyId)
      },
    }
