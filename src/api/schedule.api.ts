import type { ScheduleShiftConfirmationOptions, ScheduleShiftPreview, ScheduleShiftPreviewRequest } from '../types/schedule'
import { apiRequest } from './client'
import type { ShiftConfirmationResponse, ShiftPreviewDto } from './backend/types'
import { mapShiftPreview } from './backend/mappers'

export interface ScheduleApi {
  previewShift(projectId: string, request: ScheduleShiftPreviewRequest): Promise<ScheduleShiftPreview>
  applyShift(projectId: string, preview: ScheduleShiftPreview, options: ScheduleShiftConfirmationOptions): Promise<{ preview: ScheduleShiftPreview; projectEndDateChanged: boolean }>
}

export const httpScheduleApi: ScheduleApi = {
  async previewShift(projectId, request) {
    const dto = await apiRequest<ShiftPreviewDto>(`/api/v1/projects/${projectId}/tasks/${request.sourceTaskId}/shift-preview`, { method: 'POST' })
    return mapShiftPreview(projectId, dto)
  },
  async applyShift(projectId, preview, options) {
    const response = await apiRequest<ShiftConfirmationResponse>(`/api/v1/projects/${projectId}/tasks/${preview.sourceTaskId}/shift-confirm`, {
      method: 'POST', body: JSON.stringify(options),
    })
    const confirmed = mapShiftPreview(projectId, response.preview)
    return { preview: confirmed, projectEndDateChanged: response.projectEndDateChanged }
  },
}

const mode = import.meta.env.VITE_API_MODE ?? 'mock'

export const scheduleApi: ScheduleApi = mode === 'http'
  ? httpScheduleApi
  : {
      previewShift: async (projectId, request) => {
        const { mockScheduleApi } = await import('./mockSchedule.api')
        return mockScheduleApi.previewShift(projectId, request)
      },
      applyShift: async (projectId, preview, options) => {
        const { mockScheduleApi } = await import('./mockSchedule.api')
        return mockScheduleApi.applyShift(projectId, preview, options)
      },
    }
