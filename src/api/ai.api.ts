import { apiRequest } from './client'

export interface AiPlanChange {
  action: string
  entityType: string
  entityId: string | null
  label: string
  field: string | null
  before: string | null
  after: string | null
}

export interface AiPlan {
  planId: string
  projectId: string | null
  operationType: 'create_project' | 'update_project' | string
  status: 'Pending' | 'Confirmed' | string
  summary: string
  changes: AiPlanChange[]
  createdAt: string
  confirmedAt: string | null
}

export interface AiApi {
  createProjectPlan(prompt: string): Promise<AiPlan>
  createProjectUpdatePlan(projectId: string, prompt: string): Promise<AiPlan>
  getPlan(planId: string): Promise<AiPlan>
  confirmPlan(planId: string, projectId?: string): Promise<AiPlan>
}

export const httpAiApi: AiApi = {
  createProjectPlan(prompt) {
    return apiRequest<AiPlan>('/v1/ai/projects/plan', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    })
  },
  createProjectUpdatePlan(projectId, prompt) {
    return apiRequest<AiPlan>(`/v1/projects/${projectId}/ai/plan`, {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    })
  },
  getPlan(planId) {
    return apiRequest<AiPlan>(`/v1/ai/plans/${planId}`)
  },
  confirmPlan(planId, projectId) {
    const path = projectId
      ? `/v1/projects/${projectId}/ai/plan/${planId}/confirm`
      : `/v1/ai/plans/${planId}/confirm`
    return apiRequest<AiPlan>(path, { method: 'POST' })
  },
}

export const aiApi: AiApi = httpAiApi
