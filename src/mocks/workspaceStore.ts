import { demoTasks } from './tasks'
import { demoDependencies } from './dependencies'
import type { Dependency } from '../types/dependency'
import type { LastChange } from '../types/impact'
import type { ProjectTask, TaskUpdateRequest } from '../types/task'

export interface MockProjectState {
  baselineTasks: ProjectTask[]
  tasks: ProjectTask[]
  taskOverrides: Record<string, TaskUpdateRequest>
  dependencies: Dependency[]
  lastChangedTaskId: string
  affectedTaskIds: string[] | null
  lastChange: LastChange
  previousProjectedEndDate: string
}

const projectStates = new Map<string, MockProjectState>()
const dayMs = 86_400_000

function latestTaskEnd(tasks: ProjectTask[], fallback = ''): string {
  return tasks.reduce((latest, task) => task.endDate > latest ? task.endDate : latest, fallback)
}

function toBaselineTask(task: ProjectTask): ProjectTask {
  return {
    ...task,
    startDate: task.plannedStartDate,
    endDate: task.plannedEndDate,
    durationDays: Math.max(1, Math.round((Date.parse(task.plannedEndDate) - Date.parse(task.plannedStartDate)) / dayMs) + 1),
    riskState: task.status !== 'completed' && task.riskState === 'watch' ? 'watch' : 'none',
    changeNote: undefined,
  }
}

function createProjectState(projectId: string): MockProjectState {
  const tasks = demoTasks
    .filter((task) => task.projectId === projectId)
    .map((task) => ({ ...task }))
  const sourceTask = tasks.find((task) => task.id === 'api')
  const completedTaskOverrides = Object.fromEntries(
    tasks
      .filter((task) => task.status === 'completed')
      .map((task) => [task.id, {
        startDate: task.startDate,
        endDate: task.endDate,
        status: task.status,
      }]),
  )
  const state: MockProjectState = {
    baselineTasks: tasks.map(toBaselineTask),
    tasks,
    taskOverrides: {
      ...completedTaskOverrides,
      ...(sourceTask ? { [sourceTask.id]: { endDate: sourceTask.endDate } } : {}),
    },
    dependencies: demoDependencies
      .filter((dependency) => dependency.projectId === projectId)
      .map((dependency) => ({ ...dependency })),
    lastChangedTaskId: sourceTask?.id ?? tasks[0]?.id ?? '',
    affectedTaskIds: null,
    lastChange: sourceTask
      ? {
          kind: 'task-updated',
          taskId: sourceTask.id,
          taskTitle: sourceTask.title,
          changes: [{
            field: 'endDate',
            previousValue: sourceTask.plannedEndDate,
            nextValue: sourceTask.endDate,
          }],
        }
      : { kind: 'task-created', taskId: '', taskTitle: 'Проект создан' },
    previousProjectedEndDate: latestTaskEnd(tasks.map(toBaselineTask)),
  }
  projectStates.set(projectId, state)
  return state
}

export function saveMockProjectDependencies(
  projectId: string,
  dependencies: Dependency[],
  tasks: ProjectTask[],
  lastChangedTaskId: string,
  affectedTaskIds: string[],
  lastChange: LastChange,
): void {
  const currentState = getMockProjectState(projectId)
  projectStates.set(projectId, {
    ...currentState,
    dependencies: dependencies.map((dependency) => ({ ...dependency })),
    tasks: tasks.map((task) => ({ ...task })),
    lastChangedTaskId,
    affectedTaskIds: [...affectedTaskIds],
    lastChange,
    previousProjectedEndDate: latestTaskEnd(currentState.tasks),
  })
}

export function getMockProjectState(projectId: string): MockProjectState {
  return projectStates.get(projectId) ?? createProjectState(projectId)
}

export function saveMockProjectState(projectId: string, state: MockProjectState): void {
  const currentState = getMockProjectState(projectId)
  projectStates.set(projectId, {
    ...state,
    baselineTasks: state.baselineTasks.map((task) => ({ ...task })),
    tasks: state.tasks.map((task) => ({ ...task })),
    taskOverrides: { ...state.taskOverrides },
    dependencies: state.dependencies.map((dependency) => ({ ...dependency })),
    affectedTaskIds: state.affectedTaskIds ? [...state.affectedTaskIds] : null,
    previousProjectedEndDate: latestTaskEnd(currentState.tasks, state.previousProjectedEndDate),
  })
}

export function findMockProjectIdForTask(taskId: string): string | undefined {
  for (const [projectId, state] of projectStates) {
    if (state.tasks.some((task) => task.id === taskId)) return projectId
  }
  return demoTasks.find((task) => task.id === taskId)?.projectId
}

export function findMockProjectIdForDependency(dependencyId: string): string | undefined {
  for (const [projectId, state] of projectStates) {
    if (state.dependencies.some((dependency) => dependency.id === dependencyId)) return projectId
  }
  return demoDependencies.find((dependency) => dependency.id === dependencyId)?.projectId
}

export function saveMockProjectSchedule(
  projectId: string,
  tasks: ProjectTask[],
  taskOverrides: Record<string, TaskUpdateRequest>,
  lastChangedTaskId: string,
  affectedTaskIds: string[],
  lastChange: LastChange,
): void {
  const currentState = getMockProjectState(projectId)
  projectStates.set(projectId, {
    ...currentState,
    tasks: tasks.map((task) => ({ ...task })),
    taskOverrides,
    lastChangedTaskId,
    affectedTaskIds: [...affectedTaskIds],
    lastChange,
    previousProjectedEndDate: latestTaskEnd(currentState.tasks),
  })
}
