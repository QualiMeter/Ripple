import type { Dependency } from '../../types/dependency'
import type { Employee } from '../../types/employee'
import type { ImpactReason } from '../../types/impact'
import type { Project, ProjectSummary } from '../../types/project'
import type { ScheduleShiftPreview } from '../../types/schedule'
import type { ProjectTask, TaskCreateRequest, TaskStatus, TaskUpdateRequest } from '../../types/task'
import type {
  AnalysisMessageDto, BackendCreateProjectRequest, BackendCreateTaskRequest, BackendTaskStatus,
  BackendUpdateProjectRequest, BackendUpdateTaskRequest, DependencyDto, EmployeeDto,
  ProjectDetailsDto, ProjectListItemDto, ShiftPreviewDto, TaskListItemDto,
} from './types'

const plannedDates = new Map<string, { startDate: string; endDate: string }>()

export function fromBackendTaskStatus(status: BackendTaskStatus): TaskStatus {
  const normalized = status.toLowerCase().replace(/[\s_-]/g, '')
  if (normalized === 'completed') return 'completed'
  if (normalized === 'inprogress') return 'in-progress'
  if (normalized === 'delayed') return 'delayed'
  return 'not-started'
}

export function toBackendTaskStatus(status: TaskStatus): string {
  return ({ 'not-started': 'NotStarted', 'in-progress': 'InProgress', completed: 'Completed', delayed: 'Delayed' } as const)[status]
}

export function mapProject(dto: ProjectListItemDto | ProjectDetailsDto): Project {
  return { id: dto.id, creatorId: dto.creatorId, name: dto.name, description: '', startDate: dto.startDate, targetEndDate: dto.endDate }
}

export function toCreateProjectDto(request: { name: string; startDate: string; targetEndDate: string }): BackendCreateProjectRequest {
  return { name: request.name, startDate: request.startDate, endDate: request.targetEndDate }
}

export function toUpdateProjectDto(project: Project, update: { name?: string; startDate?: string; targetEndDate?: string }): BackendUpdateProjectRequest {
  return { name: update.name ?? project.name, startDate: update.startDate ?? project.startDate, endDate: update.targetEndDate ?? project.targetEndDate }
}

export function mapEmployee(dto: EmployeeDto): Employee {
  return { id: dto.id, projectId: dto.projectId, name: dto.name }
}

function baselineKey(projectId: string, taskId: string): string { return `${projectId}:${taskId}` }

export function rememberPlannedDates(projectId: string, taskId: string, startDate: string, endDate: string): void {
  plannedDates.set(baselineKey(projectId, taskId), { startDate, endDate })
}

export function mapTask(dto: TaskListItemDto): ProjectTask {
  const key = baselineKey(dto.projectId, dto.id)
  if (!plannedDates.has(key)) rememberPlannedDates(dto.projectId, dto.id, dto.startDate, dto.endDate)
  const baseline = plannedDates.get(key)!
  const status = fromBackendTaskStatus(dto.status)
  return {
    id: dto.id, projectId: dto.projectId, title: dto.name, startDate: dto.startDate, endDate: dto.endDate,
    plannedStartDate: baseline.startDate, plannedEndDate: baseline.endDate,
    durationDays: Number(dto.durationCalendarDays), progress: status === 'completed' ? 100 : 0,
    assigneeId: dto.assigneeId, status, riskState: status === 'delayed' ? 'at-risk' : 'none', isCritical: false,
  }
}

export function toCreateTaskDto(request: TaskCreateRequest): BackendCreateTaskRequest {
  return { name: request.title, startDate: request.startDate, endDate: request.endDate, assigneeId: request.assigneeId, status: toBackendTaskStatus(request.status) }
}

export function toUpdateTaskDto(task: ProjectTask, update: TaskUpdateRequest): BackendUpdateTaskRequest {
  return {
    name: update.title ?? task.title, startDate: update.startDate ?? task.startDate,
    endDate: update.endDate ?? task.endDate, assigneeId: update.assigneeId ?? task.assigneeId,
    status: toBackendTaskStatus(update.status ?? task.status),
  }
}

export function dependencyId(predecessorTaskId: string, successorTaskId: string): string {
  return `dependency:${predecessorTaskId}:${successorTaskId}`
}

export function dependencyDeletePath(projectId: string, dependency: Pick<Dependency, 'predecessorTaskId' | 'successorTaskId'>): string {
  return `/api/v1/projects/${projectId}/dependencies/${dependency.predecessorTaskId}/${dependency.successorTaskId}`
}

export function mapDependency(dto: DependencyDto): Dependency {
  return { id: dependencyId(dto.predecessorTaskId, dto.successorTaskId), projectId: dto.projectId, predecessorTaskId: dto.predecessorTaskId, successorTaskId: dto.successorTaskId, type: 'finish-to-start' }
}

export function mapAnalysisMessage(dto: AnalysisMessageDto): ImpactReason {
  const severityNumber = Number(dto.severity)
  const action = dto.actions?.[0]
  return {
    sourceTaskId: dto.triggerTaskId, affectedTaskIds: dto.affectedTaskIds ?? [], reason: dto.description,
    consequence: action?.label ?? 'Проверьте связанные задачи и примите решение вручную.',
    severity: severityNumber >= 2 ? 'error' : severityNumber === 1 ? 'warning' : 'info',
    action: action?.code.toLowerCase().includes('shift')
      ? { type: 'preview-shift' }
      : action?.targetTaskId ? { type: 'open-task', taskId: action.targetTaskId } : undefined,
  }
}

export function mapShiftPreview(projectId: string, dto: ShiftPreviewDto): ScheduleShiftPreview {
  return {
    projectId, sourceTaskId: dto.rootTaskId,
    taskShifts: dto.items.map((item) => ({
      taskId: item.taskId, currentStartDate: item.originalStartDate, currentEndDate: item.originalEndDate,
      proposedStartDate: item.proposedStartDate, proposedEndDate: item.proposedEndDate,
      shiftDays: Number(item.shiftCalendarDays), completedRequiresManualResolution: item.completedRequiresManualResolution,
      reason: item.reason,
    })),
    currentProjectEndDate: dto.currentProjectEndDate, proposedProjectEndDate: dto.proposedProjectEndDate,
    projectEndShiftDays: Number(dto.projectEndIncreaseCalendarDays),
  }
}

export function mapListProjectSummary(dto: ProjectListItemDto, ownerName: string): ProjectSummary {
  return { ...mapProject(dto), projectedEndDate: dto.endDate, ownerName, health: 'on-track', progress: 0, taskCount: Number(dto.taskCount), completedTaskCount: 0 }
}
