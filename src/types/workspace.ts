import type { Dependency } from './dependency'
import type { ImpactAnalysis, RecoveryScenario } from './impact'
import type { ProjectSummary } from './project'
import type { Assignee, ProjectTask } from './task'

export interface ProjectWorkspace {
  project: ProjectSummary
  tasks: ProjectTask[]
  dependencies: Dependency[]
  assignees: Assignee[]
  impact: ImpactAnalysis
  recoveryScenarios: RecoveryScenario[]
}
