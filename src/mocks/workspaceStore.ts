import { demoTasks } from './tasks'
import type { ProjectTask, TaskUpdateRequest } from '../types/task'

export interface MockProjectState {
  baselineTasks: ProjectTask[]
  tasks: ProjectTask[]
  taskOverrides: Record<string, TaskUpdateRequest>
  lastChangedTaskId: string
  affectedTaskIds: string[] | null
}

const projectStates = new Map<string, MockProjectState>()
const dayMs = 86_400_000

function toBaselineTask(task: ProjectTask): ProjectTask {
  return {
    ...task,
    startDate: task.plannedStartDate,
    endDate: task.plannedEndDate,
    durationDays: Math.max(1, Math.round((Date.parse(task.plannedEndDate) - Date.parse(task.plannedStartDate)) / dayMs) + 1),
    riskState: task.riskState === 'watch' ? 'watch' : 'none',
    changeNote: undefined,
  }
}

function createProjectState(projectId: string): MockProjectState {
  const tasks = demoTasks
    .filter((task) => task.projectId === projectId)
    .map((task) => ({ ...task }))
  const sourceTask = tasks.find((task) => task.id === 'api')
  const state: MockProjectState = {
    baselineTasks: tasks.map(toBaselineTask),
    tasks,
    taskOverrides: sourceTask ? { [sourceTask.id]: { endDate: sourceTask.endDate } } : {},
    lastChangedTaskId: sourceTask?.id ?? tasks[0]?.id ?? '',
    affectedTaskIds: null,
  }
  projectStates.set(projectId, state)
  return state
}

export function getMockProjectState(projectId: string): MockProjectState {
  return projectStates.get(projectId) ?? createProjectState(projectId)
}

export function findMockProjectIdForTask(taskId: string): string | undefined {
  for (const [projectId, state] of projectStates) {
    if (state.tasks.some((task) => task.id === taskId)) return projectId
  }
  return demoTasks.find((task) => task.id === taskId)?.projectId
}

export function saveMockProjectSchedule(
  projectId: string,
  tasks: ProjectTask[],
  taskOverrides: Record<string, TaskUpdateRequest>,
  lastChangedTaskId: string,
  affectedTaskIds: string[],
): void {
  const currentState = getMockProjectState(projectId)
  projectStates.set(projectId, {
    ...currentState,
    tasks: tasks.map((task) => ({ ...task })),
    taskOverrides,
    lastChangedTaskId,
    affectedTaskIds: [...affectedTaskIds],
  })
}
