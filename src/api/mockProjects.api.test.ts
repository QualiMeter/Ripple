import { describe, expect, it } from 'vitest'
import { mockDependenciesApi } from './mockDependencies.api'
import { mockProjectsApi } from './mockProjects.api'
import { mockTasksApi } from './mockTasks.api'

const assigneeId = 'elena'

async function createProject(name: string, startDate = '2027-01-05', targetEndDate = '2027-01-20') {
  return mockProjectsApi.createProject({ name, startDate, targetEndDate })
}

describe('mockProjectsApi', () => {
  it('создаёт валидный пустой проект', async () => {
    const project = await createProject('Проект создания')
    const workspace = await mockProjectsApi.getWorkspace(project.id)

    expect(project.creatorId).toBe('maya')
    expect(workspace.project.name).toBe('Проект создания')
    expect(workspace.project.progress).toBe(0)
    expect(workspace.project.taskCount).toBe(0)
    expect(workspace.project.projectedEndDate).toBe('2027-01-20')
    expect(workspace.tasks).toEqual([])
    expect(workspace.dependencies).toEqual([])
    expect(workspace.impact.criticalTaskIds).toEqual([])
    expect(workspace.impact.atRiskTaskIds).toEqual([])
  })

  it('запрещает проект с датой начала позже даты окончания', async () => {
    await expect(mockProjectsApi.createProject({
      name: 'Некорректный проект',
      startDate: '2027-02-10',
      targetEndDate: '2027-02-01',
    })).rejects.toThrow('Дата начала не может быть позже')
  })

  it('редактирование границ проекта не меняет даты задач', async () => {
    const project = await createProject('Проект неизменных задач')
    const task = await mockTasksApi.createTask(project.id, {
      title: 'Зафиксированная задача',
      startDate: '2027-01-07',
      endDate: '2027-01-10',
      assigneeId,
      status: 'not-started',
    })

    await mockProjectsApi.updateProject(project.id, { startDate: '2027-01-08', targetEndDate: '2027-01-09' })
    const workspace = await mockProjectsApi.getWorkspace(project.id)
    const unchangedTask = workspace.tasks.find((candidate) => candidate.id === task.id)

    expect(unchangedTask?.startDate).toBe('2027-01-07')
    expect(unchangedTask?.endDate).toBe('2027-01-10')
  })

  it('возвращает warnings для задач вне новых границ проекта', async () => {
    const project = await createProject('Проект с границами', '2027-03-05', '2027-03-10')
    const task = await mockTasksApi.createTask(project.id, {
      title: 'Задача за границами',
      startDate: '2027-03-02',
      endDate: '2027-03-14',
      assigneeId,
      status: 'not-started',
    })

    const workspace = await mockProjectsApi.getWorkspace(project.id)

    expect(workspace.projectBoundaryIssues).toEqual([expect.objectContaining({
      taskId: task.id,
      taskTitle: 'Задача за границами',
      reasons: expect.arrayContaining([
        expect.stringContaining('проект начинается'),
        expect.stringContaining('проект заканчивается'),
      ]),
    })])
  })

  it('хранит задачи, зависимости и состояние разных проектов независимо', async () => {
    const first = await createProject('Первый независимый проект', '2027-04-01', '2027-04-30')
    const second = await createProject('Второй независимый проект', '2027-05-01', '2027-05-31')
    const firstSource = await mockTasksApi.createTask(first.id, { title: 'A', startDate: '2027-04-01', endDate: '2027-04-03', assigneeId, status: 'not-started' })
    const firstSuccessor = await mockTasksApi.createTask(first.id, { title: 'B', startDate: '2027-04-04', endDate: '2027-04-06', assigneeId, status: 'not-started' })
    await mockTasksApi.createTask(second.id, { title: 'X', startDate: '2027-05-01', endDate: '2027-05-02', assigneeId, status: 'not-started' })
    await mockDependenciesApi.createDependency(first.id, {
      predecessorTaskId: firstSource.id,
      successorTaskId: firstSuccessor.id,
      type: 'finish-to-start',
    })

    const [firstWorkspace, secondWorkspace] = await Promise.all([
      mockProjectsApi.getWorkspace(first.id),
      mockProjectsApi.getWorkspace(second.id),
    ])

    expect(firstWorkspace.tasks.map((task) => task.title)).toEqual(['A', 'B'])
    expect(firstWorkspace.dependencies).toHaveLength(1)
    expect(secondWorkspace.tasks.map((task) => task.title)).toEqual(['X'])
    expect(secondWorkspace.dependencies).toEqual([])
  })
})
