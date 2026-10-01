import type { TaskUpdateRequest } from '../../types/task'
import type { ProjectWorkspace } from '../../types/workspace'

export type ProjectScenarioType = 'task-delay' | 'task-start-shift' | 'project-deadline'

export interface ProjectScenarioDraft {
  type: ProjectScenarioType
  sourceTaskId?: string
  description: string
  scenarioWorkspace: ProjectWorkspace
  affectedTaskIds: string[]
  taskUpdate?: TaskUpdateRequest
  projectTargetEndDate?: string
  baseTaskDates?: { startDate: string; endDate: string }
  baseTargetEndDate: string
}

export interface ScenarioImpact {
  currentProjectedEndDate: string
  scenarioProjectedEndDate: string
  projectEndDeltaDays: number
  conflictsBefore: number
  conflictsAfter: number
  affectedTaskIds: string[]
  criticalTasksBefore: string[]
  criticalTasksAfter: string[]
  workloadIssuesBefore: string[]
  workloadIssuesAfter: string[]
}

export interface ScenarioMutationPort {
  updateTask(workspace: ProjectWorkspace, taskId: string, update: TaskUpdateRequest): Promise<ProjectWorkspace>
  updateProject(workspace: ProjectWorkspace, update: { targetEndDate: string }): Promise<ProjectWorkspace>
}
