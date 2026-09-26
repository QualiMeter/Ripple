import {
  findMockProjectIdForTask,
  getMockProjectState,
  saveMockProjectSchedule,
  saveMockProjectState,
} from '../mocks/workspaceStore'
import { buildTaskUpdateChange } from '../services/changeContext'
import { findDownstreamTaskIds, rebuildSchedule, recalculateSchedule } from '../services/scheduleEngine'
import type { ProjectTask } from '../types/task'
import type { TasksApi } from './tasks.api'

let taskSequence = 100
const dayMs = 86_400_000

function inclusiveDuration(startDate: string, endDate: string): number {
  return Math.max(1, Math.round((Date.parse(endDate) - Date.parse(startDate)) / dayMs) + 1)
}

export const mockTasksApi: TasksApi = {
  async createTask(projectId, request) {
    await new Promise((resolve) => setTimeout(resolve, 220))
    const state = getMockProjectState(projectId)
    const task: ProjectTask = {
      id: `task-${taskSequence++}`,
      projectId,
      title: request.title,
      startDate: request.startDate,
      endDate: request.endDate,
      plannedStartDate: request.startDate,
      plannedEndDate: request.endDate,
      durationDays: request.durationDays ?? inclusiveDuration(request.startDate, request.endDate),
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

  async updateTask(taskId, update) {
    await new Promise((resolve) => setTimeout(resolve, 220))
    const projectId = findMockProjectIdForTask(taskId)
    if (!projectId) throw new Error('Задача не найдена')

    const state = getMockProjectState(projectId)
    const previousTask = state.tasks.find((task) => task.id === taskId)
    if (!previousTask) throw new Error('Задача не найдена')
    const previousOverride = state.taskOverrides[taskId] ?? {}
    const nextTaskOverride = { ...previousOverride, ...update }
    if (update.status === 'completed' && previousTask.status !== 'completed') {
      nextTaskOverride.startDate ??= previousTask.startDate
      nextTaskOverride.endDate ??= previousTask.endDate
      nextTaskOverride.durationDays ??= previousTask.durationDays
    }
    if (update.startDate !== undefined && update.endDate === undefined && update.durationDays === undefined) {
      nextTaskOverride.durationDays = previousTask.durationDays
      delete nextTaskOverride.endDate
    }
    if (update.durationDays !== undefined && update.endDate === undefined) delete nextTaskOverride.endDate
    const taskOverrides = { ...state.taskOverrides, [taskId]: nextTaskOverride }
    const result = recalculateSchedule(
      state.baselineTasks,
      state.dependencies,
      taskOverrides,
      taskId,
      state.tasks,
    )
    saveMockProjectSchedule(
      projectId,
      result.tasks,
      taskOverrides,
      taskId,
      result.affectedTaskIds,
      buildTaskUpdateChange(previousTask, result.updatedTask, update),
    )
    return result.updatedTask
  },

  async deleteTask(taskId) {
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
    const result = rebuildSchedule(
      baselineTasks,
      dependencies,
      taskOverrides,
      previousTasks,
      affectedCandidates,
    )
    saveMockProjectState(projectId, {
      ...state,
      baselineTasks,
      tasks: result.tasks,
      taskOverrides,
      dependencies,
      lastChangedTaskId: taskId,
      affectedTaskIds: result.affectedTaskIds,
      lastChange: { kind: 'task-deleted', taskId, taskTitle: task.title },
    })
  },
}
