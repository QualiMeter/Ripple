import { dependenciesApi } from '../api/dependencies.api'
import { employeesApi } from '../api/employees.api'
import { projectsApi } from '../api/projects.api'
import { tasksApi } from '../api/tasks.api'
import { mapDependency, mapEmployee, mapTask } from '../api/backend/mappers'
import type { DependencyDto, EmployeeDto, TaskListItemDto } from '../api/backend/types'
import type { Dependency } from '../types/dependency'
import type { Employee } from '../types/employee'
import type { ProjectTask, TaskUpdateRequest } from '../types/task'
import type { ProjectWorkspace } from '../types/workspace'
import { buildTaskUpdateChange } from '../services/changeContext'
import { findDownstreamTaskIds } from '../services/scheduleEngine'
import { patchProject, rebuildWorkspaceDerivedState, removeEmployee, removeTask, replaceDependencies, upsertDependency, upsertEmployee, upsertTask } from '../services/workspaceState'
import type { RealtimeEvent } from './realtimeTypes'

export interface RealtimeEntityLoaders {
  getTask(projectId: string, taskId: string): Promise<ProjectTask>
  getEmployee(projectId: string, employeeId: string): Promise<Employee>
  listDependencies(projectId: string): Promise<Dependency[]>
  getWorkspace(projectId: string): Promise<ProjectWorkspace>
}

