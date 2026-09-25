import { demoDependencies } from '../mocks/dependencies'
import { findMockProjectIdForTask, getMockProjectState, saveMockProjectSchedule } from '../mocks/workspaceStore'
import { recalculateSchedule } from '../services/scheduleEngine'
import type { TasksApi } from './tasks.api'

export const mockTasksApi: TasksApi = {
  async updateTask(taskId, update) {
    await new Promise((resolve) => setTimeout(resolve, 220))
    const projectId = findMockProjectIdForTask(taskId)
    if (!projectId) throw new Error('Задача не найдена')

    const state = getMockProjectState(projectId)
    const dependencies = demoDependencies.filter((dependency) => dependency.projectId === projectId)
    const previousOverride = state.taskOverrides[taskId] ?? {}
    const nextTaskOverride = { ...previousOverride, ...update }
    if (update.durationDays !== undefined && update.endDate === undefined) delete nextTaskOverride.endDate
    const taskOverrides = { ...state.taskOverrides, [taskId]: nextTaskOverride }
    const result = recalculateSchedule(
      state.baselineTasks,
      dependencies,
      taskOverrides,
      taskId,
      state.tasks,
    )
    saveMockProjectSchedule(projectId, result.tasks, taskOverrides, taskId, result.affectedTaskIds)
    return result.updatedTask
  },
  async deleteTask() {
    throw new Error('Удаление задач пока не поддерживается')
  },
}
