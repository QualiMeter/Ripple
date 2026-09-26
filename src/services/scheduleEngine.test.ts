import { describe, expect, it } from 'vitest'
import type { Dependency } from '../types/dependency'
import type { ProjectTask } from '../types/task'
import {
  applyExplicitTaskUpdate,
  applyScheduleShiftPreview,
  calculateScheduleShiftPreview,
  findScheduleConflicts,
} from './scheduleEngine'

function task(id: string, startDate: string, endDate: string, status: ProjectTask['status'] = 'not-started'): ProjectTask {
  return {
    id,
    projectId: 'test-project',
    title: id,
    startDate,
    endDate,
    plannedStartDate: startDate,
    plannedEndDate: endDate,
    durationDays: 1,
    progress: status === 'completed' ? 100 : 0,
    assigneeId: 'owner',
    status,
    riskState: 'none',
    isCritical: id !== 'independent',
  }
}

const tasks = [
  task('source', '2026-01-05', '2026-01-09'),
  task('frontend', '2026-01-08', '2026-01-09'),
  task('qa', '2026-01-10', '2026-01-11'),
  task('release', '2026-01-12', '2026-01-12'),
  task('independent', '2026-01-06', '2026-01-08'),
]

const dependencies: Dependency[] = [
  { id: 'd1', projectId: 'test-project', predecessorTaskId: 'source', successorTaskId: 'frontend', type: 'finish-to-start' },
  { id: 'd2', projectId: 'test-project', predecessorTaskId: 'frontend', successorTaskId: 'qa', type: 'finish-to-start' },
  { id: 'd3', projectId: 'test-project', predecessorTaskId: 'qa', successorTaskId: 'release', type: 'finish-to-start' },
]

describe('scheduleEngine explicit shift flow', () => {
  it('обычное изменение меняет только исходную задачу и показывает конфликт', () => {
    const source = tasks[0]
    const updated = applyExplicitTaskUpdate(source, { endDate: '2026-01-10' })
    const current = tasks.map((item) => item.id === source.id ? updated : item)

    expect(current.find((item) => item.id === 'frontend')).toEqual(tasks[1])
    expect(findScheduleConflicts(current, dependencies, ['frontend', 'qa', 'release'])).not.toEqual([])
  })

  it('preview сдвигает downstream-цепочку по календарным дням, включая выходные', () => {
    const preview = calculateScheduleShiftPreview('test-project', tasks, dependencies, 'source')

    expect(preview.taskShifts).toEqual([
      expect.objectContaining({ taskId: 'frontend', proposedStartDate: '2026-01-10', proposedEndDate: '2026-01-11', shiftDays: 2 }),
      expect.objectContaining({ taskId: 'qa', proposedStartDate: '2026-01-12', proposedEndDate: '2026-01-13', shiftDays: 2 }),
      expect.objectContaining({ taskId: 'release', proposedStartDate: '2026-01-14', proposedEndDate: '2026-01-14', shiftDays: 2 }),
    ])
    expect(preview.proposedProjectEndDate).toBe('2026-01-14')
  })

  it('не меняет даты до подтверждения и применяет их после него', () => {
    const preview = calculateScheduleShiftPreview('test-project', tasks, dependencies, 'source')
    expect(tasks.find((item) => item.id === 'frontend')?.startDate).toBe('2026-01-08')

    const applied = applyScheduleShiftPreview(tasks, preview)
    expect(applied.find((item) => item.id === 'frontend')?.startDate).toBe('2026-01-10')
  })

  it('не сдвигает завершённую downstream-задачу и независимые задачи', () => {
    const withCompleted = tasks.map((item) => item.id === 'frontend'
      ? { ...item, status: 'completed' as const, riskState: 'at-risk' as const }
      : item)
    const preview = calculateScheduleShiftPreview('test-project', withCompleted, dependencies, 'source')

    expect(preview.taskShifts.map((shift) => shift.taskId)).not.toContain('frontend')
    expect(preview.taskShifts.map((shift) => shift.taskId)).not.toContain('independent')
    expect(applyScheduleShiftPreview(withCompleted, preview).find((item) => item.id === 'frontend')).toMatchObject({
      startDate: '2026-01-08', endDate: '2026-01-09', status: 'completed', riskState: 'none',
    })
  })

  it('изменение ответственного не меняет даты', () => {
    const updated = applyExplicitTaskUpdate(tasks[0], { assigneeId: 'other' })
    expect(updated).toMatchObject({ startDate: tasks[0].startDate, endDate: tasks[0].endDate, assigneeId: 'other' })
  })
})
