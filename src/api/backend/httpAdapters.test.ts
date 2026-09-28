import { afterEach, describe, expect, it, vi } from 'vitest'
import { httpProjectsApi } from '../projects.api'
import { httpScheduleApi } from '../schedule.api'
import { httpEmployeesApi } from '../employees.api'
import { httpTasksApi } from '../tasks.api'
import { getHttpProjectSession, setHttpProjectSession } from './session'

const projectDetails = {
  id: 'project-1', name: 'Проект', startDate: '2026-10-01', endDate: '2026-10-20', creatorId: 'user-1',
  employees: [], tasks: [], dependencies: [], boundaryWarnings: [],
}

describe('HTTP adapters', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('uses the documented full PUT project contract', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...projectDetails, name: 'Новое имя' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await httpProjectsApi.updateProject('project-1', { id: 'project-1', creatorId: 'user-1', name: 'Проект', description: '', startDate: '2026-10-01', targetEndDate: '2026-10-20' }, { name: 'Новое имя' })
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/api\/v1\/projects\/project-1$/)
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'PUT' })
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ name: 'Новое имя', startDate: '2026-10-01', endDate: '2026-10-20' })
  })

  it('deletes a project through its project resource and clears session state', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    setHttpProjectSession('project-1', {
      sourceTaskId: 'task', affectedTaskIds: ['task'], lastChange: { kind: 'task-created', taskId: 'task', taskTitle: 'Задача' }, analysis: [],
    })
    await httpProjectsApi.deleteProject('project-1')
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/projects\/project-1$/),
      expect.objectContaining({ method: 'DELETE' }),
    )
    expect(getHttpProjectSession('project-1').lastChange).toEqual({ kind: 'session-started' })
  })

  it('requests shift preview from the explicitly selected source task', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ rootTaskId: 'task-a', items: [], currentProjectEndDate: '2026-10-20', proposedProjectEndDate: '2026-10-20', projectEndIncreaseCalendarDays: 0, analysis: [] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await httpScheduleApi.previewShift('project-1', { sourceTaskId: 'task-a' })
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/api\/v1\/projects\/project-1\/tasks\/task-a\/shift-preview$/)
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST' })
    expect(fetchMock.mock.calls[0][1].body).toBeUndefined()
  })

  it('loads and maps detailed task analysis without losing actions', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([{
      severity: 1,
      triggerTaskId: 'task',
      triggerTaskName: 'Backend',
      affectedTaskIds: ['frontend', 'testing'],
      affectedTaskNames: ['Frontend', 'Тестирование'],
      description: 'Конфликт до 2026-06-02.',
      actions: [
        { code: 'open-task', label: 'Открыть Frontend', targetTaskId: 'frontend' },
        { code: 'preview-shift', label: 'Рассчитать сдвиг', targetTaskId: null },
      ],
    }]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await httpTasksApi.getAnalysis('project', 'task')

    expect(new URL(String(fetchMock.mock.calls[0][0])).pathname).toBe('/api/v1/projects/project/tasks/task/analysis')
    expect(result).toEqual([{
      severity: 'warning',
      triggerTaskId: 'task',
      triggerTaskName: 'Backend',
      affectedTaskIds: ['frontend', 'testing'],
      affectedTaskNames: ['Frontend', 'Тестирование'],
      description: 'Конфликт до 02.06.2026.',
      actions: [
        { code: 'open-task', label: 'Открыть Frontend', targetTaskId: 'frontend' },
        { code: 'preview-shift', label: 'Рассчитать сдвиг', targetTaskId: null },
      ],
    }])
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
    expect(urls.some((url) => url.endsWith('/api/v1/projects/project-1'))).toBe(false)
    expect(urls.some((url) => url.endsWith('/api/v1/projects/project-1/employees'))).toBe(true)
  })

  it('loads ten sidebar projects with one list request and no detail requests', async () => {
    const projects = Array.from({ length: 10 }, (_, index) => ({
      id: `project-${index}`, name: `Проект ${index}`, startDate: '2026-10-01', endDate: '2026-10-20', creatorId: 'user-1', taskCount: index, employeeCount: 2,
    }))
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(projects), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const result = await httpProjectsApi.listProjects()
    expect(result).toHaveLength(10)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/api\/v1\/projects$/)
  })

  it('deletes an employee through the project-scoped DELETE endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    await httpEmployeesApi.deleteEmployee('project-1', 'employee-7')
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/projects\/project-1\/employees\/employee-7$/),
      expect.objectContaining({ method: 'DELETE' }),
    )
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
    await httpScheduleApi.applyShift('project-1', { projectId: 'project-1', sourceTaskId: 'task-a', taskShifts: [], currentProjectEndDate: '2026-10-20', proposedProjectEndDate: '2026-10-20', projectEndShiftDays: 0 }, { confirmProjectEndDate: false })
    const confirmCall = fetchMock.mock.calls.find(([input]) => String(input).endsWith('/api/v1/projects/project-1/tasks/task-a/shift-confirm'))
    expect(confirmCall?.[1]).toMatchObject({ method: 'POST', body: JSON.stringify({ confirmProjectEndDate: false }) })
  })

  it('sends confirmProjectEndDate=true only when explicitly requested', async () => {
    const fetchMock = vi.fn((input: string | URL | Request, _init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/shift-confirm')) return Promise.resolve(new Response(JSON.stringify({
        preview: { rootTaskId: 'task-a', items: [], currentProjectEndDate: '2026-10-20', proposedProjectEndDate: '2026-10-23', projectEndIncreaseCalendarDays: 3, analysis: [] },
        projectEndDateChanged: true,
      }), { status: 200 }))
      return Promise.resolve(new Response(JSON.stringify(projectDetails), { status: 200 }))
    })
    vi.stubGlobal('fetch', fetchMock)
    const preview = { projectId: 'project-1', sourceTaskId: 'task-a', taskShifts: [], currentProjectEndDate: '2026-10-20', proposedProjectEndDate: '2026-10-23', projectEndShiftDays: 3 }
    await httpScheduleApi.applyShift('project-1', preview, { confirmProjectEndDate: true })
    const confirmCall = fetchMock.mock.calls.find(([input]) => String(input).endsWith('/shift-confirm'))
    expect(JSON.parse(String(confirmCall?.[1]?.body))).toEqual({ confirmProjectEndDate: true })
  })
})
