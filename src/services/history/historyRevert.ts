import type { ProjectService } from '../projectService'
import type { ProjectWorkspace } from '../../types/workspace'
import type { TaskUpdateRequest } from '../../types/task'
import type { UpdateProjectRequest } from '../../types/project'
import type { ProjectHistory } from './projectHistory'
import type { HistorySnapshot, ProjectHistoryEntry } from './historyTypes'

export interface HistoryRevertChange {
  label: string
  current: string
  expected?: string
  next: string
}

export interface HistoryRevertPlan {
  allowed: boolean
  reason?: string
  changes: HistoryRevertChange[]
}

const taskLabels: Record<string, string> = { title: 'Название', startDate: 'Начало', endDate: 'Завершение', assigneeId: 'Ответственный', status: 'Статус' }
const projectLabels: Record<string, string> = { name: 'Название', startDate: 'Начало проекта', targetEndDate: 'Плановый срок' }

function stringValue(value: unknown): string {
  return value === undefined || value === null ? '—' : String(value)
}

function changedFieldsPlan(current: Record<string, unknown>, before: HistorySnapshot, after: HistorySnapshot, labels: Record<string, string>): HistoryRevertPlan {
  const keys = Object.keys(after)
  const conflict = keys.some((key) => current[key] !== after[key])
  return {
    allowed: !conflict,
    reason: conflict ? 'Автоматический откат недоступен: данные были изменены позже.' : undefined,
    changes: keys.map((key) => ({ label: labels[key] ?? key, current: stringValue(current[key]), expected: stringValue(after[key]), next: stringValue(before[key]) })),
  }
}

function snapshotString(snapshot: HistorySnapshot | undefined, key: string): string {
  return stringValue(snapshot?.[key])
}

export function buildHistoryRevertPlan(entry: ProjectHistoryEntry, workspace: ProjectWorkspace): HistoryRevertPlan {
  if (entry.revertStatus === 'reverted') return { allowed: false, reason: 'Это изменение уже отменено.', changes: [] }
  if (entry.revertStatus === 'unavailable' || entry.kind === 'task-deleted' || entry.kind === 'employee-deleted' || entry.kind === 'task-created' || entry.kind === 'change-reverted') {
    return { allowed: false, reason: 'Для точного восстановления этого изменения потребуется серверная история.', changes: [] }
  }
  const before = entry.before ?? {}
  const after = entry.after ?? {}

  if (entry.kind === 'project-updated') return changedFieldsPlan(workspace.project as unknown as Record<string, unknown>, before, after, projectLabels)
  if (entry.kind === 'task-updated') {
    const task = workspace.tasks.find((candidate) => candidate.id === entry.entityId)
    if (!task) return { allowed: false, reason: 'Задача больше не существует.', changes: [] }
    return changedFieldsPlan(task as unknown as Record<string, unknown>, before, after, taskLabels)
  }
  if (entry.kind === 'employee-updated') {
    const employee = workspace.assignees.find((candidate) => candidate.id === entry.entityId)
    if (!employee) return { allowed: false, reason: 'Сотрудник больше не существует.', changes: [] }
    return changedFieldsPlan(employee as unknown as Record<string, unknown>, before, after, { name: 'Имя' })
  }
  if (entry.kind === 'employee-created') {
    const employee = workspace.assignees.find((candidate) => candidate.id === entry.entityId)
    if (!employee) return { allowed: false, reason: 'Сотрудник уже удалён.', changes: [] }
    const assigned = workspace.tasks.filter((task) => task.assigneeId === employee.id)
    return { allowed: assigned.length === 0, reason: assigned.length > 0 ? 'Нельзя отменить создание: сотруднику назначены задачи.' : undefined, changes: [{ label: 'Сотрудник', current: employee.name, next: 'Будет удалён' }] }
  }
  if (entry.kind === 'dependency-created' || entry.kind === 'dependency-deleted') {
    const predecessorTaskId = snapshotString(entry.after ?? entry.before, 'predecessorTaskId')
    const successorTaskId = snapshotString(entry.after ?? entry.before, 'successorTaskId')
    const dependency = workspace.dependencies.find((candidate) => candidate.predecessorTaskId === predecessorTaskId && candidate.successorTaskId === successorTaskId)
    const shouldExist = entry.kind === 'dependency-created'
    return {
      allowed: shouldExist ? Boolean(dependency) : !dependency,
      reason: shouldExist === Boolean(dependency) ? undefined : 'Автоматический откат недоступен: зависимость была изменена позже.',
      changes: [{ label: 'Зависимость', current: shouldExist ? 'Создана' : 'Удалена', next: shouldExist ? 'Будет удалена' : 'Будет восстановлена' }],
    }
  }
  if (entry.kind === 'schedule-shift-applied') {
    const afterTasks = Array.isArray(after.tasks) ? after.tasks as Array<Record<string, unknown>> : []
    const beforeTasks = Array.isArray(before.tasks) ? before.tasks as Array<Record<string, unknown>> : []
    const conflict = afterTasks.some((snapshot) => {
      const task = workspace.tasks.find((candidate) => candidate.id === snapshot.taskId)
      return !task || task.startDate !== snapshot.startDate || task.endDate !== snapshot.endDate
    })
    return {
      allowed: !conflict,
      reason: conflict ? 'Автоматический откат недоступен: даты одной или нескольких задач были изменены позже.' : undefined,
      changes: afterTasks.map((snapshot) => {
        const previous = beforeTasks.find((candidate) => candidate.taskId === snapshot.taskId)
        const task = workspace.tasks.find((candidate) => candidate.id === snapshot.taskId)
        return { label: task?.title ?? stringValue(snapshot.taskId), current: task ? `${task.startDate} — ${task.endDate}` : 'Задача удалена', expected: `${stringValue(snapshot.startDate)} — ${stringValue(snapshot.endDate)}`, next: `${stringValue(previous?.startDate)} — ${stringValue(previous?.endDate)}` }
      }),
    }
  }
  return { allowed: false, reason: 'Для этого изменения автоматический откат пока недоступен.', changes: [] }
}

