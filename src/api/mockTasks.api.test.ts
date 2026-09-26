import { describe, expect, it } from 'vitest'
import { getMockProjectState } from '../mocks/workspaceStore'
import { mockDependenciesApi } from './mockDependencies.api'
import { mockTasksApi } from './mockTasks.api'

const assigneeId = 'owner'

describe('mockTasksApi', () => {
  it('создаёт задачу с введёнными planned dates', async () => {
    const projectId = 'task-create-test'
    const created = await mockTasksApi.createTask(projectId, {
      title: 'Новая задача',
      startDate: '2026-02-02',
      endDate: '2026-02-05',
      durationDays: 4,
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

    await mockTasksApi.deleteTask(predecessor.id)

    const state = getMockProjectState(projectId)
    expect(state.tasks.some((task) => task.id === predecessor.id)).toBe(false)
    expect(state.dependencies.some((dependency) => (
      dependency.predecessorTaskId === predecessor.id
      || dependency.successorTaskId === predecessor.id
    ))).toBe(false)
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
})
