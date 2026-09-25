export interface Project {
  id: string
  name: string
  description: string
  startDate: string
  targetEndDate: string
  projectedEndDate: string
  ownerName: string
  health: 'on-track' | 'at-risk' | 'off-track'
}

export interface ProjectSummary extends Project {
  progress: number
  taskCount: number
  completedTaskCount: number
}
