import { describe, expect, it, vi } from 'vitest'
import type { ProjectService } from '../projectService'
import type { ProjectWorkspace } from '../../types/workspace'
import { createLocalHistoryStorage } from './historyStorage'
import { ProjectHistory } from './projectHistory'
import { buildHistoryRevertPlan, executeHistoryRevert } from './historyRevert'
import type { ProjectHistoryEntry } from './historyTypes'

function memoryStorage() {
  const values = new Map<string, string>()
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
}

function workspace(endDate = '2026-10-18'): ProjectWorkspace {
  return {
    project: { id: 'project', creatorId: 'manager', name: 'Проект', description: '', startDate: '2026-10-01', targetEndDate: '2026-10-31', projectedEndDate: '2026-10-31', ownerName: 'Менеджер', health: 'on-track', progress: 0, taskCount: 1, completedTaskCount: 0 },
    tasks: [{ id: 'task', projectId: 'project', title: 'Backend', startDate: '2026-10-12', endDate, plannedStartDate: '2026-10-12', plannedEndDate: '2026-10-14', durationDays: 7, progress: 0, assigneeId: 'employee', status: 'in-progress', riskState: 'none', isCritical: false }],
    dependencies: [], assignees: [{ id: 'employee', projectId: 'project', name: 'Иван' }], recoveryScenarios: [], projectBoundaryIssues: [],
    currentIssues: { scheduleConflicts: [], statusConflicts: [], deadlineIssues: [], affectedTaskIds: [] },
    impact: { sourceTaskId: '', lastChange: { kind: 'session-started' }, affectedTaskIds: [], criticalTaskIds: [], slackDaysByTaskId: {}, atRiskTaskIds: [], previousProjectEndDate: '2026-10-31', projectedProjectEndDate: '2026-10-31', projectEndChangeDays: 0, deadlineShiftDays: 0, requiresIntervention: false, reasons: [], analyzedAt: '2026-10-01T00:00:00Z' },
  }
}

const entry: ProjectHistoryEntry = { id: 'change', projectId: 'project', createdAt: '2026-10-01T18:42:00Z', kind: 'task-updated', title: 'Изменена задача', description: 'Backend', entityType: 'task', entityId: 'task', before: { endDate: '2026-10-14' }, after: { endDate: '2026-10-18' }, revertStatus: 'available' }

describe('safe history revert', () => {
  it('blocks revert when a field was changed after the selected event', () => {
    const plan = buildHistoryRevertPlan(entry, workspace('2026-10-21'))
    expect(plan.allowed).toBe(false)
    expect(plan.reason).toContain('изменены позже')
    expect(plan.changes[0]).toMatchObject({ current: '2026-10-21', next: '2026-10-14' })
  })

  it('reverts matching data, creates a revert event and marks the original entry', async () => {
    const history = new ProjectHistory(createLocalHistoryStorage(memoryStorage()))
    history.record(entry)
    const revertedWorkspace = workspace('2026-10-14')
    const updateTask = vi.fn().mockResolvedValue(revertedWorkspace)
    const service = { updateTask, getWorkspace: vi.fn().mockResolvedValue(revertedWorkspace) } as unknown as ProjectService

    await executeHistoryRevert(entry, workspace(), service, history)

    expect(updateTask).toHaveBeenCalledWith('project', 'task', { endDate: '2026-10-14' })
    const events = history.list('project')
    expect(events.find((event) => event.id === 'change')?.revertStatus).toBe('reverted')
    expect(events.some((event) => event.kind === 'change-reverted' && event.revertsEntryId === 'change')).toBe(true)
  })
})
