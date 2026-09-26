import type { Employee } from './employee'

export type TaskStatus = 'completed' | 'in-progress' | 'delayed' | 'not-started'
export type RiskState = 'none' | 'watch' | 'at-risk'

export type Assignee = Employee

export interface ProjectTask {
  id: string
  projectId: string
  title: string
  startDate: string
  endDate: string
  plannedStartDate: string
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
  assigneeId?: string
  status?: TaskStatus
}

export interface TaskCreateRequest {
  title: string
  startDate: string
  endDate: string
  assigneeId: string
  status: TaskStatus
}
