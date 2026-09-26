import type { ImpactAnalysis, RecoveryScenario } from '../types/impact'
import { apiRequest } from './client'

export interface ImpactApi {
  analyze(projectId: string): Promise<ImpactAnalysis>
  getRecoveryScenarios(projectId: string): Promise<RecoveryScenario[]>
}

export const httpImpactApi: ImpactApi = {
  analyze: (projectId) => apiRequest<ImpactAnalysis>(`/api/projects/${projectId}/impact/analyze`, { method: 'POST' }),
  getRecoveryScenarios: (projectId) => apiRequest<RecoveryScenario[]>(`/api/projects/${projectId}/recovery-scenarios`),
}
