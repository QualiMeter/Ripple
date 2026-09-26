import { describe, expect, it } from 'vitest'
import { dependencyDeletePath, dependencyId, fromBackendTaskStatus, mapDependency, mapEmployee, mapProject, mapShiftPreview, mapTask, toBackendTaskStatus, toCreateProjectDto, toCreateTaskDto, toUpdateProjectDto } from './mappers'

describe('backend mappers', () => {
  it('maps project endDate to targetEndDate and back for creation', () => {
    const project = mapProject({ id: 'p', creatorId: 'u', name: 'Проект', startDate: '2026-10-01', endDate: '2026-10-20', employees: [], tasks: [], dependencies: [], boundaryWarnings: [] })
    expect(project).toMatchObject({ targetEndDate: '2026-10-20', description: '' })
    expect(toCreateProjectDto({ name: project.name, startDate: project.startDate, targetEndDate: project.targetEndDate })).toEqual({ name: 'Проект', startDate: '2026-10-01', endDate: '2026-10-20' })
  })

  it('converts every live task status in both directions', () => {
    expect(fromBackendTaskStatus('NotStarted')).toBe('not-started')
    expect(fromBackendTaskStatus('InProgress')).toBe('in-progress')
    expect(fromBackendTaskStatus('Completed')).toBe('completed')
    expect(fromBackendTaskStatus('Delayed')).toBe('delayed')
    expect(toBackendTaskStatus('in-progress')).toBe('InProgress')
  })

  it('keeps the first fetched dates as a session-only task baseline', () => {
    const base = { id: 'task-map', projectId: 'project', name: 'Задача', startDate: '2026-10-01', endDate: '2026-10-03', durationCalendarDays: 3, assigneeId: 'employee', assigneeName: 'Анна', status: 'NotStarted' }
    expect(mapTask(base).plannedEndDate).toBe('2026-10-03')
    expect(mapTask({ ...base, endDate: '2026-10-08' }).plannedEndDate).toBe('2026-10-03')
    expect(mapTask(base).title).toBe('Задача')
    expect(toCreateTaskDto({ title: 'Новая задача', startDate: '2026-10-01', endDate: '2026-10-02', assigneeId: 'employee', status: 'not-started' }).name).toBe('Новая задача')
  })

  it('maps a project-scoped employee', () => {
    expect(mapEmployee({ id: 'e', projectId: 'p', name: 'Анна', taskCount: 2 })).toEqual({ id: 'e', projectId: 'p', name: 'Анна' })
  })

  it('maps delayed status to risk without using legacy critical flags', () => {
    const task = mapTask({ id: 'delayed', projectId: 'project', name: 'Задача', startDate: '2026-10-01', endDate: '2026-10-03', durationCalendarDays: '3', assigneeId: 'employee', assigneeName: 'Анна', status: 'Delayed' })
    expect(task.riskState).toBe('at-risk')
    expect(task.isCritical).toBe(false)
  })

  it('creates deterministic dependency ids and maps shift manual-resolution flags', () => {
    const dependency = mapDependency({ projectId: 'project', predecessorTaskId: 'a', successorTaskId: 'b', predecessorTaskName: 'A', successorTaskName: 'B' })
    expect(dependency.id).toBe(dependencyId('a', 'b'))
    expect(dependencyDeletePath('project', dependency)).toBe('/api/v1/projects/project/dependencies/a/b')
    const preview = mapShiftPreview('project', { rootTaskId: 'a', currentProjectEndDate: '2026-10-03', proposedProjectEndDate: '2026-10-05', projectEndIncreaseCalendarDays: '2', analysis: [], items: [{ taskId: 'b', taskName: 'B', originalStartDate: '2026-10-02', originalEndDate: '2026-10-03', proposedStartDate: '2026-10-04', proposedEndDate: '2026-10-05', shiftCalendarDays: '2', completedRequiresManualResolution: true, reason: 'Факт' }] })
    expect(preview.taskShifts[0]).toMatchObject({ shiftDays: 2, completedRequiresManualResolution: true })
  })

  it('assembles the full backend project PUT object from a partial UI patch', () => {
    expect(toUpdateProjectDto({ id: 'p', creatorId: 'u', name: 'До', description: '', startDate: '2026-01-01', targetEndDate: '2026-02-01' }, { name: 'После' })).toEqual({ name: 'После', startDate: '2026-01-01', endDate: '2026-02-01' })
  })
})
