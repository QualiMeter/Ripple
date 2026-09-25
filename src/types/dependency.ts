export type DependencyType = 'finish-to-start'

export interface Dependency {
  id: string
  projectId: string
  predecessorTaskId: string
  successorTaskId: string
  type: DependencyType
}

export interface CreateDependencyRequest {
  predecessorTaskId: string
  successorTaskId: string
  type: DependencyType
}
