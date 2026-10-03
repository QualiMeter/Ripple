import { apiRequest } from './client'
import { aiPlanningRealtime } from '../realtime/aiPlanningRealtime'

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

export interface AiProgress {
  stage: string
  progress: number
  message: string
}

export interface AiApi {
  createProjectPlan(prompt: string): Promise<AiPlan>
  createProjectUpdatePlan(projectId: string, prompt: string): Promise<AiPlan>
  createProjectPlanStream(prompt: string, onProgress: (progress: AiProgress) => void): Promise<AiPlan>
  createProjectUpdatePlanStream(projectId: string, prompt: string, onProgress: (progress: AiProgress) => void): Promise<AiPlan>
  getPlan(planId: string): Promise<AiPlan>
  confirmPlan(planId: string, projectId?: string): Promise<AiPlan>
}


function normalizeAiPlan(value: unknown): AiPlan {
  const root = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const source = root.data && typeof root.data === 'object' ? root.data as Record<string, unknown>
    : root.result && typeof root.result === 'object' ? root.result as Record<string, unknown>
    : root
  const changesValue = source.changes ?? source.Changes
  const changes = Array.isArray(changesValue) ? changesValue.map((change) => {
    const item = change && typeof change === 'object' ? change as Record<string, unknown> : {}
    return {
      action: String(item.action ?? item.Action ?? ''),
      entityType: String(item.entityType ?? item.EntityType ?? ''),
      entityId: item.entityId == null && item.EntityId == null ? null : String(item.entityId ?? item.EntityId),
      label: String(item.label ?? item.Label ?? ''),
      field: item.field == null && item.Field == null ? null : String(item.field ?? item.Field),
      before: item.before == null && item.Before == null ? null : String(item.before ?? item.Before),
      after: item.after == null && item.After == null ? null : String(item.after ?? item.After),
    }
  }) : []

  return {
    planId: String(source.planId ?? source.PlanId ?? ''),
    projectId: source.projectId == null && source.ProjectId == null
      ? null
      : String(source.projectId ?? source.ProjectId),
    operationType: String(source.operationType ?? source.OperationType ?? ''),
    status: String(source.status ?? source.Status ?? 'Pending'),
    summary: String(source.summary ?? source.Summary ?? ''),
    changes,
    createdAt: String(source.createdAt ?? source.CreatedAt ?? ''),
    confirmedAt: source.confirmedAt == null && source.ConfirmedAt == null
      ? null
      : String(source.confirmedAt ?? source.ConfirmedAt),
  }
}


export const httpAiApi: AiApi = {
  createProjectPlan(prompt) {
    return apiRequest<unknown>('/v1/ai/projects/plan', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    }).then(normalizeAiPlan)
  },
  createProjectUpdatePlan(projectId, prompt) {
    return apiRequest<unknown>(`/v1/projects/${projectId}/ai/plan`, {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    }).then(normalizeAiPlan)
  },
  createProjectPlanStream(prompt, onProgress) {
    return aiPlanningRealtime.createProjectPlan(prompt, onProgress)
  },
  createProjectUpdatePlanStream(projectId, prompt, onProgress) {
    return aiPlanningRealtime.createProjectUpdatePlan(projectId, prompt, onProgress)
  },
  getPlan(planId) {
    return apiRequest<unknown>(`/v1/ai/plans/${planId}`).then(normalizeAiPlan)
  },
  confirmPlan(planId, projectId) {
    const path = projectId
      ? `/v1/projects/${projectId}/ai/plan/${planId}/confirm`
      : `/v1/ai/plans/${planId}/confirm`
    return apiRequest<unknown>(path, { method: 'POST' }).then(normalizeAiPlan)
  },
}

export const aiApi: AiApi = httpAiApi
