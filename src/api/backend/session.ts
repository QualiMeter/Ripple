import type { LastChange } from '../../types/impact'
import type { AnalysisMessageDto } from './types'

export interface HttpProjectSession {
  sourceTaskId: string
  affectedTaskIds: string[]
  lastChange: LastChange
  analysis: AnalysisMessageDto[]
  previousProjectEndDate?: string
}

const sessions = new Map<string, HttpProjectSession>()

export function getHttpProjectSession(projectId: string): HttpProjectSession {
  return sessions.get(projectId) ?? {
    sourceTaskId: '',
    affectedTaskIds: [],
    lastChange: { kind: 'session-started' },
    analysis: [],
  }
}

export function setHttpProjectSession(projectId: string, session: HttpProjectSession): void {
  sessions.set(projectId, session)
}

export function clearHttpProjectSessions(): void {
  sessions.clear()
}