export async function executeHistoryRevert(
  entry: ProjectHistoryEntry,
  workspace: ProjectWorkspace,
  service: ProjectService,
  history: ProjectHistory,
): Promise<ProjectWorkspace> {
  const plan = buildHistoryRevertPlan(entry, workspace)
  if (!plan.allowed) throw new Error(plan.reason ?? 'Откат недоступен.')
  const before = entry.before ?? {}
  const snapshot = entry.after ?? entry.before ?? {}
  let currentWorkspace = workspace

  if (entry.kind === 'project-updated') currentWorkspace = await service.updateProject(currentWorkspace, before as UpdateProjectRequest)
  if (entry.kind === 'task-updated') currentWorkspace = await service.updateTask(currentWorkspace, entry.entityId!, before as TaskUpdateRequest)
  if (entry.kind === 'employee-updated') currentWorkspace = (await service.updateEmployee(currentWorkspace, entry.entityId!, { name: stringValue(before.name) })).workspace
  if (entry.kind === 'employee-created') currentWorkspace = await service.deleteEmployee(currentWorkspace, entry.entityId!)
  if (entry.kind === 'dependency-created') {
    const dependency = workspace.dependencies.find((candidate) => candidate.predecessorTaskId === snapshot.predecessorTaskId && candidate.successorTaskId === snapshot.successorTaskId)
    if (!dependency) throw new Error('Зависимость больше не существует.')
    currentWorkspace = await service.deleteDependency(currentWorkspace, dependency.id)
  }
  if (entry.kind === 'dependency-deleted') currentWorkspace = await service.createDependency(currentWorkspace, { predecessorTaskId: stringValue(snapshot.predecessorTaskId), successorTaskId: stringValue(snapshot.successorTaskId), type: 'finish-to-start' })
  if (entry.kind === 'schedule-shift-applied') {
    const beforeTasks = Array.isArray(before.tasks) ? before.tasks as Array<Record<string, unknown>> : []
    for (const task of beforeTasks) {
      currentWorkspace = await service.updateTask(currentWorkspace, stringValue(task.taskId), { startDate: stringValue(task.startDate), endDate: stringValue(task.endDate) })
    }
    if (before.projectEndDate && workspace.project.targetEndDate === entry.after?.projectEndDate) {
      currentWorkspace = await service.updateProject(currentWorkspace, { targetEndDate: stringValue(before.projectEndDate) })
    }
  }

  const revertEvent = history.record({
    projectId: entry.projectId,
    kind: 'change-reverted',
    title: `Отменено изменение от ${new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(new Date(entry.createdAt))}`,
    description: entry.description,
    entityType: entry.entityType,
    entityId: entry.entityId,
    before: entry.after,
    after: entry.before,
    revertsEntryId: entry.id,
    revertStatus: 'unavailable',
  })
  history.markReverted(entry.projectId, entry.id, revertEvent.id)
  return currentWorkspace
}
