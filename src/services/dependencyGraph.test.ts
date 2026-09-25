import { describe, expect, it } from 'vitest'
import type { Dependency } from '../types/dependency'
import type { ProjectTask } from '../types/task'
import {
  addDependencyToGraph,
  DependencyValidationError,
} from './dependencyGraph'
import { recalculateSchedule } from './scheduleEngine'

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

  it('новая зависимость влияет на пересчёт расписания', () => {
    const baseline = [
      task('analysis', '2026-01-05', '2026-01-07'),
      task('development', '2026-01-06', '2026-01-07'),
    ]
    const dependencies = addDependencyToGraph([], dependency('d1', 'analysis', 'development'))

    const result = recalculateSchedule(
      baseline,
      dependencies,
      {},
      'analysis',
      baseline,
      ['development'],
    )

    expect(result.tasks.find((item) => item.id === 'development')).toMatchObject({
      startDate: '2026-01-08',
      endDate: '2026-01-09',
      riskState: 'at-risk',
    })
    expect(result.affectedTaskIds).toEqual(['development'])
  })
})
