import { describe, expect, it } from 'vitest'
import type { Dependency } from '../types/dependency'
import type { ProjectTask } from '../types/task'
import { buildScheduleSlackRows } from './scheduleSlack'

function task(id: string, startDate: string, endDate: string): ProjectTask {
  return { id, projectId: 'project', title: id, startDate, endDate, plannedStartDate: startDate, plannedEndDate: endDate, durationDays: Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86_400_000) + 1, progress: 0, assigneeId: 'employee', status: 'not-started', riskState: 'none', isCritical: false }
}

function dependency(id: string, predecessorTaskId: string, successorTaskId: string): Dependency {
  return { id, projectId: 'project', predecessorTaskId, successorTaskId, type: 'finish-to-start' }
}

const noIssues = { scheduleConflicts: [], statusConflicts: [], deadlineIssues: [], affectedTaskIds: [] }

describe('schedule slack read model', () => {
  it('keeps zero and positive slack values from critical path analysis', () => {
    const rows = buildScheduleSlackRows([task('A', '2026-10-01', '2026-10-03'), task('B', '2026-10-08', '2026-10-10')], [], { A: 0, B: 4 }, noIssues)
    expect(rows[0]).toMatchObject({ slackDays: 0, isCritical: true })
    expect(rows[1]).toMatchObject({ slackDays: 4, isCritical: false })
  })

  it('shows the earliest allowed start and dependency buffer', () => {
    const predecessor = task('Backend', '2026-10-02', '2026-10-06')
    const successor = task('Интеграция', '2026-10-09', '2026-10-11')
    const [row] = buildScheduleSlackRows([predecessor, successor], [dependency('d', predecessor.id, successor.id)], { Интеграция: 2 }, noIssues).filter(({ task: item }) => item.id === successor.id)
    expect(row.earliestAllowedStart).toBe('2026-10-07')
    expect(row.dependencyBufferDays).toBe(2)
  })

  it('uses the predecessor with the latest end date when there are several', () => {
    const early = task('Ранний', '2026-10-01', '2026-10-03')
    const limiting = task('Backend', '2026-10-01', '2026-10-06')
    const successor = task('Интеграция', '2026-10-09', '2026-10-11')
    const row = buildScheduleSlackRows([early, limiting, successor], [dependency('d1', early.id, successor.id), dependency('d2', limiting.id, successor.id)], {}, noIssues).find(({ task: item }) => item.id === successor.id)
    expect(row?.limitingPredecessor?.id).toBe('Backend')
    expect(row?.earliestAllowedStart).toBe('2026-10-07')
  })
})
