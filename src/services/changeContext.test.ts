import { describe, expect, it } from 'vitest'
import type { ProjectTask } from '../types/task'
import type { ImpactAnalysis } from '../types/impact'
import { buildTaskUpdateChange, describeImpactOutcome, describeLastChange } from './changeContext'

const previousTask: ProjectTask = {
  id: 'task',
  projectId: 'project',
  title: 'Проверка API',
  startDate: '2026-01-05',
  endDate: '2026-01-07',
  plannedStartDate: '2026-01-05',
  plannedEndDate: '2026-01-07',
  durationDays: 3,
  progress: 30,
  assigneeId: 'lena',
  status: 'in-progress',
  riskState: 'none',
  isCritical: false,
}

describe('change context', () => {
  it('описывает status и assignee без ложного изменения срока', () => {
    const nextTask = { ...previousTask, status: 'delayed' as const, assigneeId: 'sam' }
    const change = buildTaskUpdateChange(previousTask, nextTask, {
      status: 'delayed',
      assigneeId: 'sam',
    })
    const description = describeLastChange(change, [nextTask], [
      { id: 'lena', name: 'Лена Ортис', role: 'Разработчик', initials: 'ЛО', color: '' },
      { id: 'sam', name: 'Сэм Рид', role: 'Разработчик', initials: 'СР', color: '' },
    ])

    expect(change).toMatchObject({
      kind: 'task-updated',
      changes: [
        { field: 'assigneeId', previousValue: 'lena', nextValue: 'sam' },
        { field: 'status', previousValue: 'in-progress', nextValue: 'delayed' },
      ],
    })
    expect(description.details.join(' ')).toContain('Ответственный: Лена Ортис → Сэм Рид')
    expect(description.details.join(' ')).toContain('Статус: В работе → Задерживается')
    expect(description.details.join(' ')).not.toContain('Завершение')
    expect(describeImpactOutcome({
      sourceTaskId: nextTask.id,
      lastChange: change,
      affectedTaskIds: [],
      criticalTaskIds: [],
      atRiskTaskIds: [],
      previousProjectEndDate: '2026-01-20',
      projectedProjectEndDate: '2026-01-20',
      projectEndChangeDays: 0,
      deadlineShiftDays: 5,
      requiresIntervention: true,
      reasons: [],
      analyzedAt: '2026-01-01T00:00:00.000Z',
    } satisfies ImpactAnalysis)).toBe('Изменение не повлияло на сроки проекта.')
  })
})
