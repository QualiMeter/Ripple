export interface Project {
  id: string
  creatorId: string
  name: string
  description: string
  startDate: string
  targetEndDate: string
}

export interface ProjectSummary extends Project {
  projectedEndDate: string
  ownerName: string
  health: 'on-track' | 'at-risk' | 'off-track'
  progress: number
  taskCount: number
  completedTaskCount: number
}

export interface CreateProjectRequest {
  name: string
  startDate: string
  targetEndDate: string
}

export interface UpdateProjectRequest {
  name?: string
  startDate?: string
  targetEndDate?: string
}

export interface ProjectBoundaryIssue {
  taskId: string
  taskTitle: string
  reasons: string[]
}
