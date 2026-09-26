import { describe, expect, it } from 'vitest'
import type { Dependency } from '../types/dependency'
import type { ProjectTask } from '../types/task'
import {
  addDependencyToGraph,
  DependencyValidationError,
  validateDependencyTasks,
} from './dependencyGraph'
import { calculateScheduleShiftPreview, findScheduleConflicts } from './scheduleEngine'

const projectId = 'test-project'

function dependency(id: string, predecessorTaskId: string, successorTaskId: string): Dependency {
  return { id, projectId, predecessorTaskId, successorTaskId, type: 'finish-to-start' }
}

function task(id: string, startDate: string, endDate: string): ProjectTask {
  return {
    id,
    projectId,
    title: id,
    startDate,
    endDate,
    plannedStartDate: startDate,
    plannedEndDate: endDate,
    durationDays: 2,
    progress: 0,
    assigneeId: 'owner',
    status: 'not-started',
    riskState: 'none',
    isCritical: false,
  }
}

describe('dependencyGraph', () => {
  it('создаёт корректную finish-to-start зависимость', () => {
    const created = dependency('d1', 'analysis', 'development')

    expect(addDependencyToGraph([], created)).toEqual([created])
  })

  it('запрещает зависимость задачи самой на себя', () => {
    expect(() => addDependencyToGraph([], dependency('d1', 'analysis', 'analysis')))
      .toThrowError(expect.objectContaining<Partial<DependencyValidationError>>({ code: 'self-dependency' }))
  })

  it('запрещает дубликат существующей зависимости', () => {
    const existing = dependency('d1', 'analysis', 'development')

    expect(() => addDependencyToGraph([existing], dependency('d2', 'analysis', 'development')))
      .toThrowError(expect.objectContaining<Partial<DependencyValidationError>>({ code: 'duplicate' }))
  })

  it('обнаруживает цикл в цепочке задач', () => {
    const existing = [
      dependency('d1', 'analysis', 'development'),
      dependency('d2', 'development', 'qa'),
    ]

    expect(() => addDependencyToGraph(existing, dependency('d3', 'qa', 'analysis')))
      .toThrowError(expect.objectContaining<Partial<DependencyValidationError>>({ code: 'cycle' }))
  })

  it('запрещает зависимость с несуществующей задачей', () => {
    expect(() => validateDependencyTasks(projectId, [task('analysis', '2026-01-05', '2026-01-07')], {
      predecessorTaskId: 'analysis', successorTaskId: 'missing', type: 'finish-to-start',
    })).toThrowError(expect.objectContaining<Partial<DependencyValidationError>>({ code: 'task-not-found' }))
  })

  it('запрещает зависимость между задачами разных проектов', () => {
    const tasks = [
      task('analysis', '2026-01-05', '2026-01-07'),
      { ...task('external', '2026-01-08', '2026-01-09'), projectId: 'other-project' },
    ]
    expect(() => validateDependencyTasks(projectId, tasks, {
      predecessorTaskId: 'analysis', successorTaskId: 'external', type: 'finish-to-start',
    })).toThrowError(expect.objectContaining<Partial<DependencyValidationError>>({ code: 'cross-project' }))
  })

  it('новая зависимость выявляет конфликт, но не меняет даты до подтверждения', () => {
    const baseline = [
      task('analysis', '2026-01-05', '2026-01-07'),
      task('development', '2026-01-06', '2026-01-07'),
    ]
    const dependencies = addDependencyToGraph([], dependency('d1', 'analysis', 'development'))

    expect(findScheduleConflicts(baseline, dependencies, ['development'])).toHaveLength(1)
    expect(baseline.find((item) => item.id === 'development')).toMatchObject({ startDate: '2026-01-06', endDate: '2026-01-07' })
    expect(calculateScheduleShiftPreview(projectId, baseline, dependencies, 'analysis').taskShifts[0]).toMatchObject({
      taskId: 'development', proposedStartDate: '2026-01-08', proposedEndDate: '2026-01-09',
    })
  })
})
