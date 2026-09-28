export type TaskAnalysisSeverity = 'info' | 'warning' | 'error'

export interface TaskAnalysisAction {
  code: string
  label: string
  targetTaskId?: string | null
}

export interface TaskAnalysisMessage {
  severity: TaskAnalysisSeverity
  triggerTaskId: string
  triggerTaskName: string
  affectedTaskIds: string[]
  affectedTaskNames: string[]
  description: string
  actions: TaskAnalysisAction[]
}
