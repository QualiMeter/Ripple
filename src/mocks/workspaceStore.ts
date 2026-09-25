import { demoTasks } from './tasks'
import type { ProjectTask } from '../types/task'

interface MockProjectState {
  tasks: ProjectTask[]
  lastChangedTaskId: string
  affectedTaskIds: string[] | null
}

const projectStates = new Map<string, MockProjectState>()

function createProjectState(projectId: string): MockProjectState {
  const state: MockProjectState = {
    tasks: demoTasks
      .filter((task) => task.projectId === projectId)
      .map((task) => ({ ...task })),
    lastChangedTaskId: 'api',
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
  lastChangedTaskId: string,
  affectedTaskIds: string[],
): void {
  projectStates.set(projectId, {
    tasks: tasks.map((task) => ({ ...task })),
    lastChangedTaskId,
    affectedTaskIds: [...affectedTaskIds],
  })
}
