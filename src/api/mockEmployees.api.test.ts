import { describe, expect, it } from 'vitest'
import { mockEmployeesApi } from './mockEmployees.api'
import { mockProjectsApi } from './mockProjects.api'
import { mockTasksApi } from './mockTasks.api'

async function createProject(name: string) {
  return mockProjectsApi.createProject({ name, startDate: '2027-06-01', targetEndDate: '2027-06-30' })
}

describe('project-scoped employees', () => {
  it('новый проект создаётся без сотрудников, после чего можно создать сотрудника и первую задачу', async () => {
    const project = await createProject('Пустой проект сотрудников')
    expect(await mockEmployeesApi.listEmployees(project.id)).toEqual([])
    expect((await mockProjectsApi.getWorkspace(project.id)).assignees).toEqual([])

    const employee = await mockEmployeesApi.createEmployee(project.id, { name: '  Анна Белова  ' })
    const task = await mockTasksApi.createTask(project.id, {
      title: 'Первая задача', startDate: '2027-06-02', endDate: '2027-06-04', assigneeId: employee.id, status: 'not-started',
    })

    expect(employee.name).toBe('Анна Белова')
    expect(task.assigneeId).toBe(employee.id)
    expect((await mockProjectsApi.getWorkspace(project.id)).tasks).toContainEqual(task)
  })

  it('справочники проектов независимы, сотрудника нельзя назначить задаче другого проекта', async () => {
    const first = await createProject('Первый проект сотрудников')
    const second = await createProject('Второй проект сотрудников')
    const firstEmployee = await mockEmployeesApi.createEmployee(first.id, { name: 'Сотрудник первого' })
    const secondEmployee = await mockEmployeesApi.createEmployee(second.id, { name: 'Сотрудник второго' })

    expect((await mockEmployeesApi.listEmployees(first.id)).map((employee) => employee.id)).toEqual([firstEmployee.id])
    expect((await mockEmployeesApi.listEmployees(second.id)).map((employee) => employee.id)).toEqual([secondEmployee.id])
    await expect(mockTasksApi.createTask(second.id, {
      title: 'Чужое назначение', startDate: '2027-06-05', endDate: '2027-06-06', assigneeId: firstEmployee.id, status: 'not-started',
    })).rejects.toThrow('сотруднику другого проекта')
  })

  it('редактирует имя сотрудника и запрещает пустое имя', async () => {
    const project = await createProject('Редактирование сотрудника')
    const employee = await mockEmployeesApi.createEmployee(project.id, { name: 'Старое имя' })

    const updated = await mockEmployeesApi.updateEmployee(employee.id, { name: '  Новое имя  ' })

    expect(updated.name).toBe('Новое имя')
    expect((await mockEmployeesApi.listEmployees(project.id))[0].name).toBe('Новое имя')
    await expect(mockEmployeesApi.updateEmployee(employee.id, { name: '   ' })).rejects.toThrow('Введите имя')
  })

  it('один сотрудник может иметь несколько задач', async () => {
    const project = await createProject('Несколько задач сотрудника')
    const employee = await mockEmployeesApi.createEmployee(project.id, { name: 'Многозадачный сотрудник' })
    await mockTasksApi.createTask(project.id, { title: 'Первая', startDate: '2027-06-01', endDate: '2027-06-02', assigneeId: employee.id, status: 'not-started' })
    await mockTasksApi.createTask(project.id, { title: 'Вторая', startDate: '2027-06-03', endDate: '2027-06-04', assigneeId: employee.id, status: 'in-progress' })

    const workspace = await mockProjectsApi.getWorkspace(project.id)
    expect(workspace.tasks.filter((task) => task.assigneeId === employee.id).map((task) => task.title)).toEqual(['Первая', 'Вторая'])
  })

  it('смена ответственного переносит принадлежность задачи, не меняя даты', async () => {
    const project = await createProject('Смена ответственного')
    const previousEmployee = await mockEmployeesApi.createEmployee(project.id, { name: 'Старый ответственный' })
    const nextEmployee = await mockEmployeesApi.createEmployee(project.id, { name: 'Новый ответственный' })
    const task = await mockTasksApi.createTask(project.id, { title: 'Передаваемая задача', startDate: '2027-06-08', endDate: '2027-06-12', assigneeId: previousEmployee.id, status: 'in-progress' })

    await mockTasksApi.updateTask(task.id, { assigneeId: nextEmployee.id })
    const workspace = await mockProjectsApi.getWorkspace(project.id)
    const updatedTask = workspace.tasks.find((candidate) => candidate.id === task.id)!

    expect(workspace.tasks.filter((candidate) => candidate.assigneeId === previousEmployee.id)).toEqual([])
    expect(workspace.tasks.filter((candidate) => candidate.assigneeId === nextEmployee.id)).toContainEqual(updatedTask)
    expect(updatedTask).toMatchObject({ startDate: '2027-06-08', endDate: '2027-06-12', status: 'in-progress' })
    expect(workspace.impact.affectedTaskIds).toEqual([])
  })
})
