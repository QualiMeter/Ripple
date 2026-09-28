import { describe, expect, it } from 'vitest'
import type { Dependency } from '../types/dependency'
import type { ScheduleShiftPreview } from '../types/schedule'
import type { ProjectTask } from '../types/task'
import { applyScheduleShiftPreview, calculateScheduleShiftPreview, findScheduleConflicts } from './scheduleEngine'
import { assertValidScheduleShiftPreview, getEarliestSuccessorStart } from './scheduleRules'

function task(id: string, startDate: string, endDate: string): ProjectTask {
  return {
    id, projectId: 'project', title: id, startDate, endDate, plannedStartDate: startDate, plannedEndDate: endDate,
    durationDays: 1, progress: 0, assigneeId: 'employee', status: 'not-started', riskState: 'none', isCritical: false,
  }
}

function dependency(id: string, predecessorTaskId: string, successorTaskId: string): Dependency {
  return { id, projectId: 'project', predecessorTaskId, successorTaskId, type: 'finish-to-start' }
}

describe('finish-to-start calendar rule', () => {
  it('moves a same-day successor to the next calendar day', () => {
    const tasks = [task('A', '2026-10-11', '2026-10-14'), task('B', '2026-10-14', '2026-10-16')]
    const preview = calculateScheduleShiftPreview('project', tasks, [dependency('a-b', 'A', 'B')], 'A')
    expect(preview.taskShifts).toEqual([expect.objectContaining({ taskId: 'B', proposedStartDate: '2026-10-15', proposedEndDate: '2026-10-17' })])
  })

  it('preserves inclusive duration when moving an earlier successor', () => {
    const tasks = [task('A', '2026-10-11', '2026-10-14'), task('B', '2026-10-12', '2026-10-16')]
    const preview = calculateScheduleShiftPreview('project', tasks, [dependency('a-b', 'A', 'B')], 'A')
    expect(preview.taskShifts[0]).toMatchObject({ proposedStartDate: '2026-10-15', proposedEndDate: '2026-10-19' })
  })

  it('moves a five-day successor from 1 October to the first valid day after 8 October', () => {
    const tasks = [task('A', '2026-10-01', '2026-10-08'), task('B', '2026-10-01', '2026-10-05')]
    const preview = calculateScheduleShiftPreview('project', tasks, [dependency('a-b', 'A', 'B')], 'A')
    expect(preview.taskShifts).toEqual([
      expect.objectContaining({ taskId: 'B', proposedStartDate: '2026-10-09', proposedEndDate: '2026-10-13', shiftDays: 8 }),
    ])
  })

  it('does not shift a successor already starting the next day', () => {
    const tasks = [task('A', '2026-10-11', '2026-10-14'), task('B', '2026-10-15', '2026-10-18')]
    expect(calculateScheduleShiftPreview('project', tasks, [dependency('a-b', 'A', 'B')], 'A').taskShifts).toEqual([])
  })

  it('uses the latest end across multiple predecessors', () => {
    expect(getEarliestSuccessorStart(['2026-10-14', '2026-10-17'])).toBe('2026-10-18')
    const tasks = [task('A', '2026-10-11', '2026-10-14'), task('C', '2026-10-12', '2026-10-17'), task('B', '2026-10-15', '2026-10-18')]
    const dependencies = [dependency('a-b', 'A', 'B'), dependency('c-b', 'C', 'B')]
    expect(calculateScheduleShiftPreview('project', tasks, dependencies, 'A').taskShifts[0]).toMatchObject({ proposedStartDate: '2026-10-18' })
  })

  it('recalculates a cascade from the shifted predecessor dates', () => {
    const tasks = [task('A', '2026-10-11', '2026-10-14'), task('B', '2026-10-14', '2026-10-16'), task('C', '2026-10-17', '2026-10-18')]
    const dependencies = [dependency('a-b', 'A', 'B'), dependency('b-c', 'B', 'C')]
    expect(calculateScheduleShiftPreview('project', tasks, dependencies, 'A').taskShifts).toEqual([
      expect.objectContaining({ taskId: 'B', proposedStartDate: '2026-10-15', proposedEndDate: '2026-10-17' }),
      expect.objectContaining({ taskId: 'C', proposedStartDate: '2026-10-18', proposedEndDate: '2026-10-19' }),
    ])
  })

  it('leaves no schedule conflicts after applying a calculated preview', () => {
    const tasks = [task('A', '2026-10-11', '2026-10-14'), task('B', '2026-10-12', '2026-10-16'), task('C', '2026-10-16', '2026-10-18')]
    const dependencies = [dependency('a-b', 'A', 'B'), dependency('b-c', 'B', 'C')]
    const applied = applyScheduleShiftPreview(tasks, calculateScheduleShiftPreview('project', tasks, dependencies, 'A'))
    expect(findScheduleConflicts(applied, dependencies, ['B', 'C'])).toEqual([])
  })

  it('rejects a backend preview that still violates a dependency', () => {
    const tasks = [task('A', '2026-10-11', '2026-10-14'), task('B', '2026-10-12', '2026-10-16')]
    const dependencies = [dependency('a-b', 'A', 'B')]
    const invalidPreview: ScheduleShiftPreview = {
      projectId: 'project', sourceTaskId: 'A', currentProjectEndDate: '2026-10-16', proposedProjectEndDate: '2026-10-18', projectEndShiftDays: 2,
      taskShifts: [{ taskId: 'B', currentStartDate: '2026-10-12', currentEndDate: '2026-10-16', proposedStartDate: '2026-10-14', proposedEndDate: '2026-10-18', shiftDays: 2 }],
    }
    expect(() => assertValidScheduleShiftPreview(tasks, dependencies, invalidPreview)).toThrow('Полученный план сдвига всё ещё нарушает зависимости')
  })
})
