import type { ImpactAnalysis, RecoveryScenario } from '../types/impact'
import { apiRequest } from './client'

export interface ImpactApi {
  recalculate(projectId: string): Promise<ImpactAnalysis>
  getRecoveryScenarios(projectId: string): Promise<RecoveryScenario[]>
}

export const httpImpactApi: ImpactApi = {
  recalculate: (projectId) => apiRequest<ImpactAnalysis>(`/api/projects/${projectId}/recalculate`, { method: 'POST' }),
  getRecoveryScenarios: (projectId) => apiRequest<RecoveryScenario[]>(`/api/projects/${projectId}/recovery-scenarios`),
}
