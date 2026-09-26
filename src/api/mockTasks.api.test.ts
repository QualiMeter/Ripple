import { describe, expect, it } from 'vitest'
import { getMockProjectState } from '../mocks/workspaceStore'
import { mockDependenciesApi } from './mockDependencies.api'
import { mockTasksApi } from './mockTasks.api'
import { mockScheduleApi } from './mockSchedule.api'
import { buildCurrentProjectIssues } from '../services/scheduleEngine'
import { getSchedulePreviewSourceIds } from '../services/schedulePreviewSource'

const assigneeId = 'owner'

describe('mockTasksApi', () => {
  it('создаёт задачу с введёнными planned dates', async () => {
    const projectId = 'task-create-test'
    const created = await mockTasksApi.createTask(projectId, {
      title: 'Новая задача',
      startDate: '2026-02-02',
      endDate: '2026-02-05',
      assigneeId,
      status: 'not-started',
    })

    expect(created).toMatchObject({
      projectId,
      plannedStartDate: '2026-02-02',
      plannedEndDate: '2026-02-05',
      startDate: '2026-02-02',
      endDate: '2026-02-05',
    })
    expect(getMockProjectState(projectId).tasks).toContainEqual(created)
  })

  it('при удалении задачи удаляет все связанные зависимости', async () => {
    const projectId = 'task-delete-test'
    const predecessor = await mockTasksApi.createTask(projectId, {
      title: 'Предшественник',
      startDate: '2026-02-02',
      endDate: '2026-02-03',
      assigneeId,
      status: 'not-started',
    })
    const successor = await mockTasksApi.createTask(projectId, {
      title: 'Зависимая задача',
      startDate: '2026-02-04',
      endDate: '2026-02-05',
      assigneeId,
      status: 'not-started',
    })
    await mockDependenciesApi.createDependency(projectId, {
      predecessorTaskId: predecessor.id,
      successorTaskId: successor.id,
      type: 'finish-to-start',
    })

    expect(getMockProjectState(projectId).tasks.find((task) => task.id === successor.id)).toMatchObject({
      startDate: '2026-02-04',
      endDate: '2026-02-05',
    })

    await mockTasksApi.deleteTask(predecessor.id)

    const state = getMockProjectState(projectId)
    expect(state.tasks.some((task) => task.id === predecessor.id)).toBe(false)
    expect(state.dependencies.some((dependency) => (
      dependency.predecessorTaskId === predecessor.id
      || dependency.successorTaskId === predecessor.id
    ))).toBe(false)
    expect(state.tasks.find((task) => task.id === successor.id)).toMatchObject({
      startDate: '2026-02-04',
      endDate: '2026-02-05',
    })
  })

  it('сохраняет status и assignee в change context без изменения сроков', async () => {
    const projectId = 'task-context-test'
    const created = await mockTasksApi.createTask(projectId, {
      title: 'Контекст изменения',
      startDate: '2026-03-02',
      endDate: '2026-03-04',
      assigneeId: 'lena',
      status: 'not-started',
    })

    await mockTasksApi.updateTask(created.id, { status: 'in-progress', assigneeId: 'sam' })

    const state = getMockProjectState(projectId)
    expect(state.lastChange).toMatchObject({
      kind: 'task-updated',
      changes: [
        { field: 'assigneeId', previousValue: 'lena', nextValue: 'sam' },
        { field: 'status', previousValue: 'not-started', nextValue: 'in-progress' },
      ],
    })
    expect(state.affectedTaskIds).toEqual([])
    expect(state.tasks.find((task) => task.id === created.id)).toMatchObject({
      startDate: '2026-03-02',
      endDate: '2026-03-04',
    })
  })

  it('рассчитывает preview для явного source после создания независимой задачи', async () => {
    const projectId = 'explicit-shift-source-test'
    const source = await mockTasksApi.createTask(projectId, {
      title: 'Задача A', startDate: '2026-04-01', endDate: '2026-04-02', assigneeId, status: 'in-progress',
    })
    const successor = await mockTasksApi.createTask(projectId, {
      title: 'Зависимая задача B', startDate: '2026-04-03', endDate: '2026-04-04', assigneeId, status: 'not-started',
    })
    await mockDependenciesApi.createDependency(projectId, {
      predecessorTaskId: source.id, successorTaskId: successor.id, type: 'finish-to-start',
    })
    await mockTasksApi.updateTask(source.id, { endDate: '2026-04-05' })

    const stateWithConflict = getMockProjectState(projectId)
    expect(buildCurrentProjectIssues(stateWithConflict.tasks, stateWithConflict.dependencies).scheduleConflicts).toHaveLength(1)

    const independent = await mockTasksApi.createTask(projectId, {
      title: 'Независимая задача X', startDate: '2026-04-01', endDate: '2026-04-01', assigneeId, status: 'not-started',
    })
    const currentState = getMockProjectState(projectId)
    expect(currentState.lastChangedTaskId).toBe(independent.id)
    const currentIssues = buildCurrentProjectIssues(currentState.tasks, currentState.dependencies)
    expect(currentIssues.scheduleConflicts).toHaveLength(1)
    expect(getSchedulePreviewSourceIds(currentIssues)).toEqual([source.id])
    expect(getSchedulePreviewSourceIds(currentIssues)).not.toContain(independent.id)

    const preview = await mockScheduleApi.previewShift(projectId, { sourceTaskId: source.id })
    expect(preview.sourceTaskId).toBe(source.id)
    expect(preview.taskShifts).toEqual([
      expect.objectContaining({ taskId: successor.id, proposedStartDate: '2026-04-06', proposedEndDate: '2026-04-07' }),
    ])
  })
})
