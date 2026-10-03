import { HubConnectionBuilder, HubConnectionState, type HubConnection } from '@microsoft/signalr'
import { realtimeUrl } from '../config/api'
import type { AiPlan, AiProgress } from '../api/ai.api'

export type AiPlanProgressHandler = (progress: AiProgress) => void

export class AiPlanningRealtime {
  private connection: HubConnection | null = null

  private getConnection(): HubConnection {
    if (this.connection) return this.connection
    this.connection = new HubConnectionBuilder()
      .withUrl(realtimeUrl('/hubs/ai-planning'))
      .withAutomaticReconnect()
      .build()
    return this.connection
  }

  private async ensureConnected(): Promise<HubConnection> {
    const connection = this.getConnection()
    if (connection.state === HubConnectionState.Disconnected) {
      await connection.start()
    }
    return connection
  }

  async createProjectPlan(prompt: string, onProgress: AiPlanProgressHandler): Promise<AiPlan> {
    return this.invoke('CreateProjectPlan', [prompt], onProgress)
  }

  async createProjectUpdatePlan(projectId: string, prompt: string, onProgress: AiPlanProgressHandler): Promise<AiPlan> {
    return this.invoke('CreateProjectUpdatePlan', [projectId, prompt], onProgress)
  }

  async stop(): Promise<void> {
    if (this.connection && this.connection.state !== HubConnectionState.Disconnected) {
      await this.connection.stop()
    }
  }

  private async invoke(method: string, args: unknown[], onProgress: AiPlanProgressHandler): Promise<AiPlan> {
    const connection = await this.ensureConnected()
    const progressHandler = (value: unknown) => {
      const progress = normalizeProgress(value)
      if (progress) onProgress(progress)
    }
    connection.on('aiPlanProgress', progressHandler)
    try {
      const value = await connection.invoke<unknown>(method, ...args)
      const plan = normalizePlan(value)
      if (!plan.planId) throw new Error('SignalR завершил генерацию без planId.')
      return plan
    } finally {
      connection.off('aiPlanProgress', progressHandler)
    }
  }
}

function normalizeProgress(value: unknown): AiProgress | null {
  if (!value || typeof value !== 'object') return null
  const source = value as Record<string, unknown>
  return {
    stage: String(source.stage ?? source.Stage ?? 'progress'),
    progress: Number(source.progress ?? source.Progress ?? 0),
    message: String(source.message ?? source.Message ?? ''),
  }
}

function normalizePlan(value: unknown): AiPlan {
  const root = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const source = root.data && typeof root.data === 'object' ? root.data as Record<string, unknown>
    : root.result && typeof root.result === 'object' ? root.result as Record<string, unknown>
    : root
  const rawChanges = source.changes ?? source.Changes
  const changes = Array.isArray(rawChanges) ? rawChanges.map(normalizeChange) : []
  return {
    planId: String(source.planId ?? source.PlanId ?? ''),
    projectId: source.projectId == null && source.ProjectId == null ? null : String(source.projectId ?? source.ProjectId),
    operationType: String(source.operationType ?? source.OperationType ?? ''),
    status: String(source.status ?? source.Status ?? 'Pending'),
    summary: String(source.summary ?? source.Summary ?? ''),
    changes,
    createdAt: String(source.createdAt ?? source.CreatedAt ?? ''),
    confirmedAt: source.confirmedAt == null && source.ConfirmedAt == null ? null : String(source.confirmedAt ?? source.ConfirmedAt),
  }
}

function normalizeChange(value: unknown) {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return {
    action: String(source.action ?? source.Action ?? ''),
    entityType: String(source.entityType ?? source.EntityType ?? ''),
    entityId: source.entityId == null && source.EntityId == null ? null : String(source.entityId ?? source.EntityId),
    label: String(source.label ?? source.Label ?? ''),
    field: source.field == null && source.Field == null ? null : String(source.field ?? source.Field),
    before: source.before == null && source.Before == null ? null : String(source.before ?? source.Before),
    after: source.after == null && source.After == null ? null : String(source.after ?? source.After),
  }
}

export const aiPlanningRealtime = new AiPlanningRealtime()
