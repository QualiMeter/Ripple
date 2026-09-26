import { getMockProjectState, saveMockProjectState } from '../mocks/workspaceStore'
import { applyScheduleShiftPreview, calculateScheduleShiftPreview } from '../services/scheduleEngine'
import type { ScheduleApi } from './schedule.api'

export const mockScheduleApi: ScheduleApi = {
  async previewShift(projectId, request) {
    await new Promise((resolve) => setTimeout(resolve, 180))
    const state = getMockProjectState(projectId)
    if (!state.tasks.some((task) => task.id === request.sourceTaskId)) throw new Error('Исходная задача для расчёта не найдена.')
    return calculateScheduleShiftPreview(projectId, state.tasks, state.dependencies, request.sourceTaskId)
  },

  async applyShift(projectId, preview) {
    await new Promise((resolve) => setTimeout(resolve, 220))
    const state = getMockProjectState(projectId)
    const currentPreview = calculateScheduleShiftPreview(projectId, state.tasks, state.dependencies, preview.sourceTaskId)
    if (JSON.stringify(preview) !== JSON.stringify(currentPreview)) throw new Error('Предпросмотр устарел. Рассчитайте сдвиг повторно.')
    const tasks = applyScheduleShiftPreview(state.tasks, currentPreview)
    const taskOverrides = { ...state.taskOverrides }
    for (const shift of currentPreview.taskShifts) {
      taskOverrides[shift.taskId] = {
        ...taskOverrides[shift.taskId],
        startDate: shift.proposedStartDate,
        endDate: shift.proposedEndDate,
      }
    }
    saveMockProjectState(projectId, {
      ...state,
      tasks,
      taskOverrides,
      affectedTaskIds: currentPreview.taskShifts.map((shift) => shift.taskId),
      lastChange: {
        kind: 'schedule-shift-applied',
        sourceTaskId: currentPreview.sourceTaskId,
        shiftedTaskIds: currentPreview.taskShifts.map((shift) => shift.taskId),
      },
    })
  },
}
