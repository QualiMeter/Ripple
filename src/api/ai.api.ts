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

  const consume = (chunk: string) => {
    buffer += chunk
    const events = buffer.split(/\n\n/)
    buffer = events.pop() ?? ''
    for (const event of events) {
      let type = 'message'
      let data = ''
      for (const line of event.split(/\n/)) {
        if (line.startsWith('event:')) type = line.slice(6).trim()
        else if (line.startsWith('data:')) data += line.slice(5).trim()
      }
      if (!data) continue
      try {
        const value = JSON.parse(data) as AiProgress | AiPlan | { message?: string }
        if (type === 'progress') onProgress(value as AiProgress)
        else if (type === 'completed') completed = value as AiPlan
        else if (type === 'error') throw new Error((value as { message?: string }).message || 'ИИ не смог сформировать план.')
      } catch (error) {
        if (error instanceof Error) throw error
        throw new Error('Сервер вернул некорректный поток генерации.')
      }
    }
  }

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    consume(decoder.decode(value, { stream: true }))
  }
  consume(decoder.decode())
  if (!completed) throw new Error('Поток генерации завершился без готового плана.')
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
