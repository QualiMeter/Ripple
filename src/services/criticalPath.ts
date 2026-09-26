import type { Dependency } from '../types/dependency'
import type { ProjectTask } from '../types/task'

export interface CriticalPathAnalysis {
  criticalTaskIds: string[]
  slackDaysByTaskId: Record<string, number>
  projectEndDate: string
}

const dayMs = 86_400_000

function toDay(date: string): number {
  return Math.floor(Date.parse(date) / dayMs)
}

function durationDays(task: ProjectTask): number {
  return Math.max(1, toDay(task.endDate) - toDay(task.startDate) + 1)
}

export function analyzeCriticalPath(tasks: ProjectTask[], dependencies: Dependency[]): CriticalPathAnalysis {
  if (tasks.length === 0) {
    return { criticalTaskIds: [], slackDaysByTaskId: {}, projectEndDate: '' }
  }

  const taskById = new Map(tasks.map((task) => [task.id, task]))
  const validDependencies = dependencies.filter((dependency) => (
    dependency.type === 'finish-to-start'
    && taskById.has(dependency.predecessorTaskId)
    && taskById.has(dependency.successorTaskId)
    && dependency.predecessorTaskId !== dependency.successorTaskId
  ))
  const successors = new Map(tasks.map((task) => [task.id, new Set<string>()]))
  const inDegree = new Map(tasks.map((task) => [task.id, 0]))

  validDependencies.forEach((dependency) => {
    const taskSuccessors = successors.get(dependency.predecessorTaskId)!
    if (taskSuccessors.has(dependency.successorTaskId)) return
    taskSuccessors.add(dependency.successorTaskId)
    inDegree.set(dependency.successorTaskId, (inDegree.get(dependency.successorTaskId) ?? 0) + 1)
  })

  const queue = tasks.filter((task) => inDegree.get(task.id) === 0).map((task) => task.id)
  const topologicalOrder: string[] = []
  while (queue.length > 0) {
    const taskId = queue.shift()!
    topologicalOrder.push(taskId)
    successors.get(taskId)?.forEach((successorId) => {
      const nextDegree = (inDegree.get(successorId) ?? 0) - 1
      inDegree.set(successorId, nextDegree)
      if (nextDegree === 0) queue.push(successorId)
    })
  }

  // Cycles are invalid domain data. Treat unresolved nodes as terminals and
  // ignore their internal edges so corrupted input cannot cause an endless pass.
  const resolvedIds = new Set(topologicalOrder)
  const unresolvedIds = new Set(tasks.map((task) => task.id).filter((taskId) => !resolvedIds.has(taskId)))
  const calculationOrder = [...topologicalOrder, ...unresolvedIds]
  const projectEndDay = Math.max(...tasks.map((task) => toDay(task.endDate)))
  const projectEndDate = new Date(projectEndDay * dayMs).toISOString().slice(0, 10)
  const latestStartByTaskId = new Map<string, number>()

  for (const taskId of [...calculationOrder].reverse()) {
    const task = taskById.get(taskId)!
    const successorLatestStarts = [...(successors.get(taskId) ?? [])]
      .filter((successorId) => !(unresolvedIds.has(taskId) && unresolvedIds.has(successorId)))
      .map((successorId) => latestStartByTaskId.get(successorId))
      .filter((value): value is number => value !== undefined)
    const latestFinish = successorLatestStarts.length > 0
      ? Math.min(projectEndDay, ...successorLatestStarts.map((latestStart) => latestStart - 1))
      : projectEndDay
    latestStartByTaskId.set(taskId, latestFinish - durationDays(task) + 1)
  }

  const slackDaysByTaskId = Object.fromEntries(tasks.map((task) => [
    task.id,
    (latestStartByTaskId.get(task.id) ?? toDay(task.startDate)) - toDay(task.startDate),
  ]))
  return {
    criticalTaskIds: tasks.filter((task) => slackDaysByTaskId[task.id] <= 0).map((task) => task.id),
    slackDaysByTaskId,
    projectEndDate,
  }
}
