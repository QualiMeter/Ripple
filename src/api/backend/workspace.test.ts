import { afterEach, describe, expect, it, vi } from 'vitest'
import { composeHttpWorkspace } from './workspace'
import { clearHttpProjectSessions, setHttpProjectSession } from './session'

function response(body: unknown) { return Promise.resolve(new Response(JSON.stringify(body), { status: 200 })) }

describe('HTTP workspace composition', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    clearHttpProjectSessions()
  })

  it('builds a safe empty project workspace', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => url.endsWith('/users')
      ? response([{ id: 'u', name: 'Менеджер', email: 'manager@example.test' }])
      : response({ id: 'empty', creatorId: 'u', name: 'Пустой', startDate: '2026-10-01', endDate: '2026-10-20', employees: [], tasks: [], dependencies: [], boundaryWarnings: [] })))
    const workspace = await composeHttpWorkspace('empty')
    expect(workspace.project).toMatchObject({ taskCount: 0, progress: 0, projectedEndDate: '2026-10-20' })
    expect(workspace.impact.criticalTaskIds).toEqual([])
    expect(workspace.impact.lastChange).toEqual({ kind: 'session-started' })
  })

  it('loads an opened project with one project-details request', async () => {
    const fetchMock = vi.fn((url: string) => url.endsWith('/users')
      ? response([{ id: 'u', name: 'Менеджер', email: 'manager@example.test' }])
      : response({ id: 'opened', creatorId: 'u', name: 'Открытый', startDate: '2026-10-01', endDate: '2026-10-20', employees: [], tasks: [], dependencies: [], boundaryWarnings: [] }))
    vi.stubGlobal('fetch', fetchMock)
    await composeHttpWorkspace('opened')
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/api/v1/projects/opened'))).toHaveLength(1)
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

  it('keeps refetched local status consistency authoritative over contradictory backend analysis', async () => {
    setHttpProjectSession('consistency', {
      sourceTaskId: 'b',
      affectedTaskIds: ['b'],
      lastChange: {
        kind: 'task-updated', taskId: 'b', taskTitle: 'B',
        changes: [{ field: 'status', previousValue: 'not-started', nextValue: 'in-progress' }],
      },
      analysis: [{
        severity: 'info', sourceTaskId: 'a', affectedTaskIds: ['b'],
        reason: 'Все предшественники задачи B закончены.', consequence: 'Можно начинать.',
      }],
      previousProjectEndDate: '2026-10-10',
    })
    vi.stubGlobal('fetch', vi.fn((url: string) => url.endsWith('/users')
      ? response([{ id: 'u', name: 'Менеджер', email: 'manager@example.test' }])
      : response({
        id: 'consistency', creatorId: 'u', name: 'Consistency', startDate: '2026-10-01', endDate: '2026-10-20', boundaryWarnings: [], employees: [],
        tasks: [
          { id: 'a', projectId: 'consistency', name: 'A', startDate: '2026-10-01', endDate: '2026-10-02', durationCalendarDays: 2, assigneeId: 'e', assigneeName: 'Анна', status: 'NotStarted' },
          { id: 'b', projectId: 'consistency', name: 'B', startDate: '2026-10-03', endDate: '2026-10-10', durationCalendarDays: 8, assigneeId: 'e', assigneeName: 'Анна', status: 'InProgress' },
        ],
        dependencies: [{ projectId: 'consistency', predecessorTaskId: 'a', successorTaskId: 'b', predecessorTaskName: 'A', successorTaskName: 'B' }],
      })))

    const workspace = await composeHttpWorkspace('consistency')
    expect(workspace.impact.reasons.some((reason) => reason.reason.includes('начата до завершения всех предшественников'))).toBe(true)
    expect(workspace.impact.reasons.some((reason) => reason.reason.includes('Все предшественники'))).toBe(false)
  })
})
