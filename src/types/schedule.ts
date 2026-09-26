export interface TaskScheduleShift {
  taskId: string
  currentStartDate: string
  currentEndDate: string
  proposedStartDate: string
  proposedEndDate: string
  shiftDays: number
}

export interface ScheduleShiftPreview {
  projectId: string
  sourceTaskId: string
  taskShifts: TaskScheduleShift[]
  currentProjectEndDate: string
  proposedProjectEndDate: string
  projectEndShiftDays: number
}

export interface ScheduleShiftPreviewRequest {
  sourceTaskId: string
}
