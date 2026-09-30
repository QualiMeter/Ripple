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

export function buildTimelineScale(project: ProjectSummary, tasks: ProjectTask[]): TimelineScale {
  const startDate = [project.startDate, ...tasks.map((task) => task.startDate)].reduce((earliest, date) => date < earliest ? date : earliest)
  const endDate = [project.targetEndDate, project.projectedEndDate, ...tasks.map((task) => task.endDate)].reduce((latest, date) => date > latest ? date : latest)
  return { startDate, endDate, totalDays: inclusiveDuration(startDate, endDate) }
}

export function getTimelineBarGeometry(task: ProjectTask, scale: TimelineScale): TimelineBarGeometry {
  const startOffsetDays = calendarDaysBetween(scale.startDate, task.startDate)
  const durationDays = inclusiveDuration(task.startDate, task.endDate)
  return {
    leftPercent: (startOffsetDays / scale.totalDays) * 100,
    widthPercent: (durationDays / scale.totalDays) * 100,
    startOffsetDays,
    durationDays,
  }
}

export function buildTimelineTickDates(scale: TimelineScale, count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    const centeredOffset = Math.min(scale.totalDays - 1, Math.floor((scale.totalDays * (index + 0.5)) / count))
    return addCalendarDays(scale.startDate, centeredOffset)
  })
}

export function getTimelineDatePosition(date: string, scale: TimelineScale): number | null {
  if (date < scale.startDate || date > scale.endDate) return null
  return (calendarDaysBetween(scale.startDate, date) / scale.totalDays) * 100
}
