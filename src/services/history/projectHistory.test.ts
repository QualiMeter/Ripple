import { describe, expect, it, vi } from 'vitest'
import { dependencySnapshot, scheduleShiftEvent, taskUpdatedEvent } from './historyEvents'
import { createLocalHistoryStorage, historyStorageKey } from './historyStorage'
import { ProjectHistory, recordAfterSuccessfulMutation } from './projectHistory'
import type { ProjectTask } from '../../types/task'

function memoryStorage() {
  const values = new Map<string, string>()
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
}

function task(overrides: Partial<ProjectTask> = {}): ProjectTask {
  return { id: 'task', projectId: 'project', title: 'Backend', startDate: '2026-10-12', endDate: '2026-10-16', plannedStartDate: '2026-10-12', plannedEndDate: '2026-10-16', durationDays: 5, progress: 0, assigneeId: 'employee-a', status: 'not-started', riskState: 'none', isCritical: false, ...overrides }
}

describe('frontend project history', () => {
  it('serializes entries, survives a new service instance and isolates projects', () => {
    const storage = memoryStorage()
    const first = new ProjectHistory(createLocalHistoryStorage(storage))
    first.record({ id: 'one', createdAt: '2026-10-01T10:00:00Z', projectId: 'project-a', kind: 'task-created', title: 'Создана задача', description: 'A', entityType: 'task' })
    first.record({ id: 'two', createdAt: '2026-10-01T11:00:00Z', projectId: 'project-b', kind: 'task-created', title: 'Создана задача', description: 'B', entityType: 'task' })

    const refreshed = new ProjectHistory(createLocalHistoryStorage(storage))
    expect(refreshed.list('project-a').map((entry) => entry.id)).toEqual(['one'])
    expect(refreshed.list('project-b').map((entry) => entry.id)).toEqual(['two'])
    expect(JSON.parse(storage.values.get(historyStorageKey('project-a'))!)[0].description).toBe('A')
  })

  it('keeps only the latest 100 project events', () => {
    const history = new ProjectHistory(createLocalHistoryStorage(memoryStorage()))
    for (let index = 0; index < 105; index += 1) history.record({ id: `event-${index}`, createdAt: new Date(2026, 0, 1, 0, index).toISOString(), projectId: 'project', kind: 'task-created', title: 'Событие', description: String(index), entityType: 'task' })
    expect(history.list('project')).toHaveLength(100)
    expect(history.list('project').some((entry) => entry.id === 'event-0')).toBe(false)
  })

  it('records only after a successful mutation', async () => {
    const record = vi.fn()
    await expect(recordAfterSuccessfulMutation(async () => { throw new Error('backend failed') }, record)).rejects.toThrow('backend failed')
    expect(record).not.toHaveBeenCalled()
    await recordAfterSuccessfulMutation(async () => 'ok', record)
    expect(record).toHaveBeenCalledWith('ok')
  })

  it('stores only changed task fields for task update details', () => {
    const event = taskUpdatedEvent('project', task(), task({ endDate: '2026-10-19', status: 'in-progress' }))
    expect(event.before).toEqual({ endDate: '2026-10-16', status: 'not-started' })
    expect(event.after).toEqual({ endDate: '2026-10-19', status: 'in-progress' })
  })

  it('records dependency creation/deletion and one event for a whole schedule shift', () => {
    const history = new ProjectHistory(createLocalHistoryStorage(memoryStorage()))
    const dependency = dependencySnapshot({ id: 'd', predecessorTaskId: 'a', successorTaskId: 'b' })
    history.record({ projectId: 'project', kind: 'dependency-created', title: 'Добавлена зависимость', description: 'A → B', entityType: 'dependency', after: dependency })
    history.record({ projectId: 'project', kind: 'dependency-deleted', title: 'Удалена зависимость', description: 'A → B', entityType: 'dependency', before: dependency })
    history.record(scheduleShiftEvent('project', { projectId: 'project', sourceTaskId: 'a', currentProjectEndDate: '2026-10-20', proposedProjectEndDate: '2026-10-23', projectEndShiftDays: 3, taskShifts: [
      { taskId: 'b', currentStartDate: '2026-10-10', currentEndDate: '2026-10-12', proposedStartDate: '2026-10-13', proposedEndDate: '2026-10-15', shiftDays: 3 },
      { taskId: 'c', currentStartDate: '2026-10-13', currentEndDate: '2026-10-15', proposedStartDate: '2026-10-16', proposedEndDate: '2026-10-18', shiftDays: 3 },
    ] }))
    expect(history.list('project').filter((entry) => entry.kind === 'schedule-shift-applied')).toHaveLength(1)
    expect((history.list('project')[0].after?.tasks as unknown[])).toHaveLength(2)
  })
})
