import {
  findMockProjectIdForTask,
  getMockProjectState,
  saveMockProjectState,
} from '../mocks/workspaceStore'
import { buildTaskUpdateChange } from '../services/changeContext'
import { applyExplicitTaskUpdate, findDownstreamTaskIds, inclusiveDuration } from '../services/scheduleEngine'
import type { ProjectTask, TaskCreateRequest } from '../types/task'
import { getMockEmployee } from '../mocks/employeeStore'

function validateAssignee(projectId: string, employeeId: string): void {
  const employee = getMockEmployee(employeeId)
  if (!employee) throw new Error('Выбранный сотрудник не найден.')
  if (employee.projectId !== projectId) throw new Error('Нельзя назначить задачу сотруднику другого проекта.')
}

let taskSequence = 100
export const mockTasksApi = {
  async createTask(projectId: string, request: TaskCreateRequest) {
    await new Promise((resolve) => setTimeout(resolve, 220))
    validateAssignee(projectId, request.assigneeId)
    const state = getMockProjectState(projectId)
    const task: ProjectTask = {
      id: `task-${taskSequence++}`,
      projectId,
      title: request.title,
      startDate: request.startDate,
      endDate: request.endDate,
      plannedStartDate: request.startDate,
      plannedEndDate: request.endDate,
      durationDays: inclusiveDuration(request.startDate, request.endDate),
      progress: request.status === 'completed' ? 100 : 0,
      assigneeId: request.assigneeId,
      status: request.status,
      riskState: 'none',
      isCritical: false,
    }
    saveMockProjectState(projectId, {
      ...state,
      baselineTasks: [...state.baselineTasks, { ...task }],
      tasks: [...state.tasks, { ...task }],
      lastChangedTaskId: task.id,
      affectedTaskIds: [],
      lastChange: { kind: 'task-created', taskId: task.id, taskTitle: task.title },
    })
    return task
  },

  async updateTask(taskId: string, update: import('../types/task').TaskUpdateRequest) {
    await new Promise((resolve) => setTimeout(resolve, 220))
    const projectId = findMockProjectIdForTask(taskId)
    if (!projectId) throw new Error('Задача не найдена')

    const state = getMockProjectState(projectId)
    const previousTask = state.tasks.find((task) => task.id === taskId)
    if (!previousTask) throw new Error('Задача не найдена')
    if (update.assigneeId !== undefined) validateAssignee(projectId, update.assigneeId)
    const updatedTask = applyExplicitTaskUpdate(previousTask, update)
    const affectsSchedule = update.startDate !== undefined || update.endDate !== undefined || update.status !== undefined
    const affectedTaskIds = affectsSchedule
      ? findDownstreamTaskIds(taskId, state.dependencies)
      : []
    saveMockProjectState(projectId, {
      ...state,
      tasks: state.tasks.map((task) => task.id === taskId ? updatedTask : task),
      taskOverrides: { ...state.taskOverrides, [taskId]: { ...state.taskOverrides[taskId], ...update } },
      lastChangedTaskId: taskId,
      affectedTaskIds,
      lastChange: buildTaskUpdateChange(previousTask, updatedTask, update),
    })
    return updatedTask
  },

  async deleteTask(taskId: string) {
    await new Promise((resolve) => setTimeout(resolve, 180))
    const projectId = findMockProjectIdForTask(taskId)
    if (!projectId) throw new Error('Задача не найдена')
    const state = getMockProjectState(projectId)
    const task = state.tasks.find((candidate) => candidate.id === taskId)
    if (!task) throw new Error('Задача не найдена')

    const affectedCandidates = findDownstreamTaskIds(taskId, state.dependencies)
    const baselineTasks = state.baselineTasks.filter((candidate) => candidate.id !== taskId)
    const previousTasks = state.tasks.filter((candidate) => candidate.id !== taskId)
    const dependencies = state.dependencies.filter((dependency) => (
      dependency.predecessorTaskId !== taskId && dependency.successorTaskId !== taskId
    ))
    const taskOverrides = { ...state.taskOverrides }
    delete taskOverrides[taskId]
    saveMockProjectState(projectId, {
      ...state,
      baselineTasks,
      tasks: previousTasks,
      taskOverrides,
      dependencies,
      lastChangedTaskId: taskId,
      affectedTaskIds: affectedCandidates.filter((id) => previousTasks.some((candidate) => candidate.id === id)),
      lastChange: { kind: 'task-deleted', taskId, taskTitle: task.title },
    })
  },
}
