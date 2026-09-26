import type { Assignee, ProjectTask, TaskStatus, TaskUpdateRequest } from '../types/task'
import type { ImpactAnalysis, LastChange, TaskFieldChange } from '../types/impact'
import { formatShortDate } from '../utils/date'

const statusLabels: Record<TaskStatus, string> = {
  'not-started': 'Не в работе',
  'in-progress': 'В работе',
  delayed: 'Задерживается',
  completed: 'Закончено',
}

export function buildTaskUpdateChange(
  previousTask: ProjectTask,
  nextTask: ProjectTask,
  update: TaskUpdateRequest,
): LastChange {
  const changes: TaskFieldChange[] = []
  const stringFields = ['title', 'startDate', 'endDate', 'assigneeId'] as const
  stringFields.forEach((field) => {
    if (update[field] !== undefined && previousTask[field] !== nextTask[field]) {
      changes.push({ field, previousValue: previousTask[field], nextValue: nextTask[field] })
    }
  })
  if (update.status !== undefined && previousTask.status !== nextTask.status) {
    changes.push({ field: 'status', previousValue: previousTask.status, nextValue: nextTask.status })
  }
  return { kind: 'task-updated', taskId: nextTask.id, taskTitle: nextTask.title, changes }
}

function taskTitle(taskId: string, tasks: ProjectTask[]) {
  return tasks.find((task) => task.id === taskId)?.title ?? 'Удалённая задача'
}

function assigneeName(assigneeId: string, assignees: Assignee[]) {
  return assignees.find((assignee) => assignee.id === assigneeId)?.name ?? 'Не назначен'
}

export interface ChangeDescription {
  title: string
  details: string[]
}

export function describeLastChange(
  change: LastChange,
  tasks: ProjectTask[],
  assignees: Assignee[],
): ChangeDescription {
  if (change.kind === 'session-started') {
    return { title: 'Текущее состояние проекта', details: ['Изменений в этой сессии пока не было.'] }
  }
  if (change.kind === 'task-created') {
    return { title: change.taskTitle, details: ['Задача добавлена в проект.'] }
  }
  if (change.kind === 'task-deleted') {
    return { title: change.taskTitle, details: ['Задача и связанные с ней зависимости удалены.'] }
  }
  if (change.kind === 'dependency-created' || change.kind === 'dependency-deleted') {
    return {
      title: change.kind === 'dependency-created' ? 'Создана зависимость' : 'Удалена зависимость',
      details: [`${taskTitle(change.predecessorTaskId, tasks)} → ${taskTitle(change.successorTaskId, tasks)}`],
    }
  }
  if (change.kind === 'schedule-shift-applied') {
    return {
      title: 'Автоматический сдвиг подтверждён',
      details: [`Обновлены даты задач: ${change.shiftedTaskIds.length}.`],
    }
  }

  const details = change.changes.map((fieldChange) => {
    switch (fieldChange.field) {
      case 'title':
        return `Название: «${fieldChange.previousValue}» → «${fieldChange.nextValue}»`
      case 'startDate':
        return `Начало: ${formatShortDate(fieldChange.previousValue)} → ${formatShortDate(fieldChange.nextValue)}`
      case 'endDate':
        return `Завершение: ${formatShortDate(fieldChange.previousValue)} → ${formatShortDate(fieldChange.nextValue)}`
      case 'status':
        return `Статус: ${statusLabels[fieldChange.previousValue]} → ${statusLabels[fieldChange.nextValue]}`
      case 'assigneeId':
        return `Ответственный: ${assigneeName(fieldChange.previousValue, assignees)} → ${assigneeName(fieldChange.nextValue, assignees)}`
    }
  })
  return {
    title: change.taskTitle,
    details: details.length > 0 ? details : ['Задача сохранена без изменений.'],
  }
}

export function describeImpactOutcome(impact: ImpactAnalysis): string {
  if (impact.reasons.length > 0) {
    const actionable = impact.reasons.filter((reason) => reason.severity !== 'info').length
    return actionable > 0
      ? `Анализ выявил предупреждений: ${actionable}. Даты и статусы связанных задач не изменены.`
      : `Анализ сформировал информационных сообщений: ${impact.reasons.length}. Связанные задачи не изменены.`
  }
  if (impact.projectEndChangeDays === 0) {
    return 'Изменение не повлияло на сроки проекта.'
  }
  if (impact.affectedTaskIds.length === 0) {
    return 'Зависимые задачи не изменились, но прогноз завершения проекта обновлён.'
  }
  return `Проанализировано зависимых задач: ${impact.affectedTaskIds.length}. Автоматического переноса дат не было.`
}
