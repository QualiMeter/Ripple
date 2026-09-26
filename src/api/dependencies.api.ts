import type { CreateDependencyRequest, Dependency } from '../types/dependency'
import { apiRequest } from './client'
import type { AnalysisMessageDto, DependencyMutationResponse } from './backend/types'
import { dependencyDeletePath, mapDependency } from './backend/mappers'
import { setHttpProjectSession } from './backend/session'
import { composeHttpWorkspace } from './backend/workspace'

export interface DependenciesApi {
  createDependency(projectId: string, request: CreateDependencyRequest): Promise<Dependency>
  deleteDependency(projectId: string, dependency: Dependency): Promise<void>
}

export const httpDependenciesApi: DependenciesApi = {
  async createDependency(projectId, request) {
    const before = await composeHttpWorkspace(projectId)
    const response = await apiRequest<DependencyMutationResponse>(`/api/v1/projects/${projectId}/dependencies`, {
      method: 'POST', body: JSON.stringify({ predecessorTaskId: request.predecessorTaskId, successorTaskId: request.successorTaskId }),
    })
    const dependency = mapDependency(response.dependency)
    setHttpProjectSession(projectId, {
      sourceTaskId: dependency.predecessorTaskId,
      affectedTaskIds: [...new Set(response.analysis.flatMap((message) => message.affectedTaskIds))],
      lastChange: { kind: 'dependency-created', dependencyId: dependency.id, predecessorTaskId: dependency.predecessorTaskId, successorTaskId: dependency.successorTaskId },
      analysis: response.analysis, previousProjectEndDate: before.project.projectedEndDate,
    })
    return dependency
  },
  async deleteDependency(projectId, dependency) {
    const before = await composeHttpWorkspace(projectId)
    const analysis = await apiRequest<AnalysisMessageDto[]>(dependencyDeletePath(projectId, dependency), { method: 'DELETE' })
    setHttpProjectSession(projectId, {
      sourceTaskId: dependency.predecessorTaskId,
      affectedTaskIds: [...new Set((analysis ?? []).flatMap((message) => message.affectedTaskIds))],
      lastChange: { kind: 'dependency-deleted', dependencyId: dependency.id, predecessorTaskId: dependency.predecessorTaskId, successorTaskId: dependency.successorTaskId },
      analysis: analysis ?? [], previousProjectEndDate: before.project.projectedEndDate,
    })
  },
}

const mode = import.meta.env.VITE_API_MODE ?? 'mock'

export const dependenciesApi: DependenciesApi = mode === 'http'
  ? httpDependenciesApi
  : {
      createDependency: async (projectId, request) => {
        const { mockDependenciesApi } = await import('./mockDependencies.api')
        return mockDependenciesApi.createDependency(projectId, request)
      },
      deleteDependency: async (_projectId, dependency) => {
        const { mockDependenciesApi } = await import('./mockDependencies.api')
        return mockDependenciesApi.deleteDependency(dependency.id)
      },
    }
