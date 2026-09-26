import { afterEach, describe, expect, it, vi } from 'vitest'
import { httpProjectsApi } from '../projects.api'
import { httpScheduleApi } from '../schedule.api'
import { httpEmployeesApi } from '../employees.api'

const projectDetails = {
  id: 'project-1', name: 'Проект', startDate: '2026-10-01', endDate: '2026-10-20', creatorId: 'user-1',
  employees: [], tasks: [], dependencies: [], boundaryWarnings: [],
}

describe('HTTP adapters', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('uses the documented full PUT project contract', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(projectDetails), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...projectDetails, name: 'Новое имя' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await httpProjectsApi.updateProject('project-1', { name: 'Новое имя' })
    expect(fetchMock.mock.calls[1][0]).toMatch(/\/api\/v1\/projects\/project-1$/)
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'PUT' })
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ name: 'Новое имя', startDate: '2026-10-01', endDate: '2026-10-20' })
  })

  it('requests shift preview from the explicitly selected source task', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ rootTaskId: 'task-a', items: [], currentProjectEndDate: '2026-10-20', proposedProjectEndDate: '2026-10-20', projectEndIncreaseCalendarDays: 0, analysis: [] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await httpScheduleApi.previewShift('project-1', { sourceTaskId: 'task-a' })
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/api\/v1\/projects\/project-1\/tasks\/task-a\/shift-preview$/)
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST' })
    expect(fetchMock.mock.calls[0][1].body).toBeUndefined()
  })

  it('uses the documented project list, detail and employee URLs', async () => {
    const urls: string[] = []
    vi.stubGlobal('fetch', vi.fn((input: string | URL | Request) => {
      const url = String(input)
      urls.push(url)
      if (url.endsWith('/api/v1/projects')) return Promise.resolve(new Response(JSON.stringify([{ id: 'project-1', name: 'Проект', startDate: '2026-10-01', endDate: '2026-10-20', creatorId: 'user-1', taskCount: 0, employeeCount: 0 }]), { status: 200 }))
      if (url.endsWith('/api/v1/users')) return Promise.resolve(new Response(JSON.stringify([{ id: 'user-1', name: 'Менеджер', email: 'm@example.test' }]), { status: 200 }))
      if (url.endsWith('/api/v1/projects/project-1/employees')) return Promise.resolve(new Response('[]', { status: 200 }))
      return Promise.resolve(new Response(JSON.stringify(projectDetails), { status: 200 }))
    }))
    await httpProjectsApi.listProjects()
    await httpEmployeesApi.listEmployees('project-1')
    expect(urls.some((url) => url.endsWith('/api/v1/projects'))).toBe(true)
    expect(urls.some((url) => url.endsWith('/api/v1/projects/project-1'))).toBe(true)
    expect(urls.some((url) => url.endsWith('/api/v1/projects/project-1/employees'))).toBe(true)
  })

  it('confirms a shift without changing the project target date', async () => {
    const fetchMock = vi.fn((input: string | URL | Request, _init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/shift-confirm')) return Promise.resolve(new Response(JSON.stringify({
        preview: { rootTaskId: 'task-a', items: [], currentProjectEndDate: '2026-10-20', proposedProjectEndDate: '2026-10-20', projectEndIncreaseCalendarDays: 0, analysis: [] },
        projectEndDateChanged: false,
      }), { status: 200 }))
      if (url.endsWith('/api/v1/users')) return Promise.resolve(new Response('[]', { status: 200 }))
      return Promise.resolve(new Response(JSON.stringify(projectDetails), { status: 200 }))
    })
    vi.stubGlobal('fetch', fetchMock)
    await httpScheduleApi.applyShift('project-1', { projectId: 'project-1', sourceTaskId: 'task-a', taskShifts: [], currentProjectEndDate: '2026-10-20', proposedProjectEndDate: '2026-10-20', projectEndShiftDays: 0 })
    const confirmCall = fetchMock.mock.calls.find(([input]) => String(input).endsWith('/api/v1/projects/project-1/tasks/task-a/shift-confirm'))
    expect(confirmCall?.[1]).toMatchObject({ method: 'POST', body: JSON.stringify({ confirmProjectEndDate: false }) })
  })
})
