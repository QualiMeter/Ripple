export type TaskStatus = 'completed' | 'in-progress' | 'blocked' | 'not-started'
export type RiskState = 'none' | 'watch' | 'at-risk'

export interface Assignee {
  id: string
  name: string
  role: string
  initials: string
  color: string
}

export interface ProjectTask {
  id: string
  projectId: string
  title: string
  startDate: string
  endDate: string
  plannedEndDate: string
  durationDays: number
  progress: number
  assigneeId: string
  status: TaskStatus
  riskState: RiskState
  isCritical: boolean
  changeNote?: string
}

export interface TaskUpdateRequest {
  title?: string
  startDate?: string
  endDate?: string
  durationDays?: number
  assigneeId?: string
  status?: TaskStatus
}
