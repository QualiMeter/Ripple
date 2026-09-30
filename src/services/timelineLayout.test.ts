import { describe, expect, it } from 'vitest'
import type { ProjectSummary } from '../types/project'
import type { ProjectTask } from '../types/task'
import { buildTimelineScale, formatTimelineTick, getTimelineBarGeometry, getTimelineViewportMetrics } from './timelineLayout'

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
    expect(viewport.canvasWidthPx).toBe(3650)
    expect(viewport.totalWidthPx).toBe(3860)
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
})