const defaultLoaders: RealtimeEntityLoaders = {
  getTask: (projectId, taskId) => tasksApi.getTask(projectId, taskId),
  getEmployee: (projectId, employeeId) => employeesApi.getEmployee(projectId, employeeId),
  listDependencies: (projectId) => dependenciesApi.listDependencies(projectId),
  getWorkspace: (projectId) => projectsApi.getWorkspace(projectId),
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function nestedData(data: unknown, key: string): Record<string, unknown> | null {
  const outer = record(data)
  return record(outer?.[key]) ?? outer
}

function taskFromData(data: unknown): ProjectTask | null {
  const value = nestedData(data, 'task')
  if (!value || typeof value.id !== 'string' || typeof value.projectId !== 'string' || typeof value.name !== 'string'
    || typeof value.startDate !== 'string' || typeof value.endDate !== 'string' || typeof value.assigneeId !== 'string'
    || typeof value.status !== 'string' || value.durationCalendarDays === undefined) return null
  return mapTask(value as unknown as TaskListItemDto)
}

function employeeFromData(data: unknown): Employee | null {
  const value = nestedData(data, 'employee')
  if (!value || typeof value.id !== 'string' || typeof value.projectId !== 'string' || typeof value.name !== 'string') return null
  return mapEmployee({ ...value, phone: typeof value.phone === 'string' ? value.phone : null, email: typeof value.email === 'string' ? value.email : null } as unknown as EmployeeDto)
}

function dependencyFromData(data: unknown): Dependency | null {
  const value = nestedData(data, 'dependency')
  if (!value || typeof value.projectId !== 'string' || typeof value.predecessorTaskId !== 'string' || typeof value.successorTaskId !== 'string') return null
  return mapDependency({ ...value, predecessorTaskName: String(value.predecessorTaskName ?? ''), successorTaskName: String(value.successorTaskName ?? '') } as unknown as DependencyDto)
}

function sameTask(left: ProjectTask, right: ProjectTask): boolean {
  return left.title === right.title && left.startDate === right.startDate && left.endDate === right.endDate
    && left.assigneeId === right.assigneeId && left.status === right.status
}

async function safely<T>(operation: () => Promise<T>): Promise<T | null> {
  try { return await operation() } catch { return null }
}

export async function applyRealtimeEvent(
  workspace: ProjectWorkspace,
  event: RealtimeEvent,
  loaders: RealtimeEntityLoaders = defaultLoaders,
): Promise<ProjectWorkspace> {
  if (event.projectId !== workspace.project.id) return workspace
  const action = event.action.toLowerCase()
  if (!['created', 'updated', 'deleted', 'restored', 'undone'].includes(action)) return workspace

  if (event.entity.toLowerCase() === 'task') {
    if (action === 'deleted') {
      if (!event.entityId) return workspace
      const current = workspace.tasks.find((task) => task.id === event.entityId)
      const affectedTaskIds = findDownstreamTaskIds(event.entityId, workspace.dependencies)
      return rebuildWorkspaceDerivedState(removeTask(workspace, event.entityId), {
        sourceTaskId: event.entityId, affectedTaskIds,
        lastChange: { kind: 'task-deleted', taskId: event.entityId, taskTitle: current?.title ?? 'Задача' },
        previousProjectedEndDate: workspace.project.projectedEndDate,
      })
    }
    const task = taskFromData(event.data) ?? (event.entityId ? await safely(() => loaders.getTask(event.projectId, event.entityId!)) : null)
    if (!task) return workspace
    const current = workspace.tasks.find((candidate) => candidate.id === task.id)
    if (current && sameTask(current, task)) return workspace
    const lastChange = current
      ? buildTaskUpdateChange(current, task, {
          title: task.title, startDate: task.startDate, endDate: task.endDate,
          assigneeId: task.assigneeId, status: task.status,
        } satisfies TaskUpdateRequest)
      : { kind: 'task-created' as const, taskId: task.id, taskTitle: task.title }
    const isScheduleChange = lastChange.kind === 'task-created' || (lastChange.kind === 'task-updated' && lastChange.changes.some((change) => change.field === 'startDate' || change.field === 'endDate' || change.field === 'status'))
    return rebuildWorkspaceDerivedState(upsertTask(workspace, task), {
      sourceTaskId: task.id,
      affectedTaskIds: isScheduleChange ? findDownstreamTaskIds(task.id, workspace.dependencies) : [],
      lastChange,
      previousProjectedEndDate: workspace.project.projectedEndDate,
    })
  }

  if (event.entity.toLowerCase() === 'employee') {
    if (action === 'deleted') {
      if (!event.entityId || !workspace.assignees.some((employee) => employee.id === event.entityId)) return workspace
      return rebuildWorkspaceDerivedState(removeEmployee(workspace, event.entityId))
    }
    const employee = employeeFromData(event.data) ?? (event.entityId ? await safely(() => loaders.getEmployee(event.projectId, event.entityId!)) : null)
    const current = employee && workspace.assignees.find((candidate) => candidate.id === employee.id)
    if (current && current.name === employee!.name && current.phone === employee!.phone && current.email === employee!.email) return workspace
    return employee ? rebuildWorkspaceDerivedState(upsertEmployee(workspace, employee)) : workspace
  }

  if (event.entity.toLowerCase() === 'dependency' || event.entity.toLowerCase() === 'task_dependency') {
    const dependency = dependencyFromData(event.data)
    if (dependency) {
      const exists = workspace.dependencies.some((candidate) => candidate.id === dependency.id)
      if ((action === 'deleted' && !exists) || (action !== 'deleted' && exists)) return workspace
      const dependencies = action === 'deleted'
        ? workspace.dependencies.filter((candidate) => candidate.id !== dependency.id)
        : upsertDependency(workspace, dependency).dependencies
      return rebuildWorkspaceDerivedState({ ...workspace, dependencies })
    }
    const dependencies = await safely(() => loaders.listDependencies(event.projectId))
    return dependencies ? rebuildWorkspaceDerivedState(replaceDependencies(workspace, dependencies)) : workspace
  }

  if (event.entity.toLowerCase() === 'project') {
    if (action !== 'updated' && action !== 'restored' && action !== 'undone') return workspace
    const data = nestedData(event.data, 'project')
    if (data) {
      const patch = {
        ...(typeof data.name === 'string' ? { name: data.name } : {}),
        ...(typeof data.startDate === 'string' ? { startDate: data.startDate } : {}),
        ...(typeof data.endDate === 'string' ? { targetEndDate: data.endDate } : {}),
        ...(typeof data.targetEndDate === 'string' ? { targetEndDate: data.targetEndDate } : {}),
      }
      if (Object.keys(patch).length > 0) {
        const changed = Object.entries(patch).some(([key, value]) => workspace.project[key as keyof typeof workspace.project] !== value)
        return changed ? rebuildWorkspaceDerivedState(patchProject(workspace, patch)) : workspace
      }
    }
    return (await safely(() => loaders.getWorkspace(event.projectId))) ?? workspace
  }

  // Server history is intentionally not mapped to the selective local history yet.
  return workspace
}
