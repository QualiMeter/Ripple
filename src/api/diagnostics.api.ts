import { apiRequest } from './client'
import type { ProjectDiagnosticsDto } from './backend/types'

export interface DiagnosticsApi {
  getProjectDiagnostics(projectId: string): Promise<ProjectDiagnosticsDto>
}

export const httpDiagnosticsApi: DiagnosticsApi = {
  getProjectDiagnostics(projectId) {
    return apiRequest<ProjectDiagnosticsDto>(`/api/v1/projects/${projectId}/diagnostics`)
  },
}

const mode = import.meta.env.VITE_API_MODE ?? 'mock'

export const diagnosticsApi: DiagnosticsApi = mode === 'http'
  ? httpDiagnosticsApi
  : {
      async getProjectDiagnostics() {
        throw new Error('Серверная диагностика доступна только в режиме HTTP.')
      },
    }
