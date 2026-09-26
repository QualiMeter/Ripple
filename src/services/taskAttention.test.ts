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
  it('не включает завершённую задачу, даже если она critical, at-risk и affected', () => {
    const completed = task({
      id: 'completed',
      status: 'completed',
      riskState: 'at-risk',
      isCritical: true,
    })
    const active = task({ id: 'active', isCritical: true })

    expect(selectTasksRequiringAttention([completed, active], ['completed']).map((item) => item.id))
      .toEqual(['active'])
  })
})
