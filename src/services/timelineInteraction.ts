import type { ProjectTask, TaskUpdateRequest } from '../types/task'
import { addCalendarDays } from '../utils/date'

export type TimelineDragMode = 'move' | 'resize-start' | 'resize-end'

export interface TimelineTaskPreview {
  startDate: string
  endDate: string
  update: TaskUpdateRequest
}

export function timelineDragDeltaDays(deltaPixels: number, canvasWidthPixels: number, totalDays: number): number {
  if (canvasWidthPixels <= 0 || totalDays <= 0) return 0
  return Math.round(deltaPixels / (canvasWidthPixels / totalDays))
}

export function buildTimelineTaskPreview(task: ProjectTask, mode: TimelineDragMode, requestedDeltaDays: number): TimelineTaskPreview {
  if (mode === 'move') {
    const startDate = addCalendarDays(task.startDate, requestedDeltaDays)
    const endDate = addCalendarDays(task.endDate, requestedDeltaDays)
    return { startDate, endDate, update: { startDate, endDate } }
  }

  if (mode === 'resize-start') {
    const latestStart = task.endDate
    const proposedStart = addCalendarDays(task.startDate, requestedDeltaDays)
    const startDate = proposedStart > latestStart ? latestStart : proposedStart
    return { startDate, endDate: task.endDate, update: { startDate } }
  }

  const earliestEnd = task.startDate
  const proposedEnd = addCalendarDays(task.endDate, requestedDeltaDays)
  const endDate = proposedEnd < earliestEnd ? earliestEnd : proposedEnd
  return { startDate: task.startDate, endDate, update: { endDate } }
}
