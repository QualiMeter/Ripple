import { afterEach, describe, expect, it, vi } from 'vitest'
import { httpDependenciesApi } from '../dependencies.api'
import { httpEmployeesApi } from '../employees.api'
import { httpTasksApi } from '../tasks.api'

function json(value: unknown) { return Promise.resolve(new Response(JSON.stringify(value), { status: 200 })) }

const taskDto = { id: 'task', projectId: 'project', name: 'Задача', startDate: '2026-10-01', endDate: '2026-10-02', durationCalendarDays: 2, assigneeId: 'employee', assigneeName: 'Анна', status: 'NotStarted', predecessorIds: [], successorIds: [] }
const currentTask = { id: 'task', projectId: 'project', title: 'Задача', startDate: '2026-10-01', endDate: '2026-10-02', plannedStartDate: '2026-10-01', plannedEndDate: '2026-10-02', durationDays: 2, progress: 0, assigneeId: 'employee', status: 'not-started' as const, riskState: 'none' as const, isCritical: false }

describe('HTTP mutation request counts', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('updates a task with one PUT and no project refetch', async () => {
    const fetchMock = vi.fn(() => json({ task: { ...taskDto, name: 'Новая' }, analysis: [] }))
    vi.stubGlobal('fetch', fetchMock)
    await httpTasksApi.updateTask('project', 'task', currentTask, { title: 'Новая' })
    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(calls[0][0]).toMatch(/\/tasks\/task$/)
    expect(calls[0][1]).toMatchObject({ method: 'PUT' })
  })

  it('creates a dependency with one POST and no project refetch', async () => {
    const dependency = { projectId: 'project', predecessorTaskId: 'a', successorTaskId: 'b', predecessorTaskName: 'A', successorTaskName: 'B' }
    const fetchMock = vi.fn(() => json({ dependency, analysis: [] }))
    vi.stubGlobal('fetch', fetchMock)
    await httpDependenciesApi.createDependency('project', { predecessorTaskId: 'a', successorTaskId: 'b', type: 'finish-to-start' })
    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(calls[0][1]).toMatchObject({ method: 'POST' })
  })

  it('updates and deletes employees without a workspace fetch', async () => {
    const employee = { id: 'employee', projectId: 'project', name: 'Анна', phone: null, email: null, taskCount: 0 }
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => json({ ...employee, name: 'Ирина' }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    await httpEmployeesApi.updateEmployee('project', 'employee', employee, { name: 'Ирина' })
    await httpEmployeesApi.deleteEmployee('project', 'employee')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls.every(([input]) => !String(input).endsWith('/api/v1/projects/project'))).toBe(true)
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ name: 'Ирина', phone: null, email: null })
  })
})
