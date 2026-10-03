import { HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr'
import { realtimeUrl } from '../config/api'
import type { AiPlan, AiProgress } from '../api/ai.api'

export type AiProgressHandler = (progress: AiProgress) => void

function normalizeProgress(value: unknown): AiProgress {
  const item = (value ?? {}) as Record<string, unknown>
  return {
    stage: String(item.stage ?? item.Stage ?? 'generating'),
    progress: Number(item.progress ?? item.Progress ?? 0),
    message: String(item.message ?? item.Message ?? 'ИИ генерирует план'),
    text: typeof (item.text ?? item.Text) === 'string' ? String(item.text ?? item.Text) : null,
  }
}

function normalizePlan(value: unknown): AiPlan {
  const item = (value ?? {}) as Record<string, unknown>
  const rawChanges = Array.isArray(item.changes ?? item.Changes) ? (item.changes ?? item.Changes) : []
  return {
    planId: String(item.planId ?? item.PlanId ?? ''),
    projectId: item.projectId ?? item.ProjectId ? String(item.projectId ?? item.ProjectId) : null,
    operationType: String(item.operationType ?? item.OperationType ?? ''),
    status: String(item.status ?? item.Status ?? 'Pending'),
    summary: String(item.summary ?? item.Summary ?? ''),
    changes: rawChanges.map((raw) => {
      const change = raw as Record<string, unknown>
      return {
        action: String(change.action ?? change.Action ?? ''),
        entityType: String(change.entityType ?? change.EntityType ?? ''),
        entityId: change.entityId ?? change.EntityId ? String(change.entityId ?? change.EntityId) : null,
        label: String(change.label ?? change.Label ?? ''),
        field: change.field ?? change.Field ? String(change.field ?? change.Field) : null,
        before: change.before ?? change.Before ? String(change.before ?? change.Before) : null,
        after: change.after ?? change.After ? String(change.after ?? change.After) : null,
      }
    }),
    createdAt: String(item.createdAt ?? item.CreatedAt ?? ''),
    confirmedAt: item.confirmedAt ?? item.ConfirmedAt ? String(item.confirmedAt ?? item.ConfirmedAt) : null,
  }
}

async function invokePlan(method: string, args: unknown[], onProgress: AiProgressHandler): Promise<AiPlan> {
  const connection = new HubConnectionBuilder()
    .withUrl(realtimeUrl('/hubs/ai-planning'))
    .withAutomaticReconnect()
    .configureLogging(LogLevel.Warning)
    .build()

  connection.on('aiPlanProgress', (value: unknown) => onProgress(normalizeProgress(value)))

  try {
    await connection.start()
    const result = await connection.invoke<unknown>(method, ...args)
    const plan = normalizePlan(result)
    if (!plan.planId) throw new Error('Backend returned an AI plan without planId.')
    return plan
  } finally {
    if (connection.state !== HubConnectionState.Disconnected) {
      await connection.stop()
    }
  }
}

export const aiPlanningRealtime = {
  createProjectPlan(prompt: string, onProgress: AiProgressHandler) {
    return invokePlan('CreateProjectPlan', [prompt], onProgress)
  },
  createProjectUpdatePlan(projectId: string, prompt: string, onProgress: AiProgressHandler) {
    return invokePlan('CreateProjectUpdatePlan', [projectId, prompt], onProgress)
  },
}
