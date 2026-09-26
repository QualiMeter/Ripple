import type { Dependency } from '../types/dependency'
import type { ImpactReason, LastChange, TaskFieldChange } from '../types/impact'
import type { ProjectTask, TaskStatus } from '../types/task'
import { getTodayIsoDate } from '../utils/date'
import { getIncompletePredecessors } from './taskStatusConsistency'

const statusLabels: Record<TaskStatus, string> = {
  'not-started': 'Не в работе',
  'in-progress': 'В работе',
  completed: 'Закончено',
  delayed: 'Задерживается',
}

export function getTaskStatusLabel(status: TaskStatus): string {
  return statusLabels[status]
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(`${date}T00:00:00Z`))
}

function statusChange(lastChange: LastChange): Extract<TaskFieldChange, { field: 'status' }> | undefined {
  if (lastChange.kind !== 'task-updated') return undefined
  return lastChange.changes.find(
    (change): change is Extract<TaskFieldChange, { field: 'status' }> => change.field === 'status',
  )
}

function directSuccessors(taskId: string, tasks: ProjectTask[], dependencies: Dependency[]): ProjectTask[] {
  const successorIds = new Set(dependencies
    .filter((dependency) => dependency.predecessorTaskId === taskId)
    .map((dependency) => dependency.successorTaskId))
  return tasks.filter((task) => successorIds.has(task.id))
}

function directPredecessors(taskId: string, tasks: ProjectTask[], dependencies: Dependency[]): ProjectTask[] {
  const predecessorIds = new Set(dependencies
    .filter((dependency) => dependency.successorTaskId === taskId)
    .map((dependency) => dependency.predecessorTaskId))
  return tasks.filter((task) => predecessorIds.has(task.id))
}

function completedFindings(
  source: ProjectTask,
  tasks: ProjectTask[],
  dependencies: Dependency[],
  today: string,
): ImpactReason[] {
  return directSuccessors(source.id, tasks, dependencies)
    .filter((successor) => successor.status === 'not-started')
    .flatMap((successor) => {
      const predecessors = directPredecessors(successor.id, tasks, dependencies)
      if (!predecessors.every((predecessor) => predecessor.status === 'completed')) return []
      const plannedStartReached = successor.plannedStartDate <= today
      return [{
        sourceTaskId: source.id,
        affectedTaskIds: [successor.id],
        severity: 'info' as const,
        reason: `Все предшественники задачи «${successor.title}» закончены.`,
        consequence: plannedStartReached
          ? 'Плановая дата начала уже наступила — задачу можно запускать.'
          : `Задача готова к старту, но её плановая дата начала ${formatDate(successor.plannedStartDate)} ещё не наступила.`,
        action: { type: 'open-task' as const, taskId: successor.id },
      }]
    })
}

function delayedFindings(
  source: ProjectTask,
  tasks: ProjectTask[],
  dependencies: Dependency[],
): ImpactReason[] {
  return directSuccessors(source.id, tasks, dependencies)
    .filter((successor) => successor.status !== 'completed')
    .map((successor) => {
      const inProgress = successor.status === 'in-progress'
      return {
        sourceTaskId: source.id,
        affectedTaskIds: [successor.id],
        severity: 'warning' as const,
        reason: `Предшественник «${source.title}» отмечен как задерживающийся.`,
        consequence: inProgress
          ? `Задача «${successor.title}» уже в работе: она не остановлена автоматически, но задержка может повлиять на её завершение.`
          : successor.status === 'not-started'
            ? `Плановая дата начала задачи «${successor.title}» находится под риском.`
            : `Сроки задачи «${successor.title}» требуют ручной проверки.`,
        action: { type: 'open-task' as const, taskId: successor.id },
      }
    })
}

function inProgressFindings(
  source: ProjectTask,
  tasks: ProjectTask[],
  dependencies: Dependency[],
): ImpactReason[] {
  const unfinished = getIncompletePredecessors(source.id, tasks, dependencies)
  if (unfinished.length === 0) return []
  return [{
    sourceTaskId: source.id,
    affectedTaskIds: unfinished.map((task) => task.id),
    severity: 'warning',
    reason: `Задача «${source.title}» начата до завершения всех предшественников.`,
    consequence: `Незавершённые предшественники: ${unfinished.map((task) => `«${task.title}»`).join(', ')}. Это может привести к повторной работе или задержке.`,
    action: { type: 'open-task', taskId: unfinished[0].id },
  }]
}

function reopenedFindings(
  source: ProjectTask,
  tasks: ProjectTask[],
  dependencies: Dependency[],
  nextStatus: TaskStatus,
): ImpactReason[] {
  return directSuccessors(source.id, tasks, dependencies)
    .filter((successor) => successor.status !== 'completed')
    .map((successor) => ({
      sourceTaskId: source.id,
      affectedTaskIds: [successor.id],
      severity: 'warning' as const,
      reason: `Ранее законченная задача «${source.title}» возвращена в статус «${statusLabels[nextStatus]}».`,
      consequence: `Предпосылки для задачи «${successor.title}» могли измениться; её состояние и сроки нужно проверить вручную.`,
      action: { type: 'open-task' as const, taskId: successor.id },
    }))
}

export function analyzeStatusChange(
  tasks: ProjectTask[],
  dependencies: Dependency[],
  lastChange: LastChange,
  today = getTodayIsoDate(),
): ImpactReason[] {
  const change = statusChange(lastChange)
  if (!change || lastChange.kind !== 'task-updated') return []
  const source = tasks.find((task) => task.id === lastChange.taskId)
  if (!source) return []

  if (change.previousValue === 'completed' && change.nextValue !== 'completed') {
    return reopenedFindings(source, tasks, dependencies, change.nextValue)
  }
  if (change.nextValue === 'completed') return completedFindings(source, tasks, dependencies, today)
  if (change.nextValue === 'delayed') return delayedFindings(source, tasks, dependencies)
  if (change.nextValue === 'in-progress') return inProgressFindings(source, tasks, dependencies)
  return []
}

export function findCurrentStatusConflicts(
  tasks: ProjectTask[],
  dependencies: Dependency[],
): ImpactReason[] {
  return tasks.flatMap((task): ImpactReason[] => {
    if (task.status !== 'completed' && task.status !== 'in-progress') return []
    const incomplete = getIncompletePredecessors(task.id, tasks, dependencies)
    if (incomplete.length === 0) return []
    const names = incomplete.map((predecessor) => `«${predecessor.title}»`).join(', ')
    if (task.status === 'completed') {
      return [{
        sourceTaskId: task.id,
        affectedTaskIds: [task.id, ...incomplete.map((predecessor) => predecessor.id)],
        severity: 'error',
        reason: `Задача «${task.title}» отмечена завершённой, но не завершены её предшественники: ${names}.`,
        consequence: 'Статус противоречит текущему графу зависимостей и требует ручного исправления.',
        action: { type: 'open-task', taskId: task.id },
      }]
    }
    return [{
      sourceTaskId: task.id,
      affectedTaskIds: [task.id, ...incomplete.map((predecessor) => predecessor.id)],
      severity: 'warning',
      reason: `Задача «${task.title}» выполняется до завершения всех предшественников.`,
      consequence: `Не завершены: ${names}. Задача не остановлена автоматически.`,
      action: { type: 'open-task', taskId: task.id },
    }]
  })
}
