import { setHttpProjectSession } from '../api/backend/session'
import { dependenciesApi } from '../api/dependencies.api'
import { employeesApi } from '../api/employees.api'
import { projectsApi } from '../api/projects.api'
import { scheduleApi } from '../api/schedule.api'
import { tasksApi } from '../api/tasks.api'
import type { CreateDependencyRequest } from '../types/dependency'
import type { CreateEmployeeRequest, Employee, UpdateEmployeeRequest } from '../types/employee'
import type { CreateProjectRequest, Project, ProjectNavigationItem, UpdateProjectRequest } from '../types/project'
import type { ScheduleShiftPreview } from '../types/schedule'
import type { TaskCreateRequest, TaskUpdateRequest } from '../types/task'
import type { ProjectWorkspace } from '../types/workspace'
import { buildTaskUpdateChange } from './changeContext'
import { validateProjectInput } from './projectValidation'
import { applyScheduleShiftPreview, findDownstreamTaskIds } from './scheduleEngine'
import { assertValidScheduleShiftPreview } from './scheduleRules'
import { validateTaskCompletion } from './taskStatusConsistency'
import { patchProject, rebuildWorkspaceDerivedState, removeDependency, removeEmployee, removeTask, upsertDependency, upsertEmployee, upsertTask } from './workspaceState'

export interface WorkspaceEntityMutation<T> { workspace: ProjectWorkspace; entity: T }

export interface ProjectService {
  listProjects(): Promise<ProjectNavigationItem[]>
  createProject(request: CreateProjectRequest): Promise<Project>
  updateProject(workspace: ProjectWorkspace, request: UpdateProjectRequest): Promise<ProjectWorkspace>
  deleteProject(projectId: string): Promise<void>
  createEmployee(workspace: ProjectWorkspace, request: CreateEmployeeRequest): Promise<WorkspaceEntityMutation<Employee>>
  updateEmployee(workspace: ProjectWorkspace, employeeId: string, request: UpdateEmployeeRequest): Promise<WorkspaceEntityMutation<Employee>>
  deleteEmployee(workspace: ProjectWorkspace, employeeId: string): Promise<ProjectWorkspace>
  getWorkspace(projectId: string): Promise<ProjectWorkspace>
  updateTask(workspace: ProjectWorkspace, taskId: string, update: TaskUpdateRequest): Promise<ProjectWorkspace>
  createTask(workspace: ProjectWorkspace, request: TaskCreateRequest): Promise<ProjectWorkspace>
  deleteTask(workspace: ProjectWorkspace, taskId: string): Promise<ProjectWorkspace>
  createDependency(workspace: ProjectWorkspace, request: CreateDependencyRequest): Promise<ProjectWorkspace>
  deleteDependency(workspace: ProjectWorkspace, dependencyId: string): Promise<ProjectWorkspace>
  previewScheduleShift(workspace: ProjectWorkspace, sourceTaskId: string): Promise<ScheduleShiftPreview>
  applyScheduleShift(workspace: ProjectWorkspace, preview: ScheduleShiftPreview, confirmProjectEndDate: boolean): Promise<ProjectWorkspace>
}

function rememberAnalysis(workspace: ProjectWorkspace): void {
  setHttpProjectSession(workspace.project.id, {
    sourceTaskId: workspace.impact.sourceTaskId,
    affectedTaskIds: workspace.impact.affectedTaskIds,
    lastChange: workspace.impact.lastChange,
    analysis: workspace.impact.reasons,
    previousProjectEndDate: workspace.impact.previousProjectEndDate,
  })
}

