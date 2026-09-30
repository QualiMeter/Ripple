import type { CreateDependencyRequest, Dependency } from '../types/dependency'
import type { DependencyMutationResult } from '../types/mutation'
import { apiRequest } from './client'
import type { AnalysisMessageDto, DependencyMutationResponse } from './backend/types'
import { dependencyDeletePath, mapAnalysisMessage, mapDependency } from './backend/mappers'
import type { ImpactReason } from '../types/impact'

export interface DependenciesApi {
  listDependencies(projectId: string): Promise<Dependency[]>
  createDependency(projectId: string, request: CreateDependencyRequest): Promise<DependencyMutationResult>
  deleteDependency(projectId: string, dependency: Dependency): Promise<ImpactReason[]>
}

export const httpDependenciesApi: DependenciesApi = {
  async listDependencies(projectId) {
    return (await apiRequest<import('./backend/types').DependencyDto[]>(`/v1/projects/${projectId}/dependencies`)).map(mapDependency)
  },
  async createDependency(projectId, request) {
    const response = await apiRequest<DependencyMutationResponse>(`/v1/projects/${projectId}/dependencies`, {
      method: 'POST', body: JSON.stringify({ predecessorTaskId: request.predecessorTaskId, successorTaskId: request.successorTaskId }),
    })
    const dependency = mapDependency(response.dependency)
    return { dependency, analysis: response.analysis.map(mapAnalysisMessage) }
  },
  async deleteDependency(projectId, dependency) {
    const analysis = await apiRequest<AnalysisMessageDto[]>(dependencyDeletePath(projectId, dependency), { method: 'DELETE' })
    return (analysis ?? []).map(mapAnalysisMessage)
  },
}

const mode = import.meta.env.VITE_API_MODE ?? 'mock'

export const dependenciesApi: DependenciesApi = mode === 'http'
  ? httpDependenciesApi
  : {
      listDependencies: async (projectId) => {
        const { getMockProjectState } = await import('../mocks/workspaceStore')
        return getMockProjectState(projectId).dependencies
      },
      createDependency: async (projectId, request) => {
        const { mockDependenciesApi } = await import('./mockDependencies.api')
        return { dependency: await mockDependenciesApi.createDependency(projectId, request), analysis: [] }
      },
      deleteDependency: async (_projectId, dependency) => {
        const { mockDependenciesApi } = await import('./mockDependencies.api')
        await mockDependenciesApi.deleteDependency(dependency.id)
        return []
      },
    }
