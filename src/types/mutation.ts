import type { Dependency } from './dependency'
import type { ImpactReason } from './impact'
import type { ProjectTask } from './task'

export interface TaskMutationResult {
  task: ProjectTask
  analysis: ImpactReason[]
}

export interface DependencyMutationResult {
  dependency: Dependency
  analysis: ImpactReason[]
}
