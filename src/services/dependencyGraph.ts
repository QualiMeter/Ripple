import type { CreateDependencyRequest, Dependency } from '../types/dependency'

export type DependencyValidationCode = 'self-dependency' | 'duplicate' | 'cycle'

export class DependencyValidationError extends Error {
  constructor(public readonly code: DependencyValidationCode, message: string) {
    super(message)
    this.name = 'DependencyValidationError'
  }
}

function hasPath(fromTaskId: string, toTaskId: string, dependencies: Dependency[]): boolean {
  const visited = new Set<string>()
  const queue = [fromTaskId]

  while (queue.length > 0) {
    const current = queue.shift()!
    if (current === toTaskId) return true
    if (visited.has(current)) continue
    visited.add(current)

    dependencies
      .filter((dependency) => dependency.predecessorTaskId === current)
      .forEach((dependency) => queue.push(dependency.successorTaskId))
  }

  return false
}

export function validateDependency(
  dependencies: Dependency[],
  request: CreateDependencyRequest,
): void {
  if (request.predecessorTaskId === request.successorTaskId) {
    throw new DependencyValidationError('self-dependency', 'Задача не может зависеть сама от себя.')
  }

  const duplicate = dependencies.some((dependency) => (
    dependency.predecessorTaskId === request.predecessorTaskId
    && dependency.successorTaskId === request.successorTaskId
    && dependency.type === request.type
  ))
  if (duplicate) {
    throw new DependencyValidationError('duplicate', 'Такая зависимость уже существует.')
  }

  if (hasPath(request.successorTaskId, request.predecessorTaskId, dependencies)) {
    throw new DependencyValidationError(
      'cycle',
      'Эта связь создаст цикл: задачи будут зависеть друг от друга по кругу.',
    )
  }
}

export function addDependencyToGraph(
  dependencies: Dependency[],
  dependency: Dependency,
): Dependency[] {
  validateDependency(dependencies, dependency)
  return [...dependencies, dependency]
}

export function removeDependencyFromGraph(
  dependencies: Dependency[],
  dependencyId: string,
): Dependency[] {
  return dependencies.filter((dependency) => dependency.id !== dependencyId)
}
