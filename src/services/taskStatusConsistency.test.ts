import { describe, expect, it } from 'vitest'
import type { Dependency } from '../types/dependency'
import type { ProjectTask, TaskStatus } from '../types/task'
import { getIncompletePredecessors, getTaskCompletionError, validateTaskCompletion } from './taskStatusConsistency'

function task(id: string, status: TaskStatus): ProjectTask {
  return {
    id, projectId: 'project', title: id, startDate: '2026-10-01', endDate: '2026-10-02',
    plannedStartDate: '2026-10-01', plannedEndDate: '2026-10-02', durationDays: 2, progress: 0,
    assigneeId: 'owner', status, riskState: 'none', isCritical: false,
  }
}

function dependency(id: string, predecessorTaskId: string, successorTaskId: string): Dependency {
  return { id, projectId: 'project', predecessorTaskId, successorTaskId, type: 'finish-to-start' }
}

describe('task status consistency', () => {
  it('finds zero, one and several incomplete direct predecessors', () => {
    const tasks = [task('A', 'not-started'), task('B', 'in-progress'), task('C', 'completed'), task('D', 'not-started')]
    const dependencies = [dependency('a-d', 'A', 'D'), dependency('b-d', 'B', 'D'), dependency('c-d', 'C', 'D')]
    expect(getIncompletePredecessors('A', tasks, dependencies)).toEqual([])
    expect(getIncompletePredecessors('D', tasks, [dependencies[0]])).toEqual([tasks[0]])
    expect(getIncompletePredecessors('D', tasks, dependencies).map((item) => item.id)).toEqual(['A', 'B'])
  })

  it('blocks completed while listing unfinished predecessors', () => {
    const tasks = [task('A', 'not-started'), task('C', 'in-progress'), task('B', 'not-started')]
    const dependencies = [dependency('a-b', 'A', 'B'), dependency('c-b', 'C', 'B')]
    expect(() => validateTaskCompletion('B', 'completed', tasks, dependencies)).toThrow('Нельзя завершить задачу')
    expect(getTaskCompletionError('B', 'completed', tasks, dependencies)).toContain('Не завершены: «A», «C».')
  })

  it('allows completed only when all direct predecessors are completed', () => {
    const tasks = [task('A', 'completed'), task('C', 'completed'), task('B', 'not-started')]
    const dependencies = [dependency('a-b', 'A', 'B'), dependency('c-b', 'C', 'B')]
    expect(() => validateTaskCompletion('B', 'completed', tasks, dependencies)).not.toThrow()
  })

  it('does not block in-progress with an unfinished predecessor', () => {
    const tasks = [task('A', 'not-started'), task('B', 'not-started')]
    expect(() => validateTaskCompletion('B', 'in-progress', tasks, [dependency('a-b', 'A', 'B')])).not.toThrow()
  })
})