export const projectService: ProjectService = {
  listProjects: () => projectsApi.listProjects(),
  async createProject(request) {
    validateProjectInput(request)
    return projectsApi.createProject({ ...request, name: request.name.trim() })
  },
  async updateProject(workspace, request) {
    validateProjectInput({ name: request.name ?? workspace.project.name, startDate: request.startDate ?? workspace.project.startDate, targetEndDate: request.targetEndDate ?? workspace.project.targetEndDate })
    const project = await projectsApi.updateProject(workspace.project.id, workspace.project, request)
    const next = rebuildWorkspaceDerivedState(patchProject(workspace, project))
    rememberAnalysis(next)
    return next
  },
  deleteProject: (projectId) => projectsApi.deleteProject(projectId),
  async createEmployee(workspace, request) {
    const employee = await employeesApi.createEmployee(workspace.project.id, request)
    return { workspace: rebuildWorkspaceDerivedState(upsertEmployee(workspace, employee)), entity: employee }
  },
  async updateEmployee(workspace, employeeId, request) {
    const current = workspace.assignees.find((candidate) => candidate.id === employeeId)
    if (!current) throw new Error('Сотрудник не найден.')
    const employee = await employeesApi.updateEmployee(workspace.project.id, employeeId, current, request)
    return { workspace: rebuildWorkspaceDerivedState(upsertEmployee(workspace, employee)), entity: employee }
  },
  async deleteEmployee(workspace, employeeId) {
    const employee = workspace.assignees.find((candidate) => candidate.id === employeeId)
    if (!employee) throw new Error('Сотрудник не найден.')
    const assignedTasks = workspace.tasks.filter((task) => task.assigneeId === employeeId)
    if (assignedTasks.length > 0) throw new Error(`Нельзя удалить сотрудника, пока на него назначены задачи. Сначала назначьте другого ответственного для ${assignedTasks.length} задач.`)
    await employeesApi.deleteEmployee(workspace.project.id, employeeId)
    return rebuildWorkspaceDerivedState(removeEmployee(workspace, employeeId))
  },
  getWorkspace: (projectId) => projectsApi.getWorkspace(projectId),
  async updateTask(workspace, taskId, update) {
    const currentTask = workspace.tasks.find((task) => task.id === taskId)
    if (!currentTask) throw new Error('Задача не найдена.')
    if (update.status !== undefined) validateTaskCompletion(taskId, update.status, workspace.tasks, workspace.dependencies)
    const response = await tasksApi.updateTask(workspace.project.id, taskId, currentTask, update)
    const lastChange = buildTaskUpdateChange(currentTask, response.task, update)
    const affectsAnalysis = lastChange.kind === 'task-updated' && lastChange.changes.some((change) => change.field === 'status' || change.field === 'startDate' || change.field === 'endDate')
    const next = rebuildWorkspaceDerivedState(upsertTask(workspace, response.task), {
      sourceTaskId: taskId,
      affectedTaskIds: affectsAnalysis ? findDownstreamTaskIds(taskId, workspace.dependencies) : [],
      lastChange,
      previousProjectedEndDate: workspace.project.projectedEndDate,
      analysis: response.analysis,
    })
    rememberAnalysis(next)
    return next
  },
  async createTask(workspace, request) {
    const response = await tasksApi.createTask(workspace.project.id, request)
    const next = rebuildWorkspaceDerivedState(upsertTask(workspace, response.task), {
      sourceTaskId: response.task.id,
      affectedTaskIds: [...new Set(response.analysis.flatMap((reason) => reason.affectedTaskIds))],
      lastChange: { kind: 'task-created', taskId: response.task.id, taskTitle: response.task.title },
      previousProjectedEndDate: workspace.project.projectedEndDate,
      analysis: response.analysis,
    })
    rememberAnalysis(next)
    return next
  },
  async deleteTask(workspace, taskId) {
    const task = workspace.tasks.find((candidate) => candidate.id === taskId)
    if (!task) throw new Error('Задача не найдена.')
    const affectedTaskIds = findDownstreamTaskIds(taskId, workspace.dependencies)
    const analysis = await tasksApi.deleteTask(workspace.project.id, taskId)
    const next = rebuildWorkspaceDerivedState(removeTask(workspace, taskId), {
      sourceTaskId: taskId, affectedTaskIds,
      lastChange: { kind: 'task-deleted', taskId, taskTitle: task.title },
      previousProjectedEndDate: workspace.project.projectedEndDate,
      analysis,
    })
    rememberAnalysis(next)
    return next
  },
  async createDependency(workspace, request) {
    const response = await dependenciesApi.createDependency(workspace.project.id, request)
    const affectedTaskIds = response.analysis.length > 0
      ? [...new Set(response.analysis.flatMap((reason) => reason.affectedTaskIds))]
      : [request.successorTaskId, ...findDownstreamTaskIds(request.successorTaskId, workspace.dependencies)]
    const next = rebuildWorkspaceDerivedState(upsertDependency(workspace, response.dependency), {
      sourceTaskId: request.predecessorTaskId, affectedTaskIds,
      lastChange: { kind: 'dependency-created', dependencyId: response.dependency.id, predecessorTaskId: request.predecessorTaskId, successorTaskId: request.successorTaskId },
      previousProjectedEndDate: workspace.project.projectedEndDate,
      analysis: response.analysis,
    })
    rememberAnalysis(next)
    return next
  },
  async deleteDependency(workspace, dependencyId) {
    const dependency = workspace.dependencies.find((candidate) => candidate.id === dependencyId)
    if (!dependency) throw new Error('Зависимость не найдена.')
    const analysis = await dependenciesApi.deleteDependency(workspace.project.id, dependency)
    const next = rebuildWorkspaceDerivedState(removeDependency(workspace, dependency), {
      sourceTaskId: dependency.predecessorTaskId,
      affectedTaskIds: [...new Set(analysis.flatMap((reason) => reason.affectedTaskIds))],
      lastChange: { kind: 'dependency-deleted', dependencyId, predecessorTaskId: dependency.predecessorTaskId, successorTaskId: dependency.successorTaskId },
      previousProjectedEndDate: workspace.project.projectedEndDate,
      analysis,
    })
    rememberAnalysis(next)
    return next
  },
  async previewScheduleShift(workspace, sourceTaskId) {
    const preview = await scheduleApi.previewShift(workspace.project.id, { sourceTaskId })
    assertValidScheduleShiftPreview(workspace.tasks, workspace.dependencies, preview)
    return preview
  },
  async applyScheduleShift(workspace, preview, confirmProjectEndDate) {
    assertValidScheduleShiftPreview(workspace.tasks, workspace.dependencies, preview)
    const response = await scheduleApi.applyShift(workspace.project.id, preview, { confirmProjectEndDate })
    let base = { ...workspace, tasks: applyScheduleShiftPreview(workspace.tasks, response.preview) }
    if (confirmProjectEndDate && response.projectEndDateChanged) base = patchProject(base, { targetEndDate: response.preview.proposedProjectEndDate })
    const shiftedTaskIds = response.preview.taskShifts.map((shift) => shift.taskId)
    const next = rebuildWorkspaceDerivedState(base, {
      sourceTaskId: preview.sourceTaskId,
      affectedTaskIds: shiftedTaskIds,
      lastChange: { kind: 'schedule-shift-applied', sourceTaskId: preview.sourceTaskId, shiftedTaskIds },
      previousProjectedEndDate: workspace.project.projectedEndDate,
    })
    rememberAnalysis(next)
    return next
  },
}
