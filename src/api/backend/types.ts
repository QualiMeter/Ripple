export type BackendTaskStatus = 'NotStarted' | 'InProgress' | 'Completed' | 'Delayed' | string

export interface ProjectListItemDto {
  id: string
  name: string
  startDate: string
  endDate: string
  creatorId: string
  taskCount: number | string
  employeeCount: number | string
}

export interface EmployeeDto {
  id: string
  projectId: string
  name: string
  taskCount: number | string
}

export interface AssignedTaskDto { id: string; name: string; startDate: string; endDate: string; status: BackendTaskStatus }
export interface EmployeeDetailsDto { id: string; projectId: string; name: string; tasks: AssignedTaskDto[] }

export interface TaskListItemDto {
  id: string
  projectId: string
  name: string
  startDate: string
  endDate: string
  durationCalendarDays: number | string
  assigneeId: string
  assigneeName: string
  status: BackendTaskStatus
}

export interface TaskDetailsDto extends TaskListItemDto { predecessorIds: string[]; successorIds: string[] }

export interface DependencyDto {
  predecessorTaskId: string
  successorTaskId: string
  projectId: string
  predecessorTaskName: string
  successorTaskName: string
}

export interface ProjectDetailsDto {
  id: string
  name: string
  startDate: string
  endDate: string
  creatorId: string
  employees: EmployeeDto[]
  tasks: TaskListItemDto[]
  dependencies: DependencyDto[]
  boundaryWarnings: unknown[]
}

export interface UserDto { id: string; name: string; email: string }

export interface AnalysisActionDto { code: string; label: string; targetTaskId?: string | null }
export interface AnalysisMessageDto {
  severity: number | string
  triggerTaskId: string
  triggerTaskName: string
  affectedTaskIds: string[]
  affectedTaskNames: string[]
  description: string
  actions: AnalysisActionDto[]
}

export interface TaskMutationResponse { task: TaskDetailsDto; analysis: AnalysisMessageDto[] }
export interface DependencyMutationResponse { dependency: DependencyDto; analysis: AnalysisMessageDto[] }

export interface ShiftPreviewItemDto {
  taskId: string
  taskName: string
  originalStartDate: string
  originalEndDate: string
  proposedStartDate: string
  proposedEndDate: string
  shiftCalendarDays: number | string
  completedRequiresManualResolution: boolean
  reason?: string | null
}

export interface ShiftPreviewDto {
  rootTaskId: string
  items: ShiftPreviewItemDto[]
  currentProjectEndDate: string
  proposedProjectEndDate: string
  projectEndIncreaseCalendarDays: number | string
  analysis: AnalysisMessageDto[]
}

export interface ShiftConfirmationResponse { preview: ShiftPreviewDto; projectEndDateChanged: boolean }

export interface BackendCreateProjectRequest { name: string; startDate: string; endDate: string }
export interface BackendUpdateProjectRequest extends BackendCreateProjectRequest {}
export interface BackendCreateTaskRequest { name: string; startDate: string; endDate: string; assigneeId: string; status: string }
export interface BackendUpdateTaskRequest extends BackendCreateTaskRequest {}
export interface BackendCreateEmployeeRequest { name: string }
export interface BackendUpdateEmployeeRequest { name: string }
export interface BackendCreateDependencyRequest { predecessorTaskId: string; successorTaskId: string }
