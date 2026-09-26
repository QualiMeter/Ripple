import type { ScheduleShiftPreview, ScheduleShiftPreviewRequest } from '../types/schedule'
import { apiRequest } from './client'
import type { ShiftConfirmationResponse, ShiftPreviewDto } from './backend/types'
import { mapShiftPreview } from './backend/mappers'
import { setHttpProjectSession } from './backend/session'
import { composeHttpWorkspace } from './backend/workspace'

export interface ScheduleApi {
  previewShift(projectId: string, request: ScheduleShiftPreviewRequest): Promise<ScheduleShiftPreview>
  applyShift(projectId: string, preview: ScheduleShiftPreview): Promise<void>
}

export const httpScheduleApi: ScheduleApi = {
  async previewShift(projectId, request) {
    const dto = await apiRequest<ShiftPreviewDto>(`/api/v1/projects/${projectId}/tasks/${request.sourceTaskId}/shift-preview`, { method: 'POST' })
    return mapShiftPreview(projectId, dto)
  },
  async applyShift(projectId, preview) {
    const before = await composeHttpWorkspace(projectId)
    const response = await apiRequest<ShiftConfirmationResponse>(`/api/v1/projects/${projectId}/tasks/${preview.sourceTaskId}/shift-confirm`, {
      method: 'POST', body: JSON.stringify({ confirmProjectEndDate: false }),
    })
    const confirmed = mapShiftPreview(projectId, response.preview)
    setHttpProjectSession(projectId, {
      sourceTaskId: preview.sourceTaskId,
      affectedTaskIds: confirmed.taskShifts.map((shift) => shift.taskId),
      lastChange: { kind: 'schedule-shift-applied', sourceTaskId: preview.sourceTaskId, shiftedTaskIds: confirmed.taskShifts.map((shift) => shift.taskId) },
      analysis: response.preview.analysis ?? [], previousProjectEndDate: before.project.projectedEndDate,
    })
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
      applyShift: async (projectId, preview) => {
        const { mockScheduleApi } = await import('./mockSchedule.api')
        return mockScheduleApi.applyShift(projectId, preview)
      },
    }
