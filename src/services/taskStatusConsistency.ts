import type { Dependency } from '../types/dependency'
import type { ProjectTask, TaskStatus } from '../types/task'

export function getIncompletePredecessors(
  taskId: string,
  tasks: ProjectTask[],
  dependencies: Dependency[],
): ProjectTask[] {
  const predecessorIds = new Set(dependencies
    .filter((dependency) => dependency.successorTaskId === taskId)
    .map((dependency) => dependency.predecessorTaskId))
  return tasks.filter((task) => predecessorIds.has(task.id) && task.status !== 'completed')
}

export function getTaskCompletionError(
  taskId: string,
  nextStatus: TaskStatus,
  tasks: ProjectTask[],
  dependencies: Dependency[],
): string | null {
  if (nextStatus !== 'completed') return null
  const incomplete = getIncompletePredecessors(taskId, tasks, dependencies)
  if (incomplete.length === 0) return null
  return `Нельзя завершить задачу, пока не завершены все предшественники. Не завершены: ${incomplete.map((task) => `«${task.title}»`).join(', ')}.`
}

export function validateTaskCompletion(
  taskId: string,
  nextStatus: TaskStatus,
  tasks: ProjectTask[],
  dependencies: Dependency[],
): void {
  const message = getTaskCompletionError(taskId, nextStatus, tasks, dependencies)
  if (message) throw new Error(message)
}
