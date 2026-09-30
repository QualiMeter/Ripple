import { describe, expect, it } from 'vitest'
import type { ProjectSummary } from '../types/project'
import type { ProjectTask } from '../types/task'
import { buildTimelineColumns, buildTimelineScale, formatTimelineTick, getTimelineBarGeometry, getTimelineViewportMetrics } from './timelineLayout'

const project: ProjectSummary = {
  id: 'project', creatorId: 'manager', name: 'Проект', description: '', startDate: '2026-09-11', targetEndDate: '2026-09-20',
  projectedEndDate: '2026-09-20', ownerName: 'Менеджер', health: 'on-track', progress: 0, taskCount: 1, completedTaskCount: 0,
}
const task: ProjectTask = {
  id: 'task', projectId: 'project', title: 'Задача', startDate: '2026-09-11', endDate: '2026-09-14',
  plannedStartDate: '2026-09-11', plannedEndDate: '2026-09-14', durationDays: 4, progress: 0,
  assigneeId: 'employee', status: 'not-started', riskState: 'none', isCritical: false,
}

describe('timeline calendar geometry', () => {
  it('uses inclusive task dates on the same scale as the timeline', () => {
    const scale = buildTimelineScale(project, [task])
    const geometry = getTimelineBarGeometry(task, scale)
    expect(scale).toEqual({ startDate: '2026-09-11', endDate: '2026-09-20', totalDays: 10 })
    expect(geometry).toMatchObject({ startOffsetDays: 0, durationDays: 4, leftPercent: 0, widthPercent: 40 })
  })

  it('expands long projects into a horizontally scrollable calendar canvas', () => {
    const scale = buildTimelineScale({ ...project, targetEndDate: '2027-09-10', projectedEndDate: '2027-09-10' }, [])
    const viewport = getTimelineViewportMetrics(scale, 'week')

    expect(scale.totalDays).toBe(365)
    expect(viewport.canvasWidthPx).toBe(5840)
    expect(viewport.totalWidthPx).toBe(6050)
    expect(viewport.columnCount).toBeGreaterThan(7)
  })

  it('uses distinct day, week and month display scales without changing dates', () => {
    const scale = buildTimelineScale({ ...project, targetEndDate: '2027-09-10', projectedEndDate: '2027-09-10' }, [task])
    const day = getTimelineViewportMetrics(scale, 'day')
    const week = getTimelineViewportMetrics(scale, 'week')
    const month = getTimelineViewportMetrics(scale, 'month')

    expect(day.canvasWidthPx).toBeGreaterThan(week.canvasWidthPx)
    expect(week.canvasWidthPx).toBeGreaterThan(month.canvasWidthPx)
    expect(formatTimelineTick('2026-09-11', 'day')).toContain('11')
    expect(formatTimelineTick('2026-09-11', 'week')).toContain('Нед.')
    expect(formatTimelineTick('2026-09-11', 'month')).toContain('2026')
  })

  it('creates one real calendar column per day without skipping labels', () => {
    const scale = buildTimelineScale(project, [task])
    const columns = buildTimelineColumns(scale, 'day')

    expect(columns).toHaveLength(10)
    expect(columns.slice(0, 4).map((column) => column.startDate)).toEqual([
      '2026-09-11', '2026-09-12', '2026-09-13', '2026-09-14',
    ])
    expect(columns.every((column) => column.widthPercent === 10)).toBe(true)
  })

  it('creates sequential week and calendar-month intervals on the same coordinate scale', () => {
    const scale = buildTimelineScale({ ...project, startDate: '2026-09-11', targetEndDate: '2026-11-10', projectedEndDate: '2026-11-10' }, [])
    const weeks = buildTimelineColumns(scale, 'week')
    const months = buildTimelineColumns(scale, 'month')

    expect(weeks.slice(0, 3).map((column) => column.startDate)).toEqual(['2026-09-11', '2026-09-18', '2026-09-25'])
    expect(months.map((column) => column.startDate)).toEqual(['2026-09-11', '2026-10-01', '2026-11-01'])
    expect(weeks.reduce((sum, column) => sum + column.widthPercent, 0)).toBeCloseTo(100)
    expect(months.reduce((sum, column) => sum + column.widthPercent, 0)).toBeCloseTo(100)
  })

  it('uses a clickable 32px minimum day width and no extra trailing canvas width', () => {
    const scale = buildTimelineScale(project, [])
    const viewport = getTimelineViewportMetrics(scale, 'day')

    expect(viewport.canvasWidthPx).toBe(scale.totalDays * 32)
    expect(viewport.totalWidthPx).toBe(210 + viewport.canvasWidthPx)
  })
})
