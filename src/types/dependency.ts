export type DependencyType = 'finish-to-start'

export interface Dependency {
  id: string
  projectId: string
  predecessorTaskId: string
  successorTaskId: string
  type: DependencyType
}
