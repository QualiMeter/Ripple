import { addDependencyToGraph, removeDependencyFromGraph, validateDependencyTasks } from '../services/dependencyGraph'
import { findDownstreamTaskIds } from '../services/scheduleEngine'
import {
  findMockProjectIdForDependency,
  getMockProjectState,
  saveMockProjectDependencies,
} from '../mocks/workspaceStore'
import type { Dependency } from '../types/dependency'
import type { CreateDependencyRequest } from '../types/dependency'

let dependencySequence = 100

function affectedCandidates(
  predecessorTaskId: string,
  previousDependencies: Dependency[],
  nextDependencies: Dependency[],
): string[] {
  return [...new Set([
    ...findDownstreamTaskIds(predecessorTaskId, previousDependencies),
    ...findDownstreamTaskIds(predecessorTaskId, nextDependencies),
  ])]
}

function analyzeAfterDependencyChange(
  projectId: string,
  predecessorTaskId: string,
  previousDependencies: Dependency[],
  nextDependencies: Dependency[],
  dependency: Dependency,
  changeKind: 'dependency-created' | 'dependency-deleted',
): void {
  const state = getMockProjectState(projectId)
  const affectedTaskIds = affectedCandidates(predecessorTaskId, previousDependencies, nextDependencies)
    .filter((id) => state.tasks.some((task) => task.id === id))
  saveMockProjectDependencies(
    projectId,
    nextDependencies,
    state.tasks,
    predecessorTaskId,
    affectedTaskIds,
    {
      kind: changeKind,
      dependencyId: dependency.id,
      predecessorTaskId: dependency.predecessorTaskId,
      successorTaskId: dependency.successorTaskId,
    },
  )
}

export const mockDependenciesApi = {
  async createDependency(projectId: string, request: CreateDependencyRequest) {
    await new Promise((resolve) => setTimeout(resolve, 180))
    const state = getMockProjectState(projectId)
    validateDependencyTasks(projectId, state.tasks, request)
    const dependency: Dependency = {
      id: `dependency-${dependencySequence++}`,
      projectId,
      ...request,
    }
    const nextDependencies = addDependencyToGraph(state.dependencies, dependency)
    analyzeAfterDependencyChange(
      projectId,
      request.predecessorTaskId,
      state.dependencies,
      nextDependencies,
      dependency,
      'dependency-created',
    )
    return dependency
  },
  async deleteDependency(dependencyId: string) {
    await new Promise((resolve) => setTimeout(resolve, 180))
    const projectId = findMockProjectIdForDependency(dependencyId)
    if (!projectId) throw new Error('Зависимость не найдена.')
    const state = getMockProjectState(projectId)
    const dependency = state.dependencies.find((candidate) => candidate.id === dependencyId)
    if (!dependency) throw new Error('Зависимость не найдена.')
    const nextDependencies = removeDependencyFromGraph(state.dependencies, dependencyId)
    analyzeAfterDependencyChange(
      dependency.projectId,
      dependency.predecessorTaskId,
      state.dependencies,
      nextDependencies,
      dependency,
      'dependency-deleted',
    )
  },
}
