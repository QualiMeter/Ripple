import { apiFetch, apiRequest } from './client'

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
  const changes = Array.isArray(changesValue) ? changesValue as AiPlanChange[] : []

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


async function streamPlan(path: string, prompt: string, onProgress: (progress: AiProgress) => void): Promise<AiPlan> {
  const response = await apiFetch(path, {
    method: 'POST',
    body: JSON.stringify({ prompt }),
    headers: { Accept: 'text/event-stream' },
  })
  if (!response.body) throw new Error('Сервер не вернул поток генерации.')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let completed: AiPlan | null = null

  const processEvent = (event: string) => {
    const normalized = event.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    let type = 'message'
    const dataLines: string[] = []

    for (const line of normalized.split('\n')) {
      if (line.startsWith('event:')) {
        type = line.slice('event:'.length).trim()
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice('data:'.length).trimStart())
      }
    }

    const data = dataLines.join('\n').trim()
    if (!data) return

    let value: unknown
    try {
      value = JSON.parse(data)
    } catch {
      throw new Error('Сервер вернул некорректный JSON в потоке генерации.')
    }

    if (type === 'progress') {
      onProgress(value as AiProgress)
      return
    }

    if (type === 'completed' || (type === 'message' && typeof value === 'object' && value !== null && 'planId' in value)) {
      completed = normalizeAiPlan(value)
      return
    }

    if (type === 'error') {
      const message = typeof value === 'object' && value !== null && 'message' in value
        ? String((value as { message?: unknown }).message ?? '')
        : ''
      throw new Error(message || 'ИИ не смог сформировать план.')
    }
  }

  const consume = (chunk: string) => {
    buffer += chunk
    buffer = buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    const events = buffer.split('\n\n')
    buffer = events.pop() ?? ''
    for (const event of events) {
      processEvent(event)
    }
  }

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    consume(decoder.decode(value, { stream: true }))
  }

  consume(decoder.decode())
  if (buffer.trim()) processEvent(buffer)

  if (!completed) {
    throw new Error('Поток генерации завершился без готового плана. Проверьте ответ SSE от backend.')
  }

  return completed
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
  createProjectPlanStream(prompt, onProgress) {
    return streamPlan('/v1/ai/projects/plan/stream', prompt, onProgress)
  },
  createProjectUpdatePlanStream(projectId, prompt, onProgress) {
    return streamPlan(`/v1/projects/${projectId}/ai/plan/stream`, prompt, onProgress)
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
