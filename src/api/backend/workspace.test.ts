import { afterEach, describe, expect, it, vi } from 'vitest'
import { composeHttpWorkspace } from './workspace'

function response(body: unknown) { return Promise.resolve(new Response(JSON.stringify(body), { status: 200 })) }

describe('HTTP workspace composition', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('builds a safe empty project workspace', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => url.endsWith('/users')
      ? response([{ id: 'u', name: 'Менеджер', email: 'manager@example.test' }])
      : response({ id: 'empty', creatorId: 'u', name: 'Пустой', startDate: '2026-10-01', endDate: '2026-10-20', employees: [], tasks: [], dependencies: [], boundaryWarnings: [] })))
    const workspace = await composeHttpWorkspace('empty')
    expect(workspace.project).toMatchObject({ taskCount: 0, progress: 0, projectedEndDate: '2026-10-20' })
    expect(workspace.impact.criticalTaskIds).toEqual([])
    expect(workspace.impact.lastChange).toEqual({ kind: 'session-started' })
  })

  it('maps employees, tasks and dependencies before running local analytics', async () => {
    vi.stubGlobal('fetch', vi.fn(() => response({
      id: 'full', creatorId: 'u', name: 'Полный', startDate: '2026-10-01', endDate: '2026-10-20', boundaryWarnings: [],
      employees: [{ id: 'e', projectId: 'full', name: 'Анна', taskCount: 2 }],
      tasks: [
        { id: 'a', projectId: 'full', name: 'A', startDate: '2026-10-01', endDate: '2026-10-03', durationCalendarDays: 3, assigneeId: 'e', assigneeName: 'Анна', status: 'Completed' },
        { id: 'b', projectId: 'full', name: 'B', startDate: '2026-10-04', endDate: '2026-10-10', durationCalendarDays: 7, assigneeId: 'e', assigneeName: 'Анна', status: 'NotStarted' },
      ],
      dependencies: [{ projectId: 'full', predecessorTaskId: 'a', successorTaskId: 'b', predecessorTaskName: 'A', successorTaskName: 'B' }],
    })))
    const workspace = await composeHttpWorkspace('full')
    expect(workspace.assignees).toHaveLength(1)
    expect(workspace.tasks.map((task) => task.title)).toEqual(['A', 'B'])
    expect(workspace.dependencies[0]).toMatchObject({ predecessorTaskId: 'a', successorTaskId: 'b' })
    expect(workspace.project).toMatchObject({ taskCount: 2, completedTaskCount: 1, progress: 50, projectedEndDate: '2026-10-10' })
  })
})
