import type { ProjectSummary } from '../types/project'
import type { ProjectTask } from '../types/task'
import { addCalendarDays, calendarDaysBetween } from '../utils/date'
import { inclusiveDuration } from './scheduleEngine'

export interface TimelineScale {
  startDate: string
  endDate: string
  totalDays: number
}

export interface TimelineBarGeometry {
  leftPercent: number
  widthPercent: number
  startOffsetDays: number
  durationDays: number
}

export interface TimelineViewportMetrics {
  /** Minimum plotting width. The UI may stretch it to fill the available container. */
  canvasWidthPx: number
  totalWidthPx: number
  columnCount: number
}

export interface TimelineColumn {
  key: string
  startDate: string
  endDateExclusive: string
  label: string
  leftPercent: number
  widthPercent: number
}

export type TimelineScaleMode = 'day' | 'week' | 'month'

const taskColumnWidthPx = 210
const pixelsPerDay: Record<TimelineScaleMode, number> = {
  day: 32,
  week: 16,
  month: 5.25,
}

export function getTimelineViewportMetrics(scale: TimelineScale, mode: TimelineScaleMode = 'day'): TimelineViewportMetrics {
  const canvasWidthPx = Math.ceil(scale.totalDays * pixelsPerDay[mode])
  return {
    canvasWidthPx,
    totalWidthPx: taskColumnWidthPx + canvasWidthPx,
    columnCount: buildTimelineColumns(scale, mode).length,
  }
}

export function formatTimelineTick(value: string, mode: TimelineScaleMode): string {
  const date = new Date(`${value}T00:00:00Z`)
  if (mode === 'month') {
    return new Intl.DateTimeFormat('ru-RU', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date)
  }
  if (mode === 'week') return `Нед. ${new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(date)}`
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(date)
}

export function buildTimelineScale(project: ProjectSummary, tasks: ProjectTask[]): TimelineScale {
  const startDate = [project.startDate, ...tasks.map((task) => task.startDate)].reduce((earliest, date) => date < earliest ? date : earliest)
  const endDate = [project.targetEndDate, project.projectedEndDate, ...tasks.map((task) => task.endDate)].reduce((latest, date) => date > latest ? date : latest)
  return { startDate, endDate, totalDays: inclusiveDuration(startDate, endDate) }
}

export function getTimelineBarGeometry(task: ProjectTask, scale: TimelineScale): TimelineBarGeometry {
  const startOffsetDays = calendarDaysBetween(scale.startDate, task.startDate)
  const durationDays = inclusiveDuration(task.startDate, task.endDate)
  const leftPercent = getTimelineDatePosition(task.startDate, scale) ?? 0
  const endPercent = getTimelineDatePosition(addCalendarDays(task.endDate, 1), scale, true) ?? 100
  return {
    leftPercent,
    widthPercent: endPercent - leftPercent,
    startOffsetDays,
    durationDays,
  }
}

function nextMonthStart(value: string): string {
  const date = new Date(`${value}T00:00:00Z`)
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)).toISOString().slice(0, 10)
}

export function buildTimelineColumns(scale: TimelineScale, mode: TimelineScaleMode): TimelineColumn[] {
  const timelineEndExclusive = addCalendarDays(scale.endDate, 1)
  const columns: TimelineColumn[] = []
  let startDate = scale.startDate

  while (startDate < timelineEndExclusive) {
    const candidateEnd = mode === 'day'
      ? addCalendarDays(startDate, 1)
      : mode === 'week'
        ? addCalendarDays(startDate, 7)
        : nextMonthStart(startDate)
    const endDateExclusive = candidateEnd < timelineEndExclusive ? candidateEnd : timelineEndExclusive
    const startOffset = calendarDaysBetween(scale.startDate, startDate)
    const durationDays = calendarDaysBetween(startDate, endDateExclusive)
    columns.push({
      key: `${mode}-${startDate}`,
      startDate,
      endDateExclusive,
      label: formatTimelineTick(startDate, mode),
      leftPercent: (startOffset / scale.totalDays) * 100,
      widthPercent: (durationDays / scale.totalDays) * 100,
    })
    startDate = endDateExclusive
  }

  return columns
}

export function getTimelineDatePosition(date: string, scale: TimelineScale, allowEndExclusive = false): number | null {
  const lastAllowedDate = allowEndExclusive ? addCalendarDays(scale.endDate, 1) : scale.endDate
  if (date < scale.startDate || date > lastAllowedDate) return null
  return (calendarDaysBetween(scale.startDate, date) / scale.totalDays) * 100
}

export function getTimelineDayDeltaFromPixels(deltaPixels: number, plottingWidthPixels: number, totalDays: number): number {
  if (plottingWidthPixels <= 0 || totalDays <= 0) return 0
  return Math.round((deltaPixels / plottingWidthPixels) * totalDays)
}
