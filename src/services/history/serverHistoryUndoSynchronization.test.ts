import { afterEach, describe, expect, it, vi } from 'vitest'
import type { HistoryApi } from '../../api/history.api'
import type { ProjectWorkspace } from '../../types/workspace'
import { ServerHistorySession } from './serverHistorySession'
import { undoServerHistoryAndSynchronize } from './serverHistoryActions'

function workspace(taskStartDate: string, taskEndDate: string, targetEndDate: string): ProjectWorkspace {
  return {
    project: {
      id: 'project', creatorId: 'manager', name: 'Проект', description: '', startDate: '2026-09-01', targetEndDate,
      projectedEndDate: taskEndDate, ownerName: 'Менеджер', health: 'on-track', progress: 0, taskCount: 1, completedTaskCount: 0,
    },
    tasks: [{
      id: 'task-b', projectId: 'project', title: 'B', startDate: taskStartDate, endDate: taskEndDate,
      plannedStartDate: '2026-09-14', plannedEndDate: '2026-09-16', durationDays: 3, progress: 0,
      assigneeId: 'employee', status: 'not-started', riskState: 'none', isCritical: false,
    }],
    dependencies: [],
    assignees: [{ id: 'employee', projectId: 'project', name: 'Сотрудник' }],
    impact: {
      sourceTaskId: '', lastChange: { kind: 'session-started' }, affectedTaskIds: [], criticalTaskIds: ['task-b'], slackDaysByTaskId: { 'task-b': 0 }, atRiskTaskIds: [],
      previousProjectEndDate: taskEndDate, projectedProjectEndDate: taskEndDate, projectEndChangeDays: 0, deadlineShiftDays: 0,
      requiresIntervention: false, reasons: [], analyzedAt: '2026-09-20T00:00:00.000Z',
    },
    currentIssues: { scheduleConflicts: [], statusConflicts: [], deadlineIssues: [], affectedTaskIds: [] },
    projectBoundaryIssues: [], recoveryScenarios: [],
  }
}

function historyApi(): HistoryApi {
  return {
    listHistory: vi.fn().mockResolvedValue([]),
    undoHistoryEntry: vi.fn().mockResolvedValue({
      source: 'server', id: 'shift-history', projectId: 'project', operationType: 'ScheduleShift',
      description: 'Автоматический сдвиг', createdAt: '2026-09-20T00:00:00.000Z', canUndo: false, undone: true,
    }),
  }
}

function session(): ServerHistorySession {
  const value = new ServerHistorySession()
  value.upsert('project', {
    source: 'server', id: 'shift-history', projectId: 'project', operationType: 'ScheduleShift',
    description: 'Автоматический сдвиг', createdAt: '2026-09-20T00:00:00.000Z', canUndo: true,
  })
  return value
}

afterEach(() => vi.unstubAllGlobals())

describe('server History Undo workspace synchronization', () => {
  it('restores shifted task dates immediately through one authoritative workspace GET', async () => {
    const api = historyApi()
    const restored = workspace('2026-09-14', '2026-09-16', '2026-09-20')
    const loadWorkspace = vi.fn().mockResolvedValue(restored)
    const reload = vi.fn()
    vi.stubGlobal('location', { reload })

    const result = await undoServerHistoryAndSynchronize('project', 'shift-history', api, session(), loadWorkspace)

    expect(api.undoHistoryEntry).toHaveBeenCalledWith('project', 'shift-history')
    expect(loadWorkspace).toHaveBeenCalledTimes(1)
    expect(result.workspace?.tasks[0]).toMatchObject({ startDate: '2026-09-14', endDate: '2026-09-16' })
    expect(result.workspace?.project.targetEndDate).toBe('2026-09-20')
    expect(result.entries.find((entry) => entry.id === 'shift-history')).toMatchObject({ canUndo: false, undone: true })
    expect(reload).not.toHaveBeenCalled()
  })

  it('restores both task dates and the project deadline after undoing a deadline-changing shift', async () => {
    const restored = workspace('2026-09-14', '2026-09-16', '2026-09-20')
    const result = await undoServerHistoryAndSynchronize('project', 'shift-history', historyApi(), session(), vi.fn().mockResolvedValue(restored))

    expect(result.workspace?.tasks[0].endDate).toBe('2026-09-16')
    expect(result.workspace?.project.targetEndDate).toBe('2026-09-20')
  })

  it('also synchronizes ordinary task-edit undo and keeps the successful history state if synchronization fails', async () => {
    const api = historyApi()
    const restored = workspace('2026-09-10', '2026-09-12', '2026-09-20')
    const synchronized = await undoServerHistoryAndSynchronize('project', 'shift-history', api, session(), vi.fn().mockResolvedValue(restored))
    expect(synchronized.workspace?.tasks[0]).toMatchObject({ startDate: '2026-09-10', endDate: '2026-09-12' })

    const unavailable = await undoServerHistoryAndSynchronize('project', 'shift-history', historyApi(), session(), vi.fn().mockRejectedValue(new Error('offline')))
    expect(unavailable.workspace).toBeNull()
    expect(unavailable.entries.find((entry) => entry.id === 'shift-history')?.canUndo).toBe(false)
  })
})
