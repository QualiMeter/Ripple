import { describe, expect, it } from 'vitest'
import type { ProjectTask } from '../types/task'
import { selectTasksRequiringAttention } from './taskAttention'

function task(overrides: Partial<ProjectTask>): ProjectTask {
  return {
    id: 'task',
    projectId: 'project',
    title: 'Задача',
    startDate: '2026-01-01',
    endDate: '2026-01-02',
    plannedStartDate: '2026-01-01',
    plannedEndDate: '2026-01-02',
    durationDays: 2,
    progress: 0,
    assigneeId: 'owner',
    status: 'not-started',
    riskState: 'none',
    isCritical: false,
    ...overrides,
  }
}

describe('selectTasksRequiringAttention', () => {
  it('не включает завершённую задачу, даже если она вычислена как critical, at-risk и affected', () => {
    const completed = task({
      id: 'completed',
      status: 'completed',
      riskState: 'at-risk',
      isCritical: false,
    })
    const active = task({ id: 'active', isCritical: false })

    expect(selectTasksRequiringAttention([completed, active], ['completed'], ['completed', 'active'], {
      scheduleConflicts: [], statusConflicts: [], deadlineIssues: [], affectedTaskIds: [],
    }).map((item) => item.id))
      .toEqual(['active'])
  })

  it('includes an overdue or status-conflict task from current issues', () => {
    const source = task({ id: 'source' })
    const affected = task({ id: 'affected' })
    const issues = {
      scheduleConflicts: [],
      statusConflicts: [{ sourceTaskId: source.id, affectedTaskIds: [affected.id], reason: 'Проблема', consequence: 'Проверить', severity: 'warning' as const }],
      deadlineIssues: [],
      affectedTaskIds: [affected.id],
    }
    expect(selectTasksRequiringAttention([source, affected], [], [], issues).map((item) => item.id).sort())
      .toEqual(['affected', 'source'])
  })
})
