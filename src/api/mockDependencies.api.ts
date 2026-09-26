import { addDependencyToGraph, removeDependencyFromGraph } from '../services/dependencyGraph'
import { findDownstreamTaskIds, recalculateSchedule } from '../services/scheduleEngine'
import {
  findMockProjectIdForDependency,
  getMockProjectState,
  saveMockProjectDependencies,
} from '../mocks/workspaceStore'
import type { Dependency } from '../types/dependency'
import type { DependenciesApi } from './dependencies.api'

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

function recalculateAfterDependencyChange(
  projectId: string,
  predecessorTaskId: string,
  previousDependencies: Dependency[],
  nextDependencies: Dependency[],
  dependency: Dependency,
  changeKind: 'dependency-created' | 'dependency-deleted',
): void {
  const state = getMockProjectState(projectId)
  const result = recalculateSchedule(
    state.baselineTasks,
    nextDependencies,
    state.taskOverrides,
    predecessorTaskId,
    state.tasks,
    affectedCandidates(predecessorTaskId, previousDependencies, nextDependencies),
  )
  saveMockProjectDependencies(
    projectId,
    nextDependencies,
    result.tasks,
    predecessorTaskId,
    result.affectedTaskIds,
    {
      kind: changeKind,
      dependencyId: dependency.id,
      predecessorTaskId: dependency.predecessorTaskId,
      successorTaskId: dependency.successorTaskId,
    },
  )
}

export const mockDependenciesApi: DependenciesApi = {
  async createDependency(projectId, request) {
    await new Promise((resolve) => setTimeout(resolve, 180))
    const state = getMockProjectState(projectId)
    const dependency: Dependency = {
      id: `dependency-${dependencySequence++}`,
      projectId,
      ...request,
    }
    const nextDependencies = addDependencyToGraph(state.dependencies, dependency)
    recalculateAfterDependencyChange(
      projectId,
      request.predecessorTaskId,
      state.dependencies,
      nextDependencies,
      dependency,
      'dependency-created',
    )
    return dependency
  },
  async deleteDependency(dependencyId) {
    await new Promise((resolve) => setTimeout(resolve, 180))
    const projectId = findMockProjectIdForDependency(dependencyId)
    if (!projectId) throw new Error('Зависимость не найдена.')
    const state = getMockProjectState(projectId)
    const dependency = state.dependencies.find((candidate) => candidate.id === dependencyId)
    if (!dependency) throw new Error('Зависимость не найдена.')
    const nextDependencies = removeDependencyFromGraph(state.dependencies, dependencyId)
    recalculateAfterDependencyChange(
      dependency.projectId,
      dependency.predecessorTaskId,
      state.dependencies,
      nextDependencies,
      dependency,
      'dependency-deleted',
    )
  },
}
