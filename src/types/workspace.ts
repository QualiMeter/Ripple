import type { Dependency } from './dependency'
import type { CurrentProjectIssues, ImpactAnalysis, RecoveryScenario } from './impact'
import type { ProjectBoundaryIssue, ProjectSummary } from './project'
import type { Assignee, ProjectTask } from './task'

export interface ProjectWorkspace {
  project: ProjectSummary
  tasks: ProjectTask[]
  dependencies: Dependency[]
  assignees: Assignee[]
  impact: ImpactAnalysis
  currentIssues: CurrentProjectIssues
  projectBoundaryIssues: ProjectBoundaryIssue[]
  recoveryScenarios: RecoveryScenario[]
}
