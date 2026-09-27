import type { Dependency } from '../types/dependency'
import type { Employee } from '../types/employee'
import type { ImpactReason, LastChange } from '../types/impact'
import type { Project } from '../types/project'
import type { ProjectTask } from '../types/task'
import type { ProjectWorkspace } from '../types/workspace'
import { analyzeProjectBoundaries } from './projectBoundaryAnalysis'
import { calculateProjectProgress } from './projectProgress'
import { buildRecoveryScenarios } from './recoveryEngine'
import { buildCurrentProjectIssues, buildImpactAnalysis, findDownstreamTaskIds } from './scheduleEngine'
import { deriveProjectHealth, includeCurrentIssuesInImpact } from './currentProjectAnalysis'

export interface WorkspaceAnalysisContext {
  sourceTaskId?: string
  affectedTaskIds?: string[]
  lastChange?: LastChange
  previousProjectedEndDate?: string
  analysis?: ImpactReason[]
}

function editableProject(workspace: ProjectWorkspace): Project {
  const { id, creatorId, name, description, startDate, targetEndDate } = workspace.project
  return { id, creatorId, name, description, startDate, targetEndDate }
}

export function rebuildWorkspaceDerivedState(
  workspace: ProjectWorkspace,
  context: WorkspaceAnalysisContext = {},
): ProjectWorkspace {
  const project = editableProject(workspace)
  const sourceTaskId = context.sourceTaskId ?? workspace.impact.sourceTaskId
  const lastChange = context.lastChange ?? workspace.impact.lastChange
  const affectedTaskIds = context.affectedTaskIds ?? workspace.impact.affectedTaskIds
  const previousEnd = context.previousProjectedEndDate ?? workspace.impact.projectedProjectEndDate
  let impact = buildImpactAnalysis(
    project,
    workspace.tasks,
    workspace.dependencies,
    sourceTaskId,
    affectedTaskIds,
    lastChange,
    previousEnd,
  )

  if (context.analysis?.length && lastChange.kind !== 'task-updated') {
    impact = {
      ...impact,
      reasons: context.analysis,
      affectedTaskIds: [...new Set(context.analysis.flatMap((reason) => reason.affectedTaskIds))],
    }
  }

  const currentIssues = buildCurrentProjectIssues(project, workspace.tasks, workspace.dependencies)
  impact = includeCurrentIssuesInImpact(impact, currentIssues)
  const completedTaskCount = workspace.tasks.filter((task) => task.status === 'completed').length
  const projectSummary = {
    ...workspace.project,
    projectedEndDate: impact.projectedProjectEndDate,
    health: deriveProjectHealth(project, workspace.tasks, currentIssues, impact.atRiskTaskIds, impact.projectedProjectEndDate),
    progress: calculateProjectProgress(completedTaskCount, workspace.tasks.length),
    taskCount: workspace.tasks.length,
    completedTaskCount,
  }

  return {
    ...workspace,
    project: projectSummary,
    impact,
    currentIssues,
    projectBoundaryIssues: analyzeProjectBoundaries(project, workspace.tasks),
    recoveryScenarios: workspace.recoveryScenarios.length > 0 ? buildRecoveryScenarios(impact) : [],
  }
}

export function upsertTask(workspace: ProjectWorkspace, task: ProjectTask): ProjectWorkspace {
  const exists = workspace.tasks.some((candidate) => candidate.id === task.id)
  return { ...workspace, tasks: exists ? workspace.tasks.map((candidate) => candidate.id === task.id ? task : candidate) : [...workspace.tasks, task] }
}

export function removeTask(workspace: ProjectWorkspace, taskId: string): ProjectWorkspace {
  return {
    ...workspace,
    tasks: workspace.tasks.filter((task) => task.id !== taskId),
    dependencies: workspace.dependencies.filter((dependency) => dependency.predecessorTaskId !== taskId && dependency.successorTaskId !== taskId),
  }
}

export function upsertEmployee(workspace: ProjectWorkspace, employee: Employee): ProjectWorkspace {
  const exists = workspace.assignees.some((candidate) => candidate.id === employee.id)
  return { ...workspace, assignees: exists ? workspace.assignees.map((candidate) => candidate.id === employee.id ? employee : candidate) : [...workspace.assignees, employee] }
}

export function removeEmployee(workspace: ProjectWorkspace, employeeId: string): ProjectWorkspace {
  return { ...workspace, assignees: workspace.assignees.filter((employee) => employee.id !== employeeId) }
}

export function upsertDependency(workspace: ProjectWorkspace, dependency: Dependency): ProjectWorkspace {
  const exists = workspace.dependencies.some((candidate) => candidate.id === dependency.id)
  return { ...workspace, dependencies: exists ? workspace.dependencies.map((candidate) => candidate.id === dependency.id ? dependency : candidate) : [...workspace.dependencies, dependency] }
}

export function removeDependency(workspace: ProjectWorkspace, dependency: Pick<Dependency, 'id'>): ProjectWorkspace {
  return { ...workspace, dependencies: workspace.dependencies.filter((candidate) => candidate.id !== dependency.id) }
}

export function replaceDependencies(workspace: ProjectWorkspace, dependencies: Dependency[]): ProjectWorkspace {
  return { ...workspace, dependencies }
}

export function patchProject(workspace: ProjectWorkspace, patch: Partial<Project>): ProjectWorkspace {
  return { ...workspace, project: { ...workspace.project, ...patch } }
}

export function affectedTasksForChange(sourceTaskId: string, dependencies: Dependency[]): string[] {
  return findDownstreamTaskIds(sourceTaskId, dependencies)
}
