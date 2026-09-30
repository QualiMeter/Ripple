import { describe, expect, it } from 'vitest'
import type { ProjectTask } from '../types/task'
import { buildTimelineTaskPreview, timelineDragDeltaDays } from './timelineInteraction'

const task: ProjectTask = {
  id: 'task', projectId: 'project', title: 'Задача', startDate: '2026-09-11', endDate: '2026-09-14',
  plannedStartDate: '2026-09-11', plannedEndDate: '2026-09-14', durationDays: 4, progress: 0,
  assigneeId: 'employee', status: 'in-progress', riskState: 'none', isCritical: false,
}

describe('timeline direct manipulation', () => {
  it('resizes the start without changing the end date', () => {
    expect(buildTimelineTaskPreview(task, 'resize-start', 1)).toEqual({
      startDate: '2026-09-12', endDate: '2026-09-14', update: { startDate: '2026-09-12' },
    })
  })

  it('resizes the end without changing the start date', () => {
    expect(buildTimelineTaskPreview(task, 'resize-end', 2)).toEqual({
      startDate: '2026-09-11', endDate: '2026-09-16', update: { endDate: '2026-09-16' },
    })
  })

  it('moves the whole task and preserves its duration', () => {
    expect(buildTimelineTaskPreview(task, 'move', 3)).toEqual({
      startDate: '2026-09-14', endDate: '2026-09-17', update: { startDate: '2026-09-14', endDate: '2026-09-17' },
    })
  })

  it('converts pointer distance to whole calendar days', () => {
    expect(timelineDragDeltaDays(48, 480, 20)).toBe(2)
  })
})
