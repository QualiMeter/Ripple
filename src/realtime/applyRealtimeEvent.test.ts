import { describe, expect, it, vi } from 'vitest'
import type { RealtimeEntityLoaders } from './applyRealtimeEvent'
import { applyRealtimeEvent } from './applyRealtimeEvent'
import type { RealtimeEvent } from './realtimeTypes'
import type { ProjectWorkspace } from '../types/workspace'

function workspace(): ProjectWorkspace {
  return {
    project: { id: 'project', creatorId: 'owner', name: 'Проект', description: '', startDate: '2026-10-01', targetEndDate: '2026-10-31', projectedEndDate: '2026-10-31', ownerName: 'Менеджер', health: 'on-track', progress: 0, taskCount: 2, completedTaskCount: 0 },
    tasks: [
      { id: 'a', projectId: 'project', title: 'A', startDate: '2026-10-01', endDate: '2026-10-02', plannedStartDate: '2026-10-01', plannedEndDate: '2026-10-02', durationDays: 2, progress: 0, assigneeId: 'e1', status: 'not-started', riskState: 'none', isCritical: false },
      { id: 'b', projectId: 'project', title: 'B', startDate: '2026-10-03', endDate: '2026-10-04', plannedStartDate: '2026-10-03', plannedEndDate: '2026-10-04', durationDays: 2, progress: 0, assigneeId: 'e1', status: 'not-started', riskState: 'none', isCritical: false },
    ],
    dependencies: [{ id: 'dependency:a:b', projectId: 'project', predecessorTaskId: 'a', successorTaskId: 'b', type: 'finish-to-start' }],
    assignees: [{ id: 'e1', projectId: 'project', name: 'Анна' }],
    impact: { sourceTaskId: '', lastChange: { kind: 'session-started' }, affectedTaskIds: [], criticalTaskIds: ['a', 'b'], slackDaysByTaskId: { a: 0, b: 0 }, atRiskTaskIds: [], previousProjectEndDate: '2026-10-31', projectedProjectEndDate: '2026-10-31', projectEndChangeDays: 0, deadlineShiftDays: 0, requiresIntervention: false, reasons: [], analyzedAt: '2026-09-27T00:00:00Z' },
    currentIssues: { scheduleConflicts: [], statusConflicts: [], deadlineIssues: [], affectedTaskIds: [] },
    projectBoundaryIssues: [], recoveryScenarios: [],
  }
}

function event(entity: string, action: string, entityId: string | null, data: unknown): RealtimeEvent {
  return { eventId: `${entity}-${action}`, projectId: 'project', entity, action, entityId, data, occurredAt: '2026-09-27T00:00:00Z' }
}

const unusedLoaders = {
  getTask: vi.fn(), getEmployee: vi.fn(), listDependencies: vi.fn(), getWorkspace: vi.fn(),
} as unknown as RealtimeEntityLoaders

describe('applyRealtimeEvent', () => {
  it('updates only the matching task and removes task edges on delete', async () => {
    const initial = workspace()
    const updated = await applyRealtimeEvent(initial, event('task', 'updated', 'a', {
      id: 'a', projectId: 'project', name: 'A+', startDate: '2026-10-01', endDate: '2026-10-02', durationCalendarDays: 2, assigneeId: 'e1', assigneeName: 'Анна', status: 'NotStarted',
    }), unusedLoaders)
    expect(updated.tasks.find((task) => task.id === 'a')?.title).toBe('A+')
    expect(updated.tasks.find((task) => task.id === 'b')).toBe(initial.tasks[1])

    const deleted = await applyRealtimeEvent(updated, event('task', 'deleted', 'a', null), unusedLoaders)
    expect(deleted.tasks.map((task) => task.id)).toEqual(['b'])
    expect(deleted.dependencies).toEqual([])
  })

  it('updates an employee delta', async () => {
    const result = await applyRealtimeEvent(workspace(), event('employee', 'updated', 'e1', { id: 'e1', projectId: 'project', name: 'Ирина', phone: null, email: null }), unusedLoaders)
    expect(result.assignees[0].name).toBe('Ирина')
  })

  it('creates and deletes a dependency delta', async () => {
    const initial = { ...workspace(), dependencies: [] }
    const data = { projectId: 'project', predecessorTaskId: 'a', successorTaskId: 'b', predecessorTaskName: 'A', successorTaskName: 'B' }
    const created = await applyRealtimeEvent(initial, event('task_dependency', 'created', null, data), unusedLoaders)
    expect(created.dependencies).toHaveLength(1)
    const deleted = await applyRealtimeEvent(created, event('dependency', 'deleted', null, data), unusedLoaders)
    expect(deleted.dependencies).toEqual([])
  })

  it('patches project fields and ignores unknown entities', async () => {
    const initial = workspace()
    const updated = await applyRealtimeEvent(initial, event('project', 'updated', 'project', { name: 'Новый проект', endDate: '2026-11-05' }), unusedLoaders)
    expect(updated.project).toMatchObject({ name: 'Новый проект', targetEndDate: '2026-11-05' })
    expect(await applyRealtimeEvent(updated, event('future-entity', 'created', null, {}), unusedLoaders)).toBe(updated)
  })

  it('uses a targeted task GET when event data is incomplete', async () => {
    const loaders = {
      ...unusedLoaders,
      getTask: vi.fn().mockResolvedValue({ ...workspace().tasks[0], title: 'Через GET' }),
    } as RealtimeEntityLoaders
    const result = await applyRealtimeEvent(workspace(), event('task', 'updated', 'a', { id: 'a' }), loaders)
    expect(loaders.getTask).toHaveBeenCalledWith('project', 'a')
    expect(result.tasks[0].title).toBe('Через GET')
  })

  it('upserts restored tasks and dependencies that are currently absent', async () => {
    const initial = { ...workspace(), tasks: workspace().tasks.filter((task) => task.id !== 'b'), dependencies: [] }
    const restoredTask = await applyRealtimeEvent(initial, event('task', 'restored', 'b', {
      id: 'b', projectId: 'project', name: 'B', startDate: '2026-10-03', endDate: '2026-10-04', durationCalendarDays: 2, assigneeId: 'e1', assigneeName: 'Анна', status: 'NotStarted',
    }), unusedLoaders)
    expect(restoredTask.tasks.map((task) => task.id)).toContain('b')
    const restoredDependency = await applyRealtimeEvent(restoredTask, event('dependency', 'restored', null, {
      projectId: 'project', predecessorTaskId: 'a', successorTaskId: 'b', predecessorTaskName: 'A', successorTaskName: 'B',
    }), unusedLoaders)
    expect(restoredDependency.dependencies).toHaveLength(1)
  })
})
