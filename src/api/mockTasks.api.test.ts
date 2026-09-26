import { describe, expect, it } from 'vitest'
import { getMockProjectState } from '../mocks/workspaceStore'
import { mockDependenciesApi } from './mockDependencies.api'
import { mockTasksApi } from './mockTasks.api'
import { mockScheduleApi } from './mockSchedule.api'
import { buildCurrentProjectIssues } from '../services/scheduleEngine'
import { getSchedulePreviewSourceIds } from '../services/schedulePreviewSource'
import { mockProjectsApi } from './mockProjects.api'
import { mockEmployeesApi } from './mockEmployees.api'

async function createTaskProject(name: string) {
  const project = await mockProjectsApi.createProject({ name, startDate: '2026-01-01', targetEndDate: '2026-12-31' })
  const owner = await mockEmployeesApi.createEmployee(project.id, { name: 'Первый сотрудник' })
  const alternate = await mockEmployeesApi.createEmployee(project.id, { name: 'Второй сотрудник' })
  return { projectId: project.id, owner, alternate }
}

describe('mockTasksApi', () => {
  it('создаёт задачу с введёнными planned dates', async () => {
    const { projectId, owner } = await createTaskProject('Тест создания задачи')
    const created = await mockTasksApi.createTask(projectId, {
      title: 'Новая задача',
      startDate: '2026-02-02',
      endDate: '2026-02-05',
      assigneeId: owner.id,
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
    const { projectId, owner } = await createTaskProject('Тест удаления задачи')
    const predecessor = await mockTasksApi.createTask(projectId, {
      title: 'Предшественник',
      startDate: '2026-02-02',
      endDate: '2026-02-03',
      assigneeId: owner.id,
      status: 'not-started',
    })
    const successor = await mockTasksApi.createTask(projectId, {
      title: 'Зависимая задача',
      startDate: '2026-02-04',
      endDate: '2026-02-05',
      assigneeId: owner.id,
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
    const { projectId, owner, alternate } = await createTaskProject('Тест контекста задачи')
    const created = await mockTasksApi.createTask(projectId, {
      title: 'Контекст изменения',
      startDate: '2026-03-02',
      endDate: '2026-03-04',
      assigneeId: owner.id,
      status: 'not-started',
    })

    await mockTasksApi.updateTask(created.id, { status: 'in-progress', assigneeId: alternate.id })

    const state = getMockProjectState(projectId)
    expect(state.lastChange).toMatchObject({
      kind: 'task-updated',
      changes: [
        { field: 'assigneeId', previousValue: owner.id, nextValue: alternate.id },
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
    const { projectId, owner } = await createTaskProject('Тест явного источника сдвига')
    const source = await mockTasksApi.createTask(projectId, {
      title: 'Задача A', startDate: '2026-04-01', endDate: '2026-04-02', assigneeId: owner.id, status: 'in-progress',
    })
    const successor = await mockTasksApi.createTask(projectId, {
      title: 'Зависимая задача B', startDate: '2026-04-03', endDate: '2026-04-04', assigneeId: owner.id, status: 'not-started',
    })
    await mockDependenciesApi.createDependency(projectId, {
      predecessorTaskId: source.id, successorTaskId: successor.id, type: 'finish-to-start',
    })
    await mockTasksApi.updateTask(source.id, { endDate: '2026-04-05' })

    const stateWithConflict = getMockProjectState(projectId)
    expect(buildCurrentProjectIssues(stateWithConflict.tasks, stateWithConflict.dependencies).scheduleConflicts).toHaveLength(1)

    const independent = await mockTasksApi.createTask(projectId, {
      title: 'Независимая задача X', startDate: '2026-04-01', endDate: '2026-04-01', assigneeId: owner.id, status: 'not-started',
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
