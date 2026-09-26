import type { ScheduleShiftPreview, ScheduleShiftPreviewRequest } from '../types/schedule'
import { apiRequest } from './client'

export interface ScheduleApi {
  previewShift(projectId: string, request: ScheduleShiftPreviewRequest): Promise<ScheduleShiftPreview>
  applyShift(projectId: string, preview: ScheduleShiftPreview): Promise<void>
}

const httpScheduleApi: ScheduleApi = {
  previewShift: (projectId, request) => apiRequest<ScheduleShiftPreview>(`/api/projects/${projectId}/schedule-shift/preview`, { method: 'POST', body: JSON.stringify(request) }),
  applyShift: (projectId, preview) => apiRequest<void>(`/api/projects/${projectId}/schedule-shift/apply`, { method: 'POST', body: JSON.stringify(preview) }),
}

const mode = import.meta.env.VITE_API_MODE ?? 'mock'

export const scheduleApi: ScheduleApi = mode === 'http'
  ? httpScheduleApi
  : {
      previewShift: async (projectId, request) => {
        const { mockScheduleApi } = await import('./mockSchedule.api')
        return mockScheduleApi.previewShift(projectId, request)
      },
      applyShift: async (projectId, preview) => {
        const { mockScheduleApi } = await import('./mockSchedule.api')
        return mockScheduleApi.applyShift(projectId, preview)
      },
    }
