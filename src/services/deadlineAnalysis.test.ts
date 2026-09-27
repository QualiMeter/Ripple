import { describe, expect, it } from 'vitest'
import type { Dependency } from '../types/dependency'
import type { ProjectTask, TaskStatus } from '../types/task'
import { analyzeTaskOverdue } from './deadlineAnalysis'

function task(status: TaskStatus, endDate = '2026-09-15'): ProjectTask {
  return {
    id: 'task', projectId: 'project', title: 'Backend', startDate: '2026-09-01', endDate,
    plannedStartDate: '2026-09-01', plannedEndDate: endDate, durationDays: 15, progress: 0,
    assigneeId: 'employee', status, riskState: 'none', isCritical: false,
  }
}

const dependencies: Dependency[] = [
  { id: 'one', projectId: 'project', predecessorTaskId: 'task', successorTaskId: 'next', type: 'finish-to-start' },
  { id: 'two', projectId: 'project', predecessorTaskId: 'next', successorTaskId: 'release', type: 'finish-to-start' },
]

describe('task overdue analysis', () => {
  it('does not mark a task overdue on its end date', () => {
    expect(analyzeTaskOverdue(task('in-progress'), dependencies, '2026-09-15')).toBeNull()
  })

  it('reports the calendar-day delay and all downstream tasks for unfinished work', () => {
    expect(analyzeTaskOverdue(task('in-progress'), dependencies, '2026-09-27')).toEqual({
      taskId: 'task', deadline: '2026-09-15', overdueDays: 12, downstreamTaskCount: 2,
    })
  })

  it('does not describe a completed task as currently overdue', () => {
    expect(analyzeTaskOverdue(task('completed'), dependencies, '2026-09-27')).toBeNull()
  })
})
