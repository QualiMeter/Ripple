export interface ImpactReason {
  taskId: string
  reason: string
  severity: 'info' | 'warning' | 'critical'
}

export interface ImpactAnalysis {
  sourceTaskId: string
  affectedTaskIds: string[]
  criticalTaskIds: string[]
  atRiskTaskIds: string[]
  previousProjectEndDate: string
  projectedProjectEndDate: string
  deadlineShiftDays: number
  requiresIntervention: boolean
  reasons: ImpactReason[]
  analyzedAt: string
}

export interface RecoveryScenario {
  id: string
  title: string
  description: string
  expectedProjectEndDate: string
  recoveredDays: number
  actions: string[]
  confidence: 'high' | 'medium' | 'low'
}
