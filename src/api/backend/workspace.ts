import { apiRequest } from '../client'
import { analyzeProjectBoundaries } from '../../services/projectBoundaryAnalysis'
import { calculateProjectProgress } from '../../services/projectProgress'
import { buildCurrentProjectIssues, buildImpactAnalysis, differenceInDays, findDownstreamTaskIds } from '../../services/scheduleEngine'
import type { ProjectNavigationItem, ProjectSummary } from '../../types/project'
import type { ProjectWorkspace } from '../../types/workspace'
import { getHttpProjectSession } from './session'
import { mapDependency, mapEmployee, mapProject, mapProjectNavigationItem, mapTask } from './mappers'
import type { ProjectDetailsDto, ProjectListItemDto, UserDto } from './types'
import { deriveProjectHealth, includeCurrentIssuesInImpact } from '../../services/currentProjectAnalysis'

let usersCache: Promise<Map<string, string>> | null = null

async function getUsers(): Promise<Map<string, string>> {
  usersCache ??= apiRequest<UserDto[]>('/v1/users')
    .then((users) => new Map(users.map((user) => [user.id, user.name])))
    .catch((error) => {
      usersCache = null
      throw error
    })
  return usersCache
}

function latestEnd(tasks: ProjectWorkspace['tasks'], fallback: string): string {
  if (tasks.length === 0) return fallback
  return tasks.reduce((latest, task) => task.endDate > latest ? task.endDate : latest, tasks[0].endDate)
}

export async function fetchProjectDetails(projectId: string): Promise<ProjectDetailsDto> {
  return apiRequest<ProjectDetailsDto>(`/v1/projects/${projectId}`)
}

export async function composeHttpWorkspace(projectId: string): Promise<ProjectWorkspace> {
  const [dto, users] = await Promise.all([fetchProjectDetails(projectId), getUsers()])
  const project = mapProject(dto)
  const tasks = dto.tasks.map(mapTask)
  const dependencies = dto.dependencies.map(mapDependency)
  const session = getHttpProjectSession(projectId)
  const currentEnd = latestEnd(tasks, project.targetEndDate)
  const previousEnd = session.previousProjectEndDate ?? currentEnd
  const taskUpdateAffectsAnalysis = session.lastChange.kind === 'task-updated'
    && session.lastChange.changes.some((change) => change.field === 'status' || change.field === 'startDate' || change.field === 'endDate')
  const analyzedAffectedTaskIds = session.lastChange.kind === 'task-updated'
    ? taskUpdateAffectsAnalysis ? findDownstreamTaskIds(session.lastChange.taskId, dependencies) : []
    : session.affectedTaskIds
  let impact = buildImpactAnalysis(
    project, tasks, dependencies, session.sourceTaskId, analyzedAffectedTaskIds,
    session.lastChange, previousEnd,
  )
  impact.projectedProjectEndDate = currentEnd
  impact.projectEndChangeDays = differenceInDays(currentEnd, previousEnd)
  impact.deadlineShiftDays = differenceInDays(currentEnd, project.targetEndDate)
  if (session.analysis.length > 0 && session.lastChange.kind !== 'task-updated') {
    impact.reasons = session.analysis
    impact.affectedTaskIds = [...new Set(session.analysis.flatMap((message) => message.affectedTaskIds))]
    impact.requiresIntervention = impact.deadlineShiftDays > 0 || impact.reasons.some((reason) => reason.severity !== 'info')
  }
  const currentIssues = buildCurrentProjectIssues(project, tasks, dependencies)
  impact = includeCurrentIssuesInImpact(impact, currentIssues)
  const completedTaskCount = tasks.filter((task) => task.status === 'completed').length
  const summary: ProjectSummary = {
    ...project,
    projectedEndDate: currentEnd,
    ownerName: users.get(project.creatorId) ?? 'Менеджер',
    health: deriveProjectHealth(project, tasks, currentIssues, impact.atRiskTaskIds, currentEnd),
    progress: calculateProjectProgress(completedTaskCount, tasks.length),
    taskCount: tasks.length,
    completedTaskCount,
  }
  return {
    project: summary,
    tasks,
    dependencies,
    assignees: dto.employees.map(mapEmployee),
    impact,
    currentIssues,
    projectBoundaryIssues: analyzeProjectBoundaries(project, tasks),
    recoveryScenarios: [],
  }
}

export async function listHttpProjectNavigationItems(): Promise<ProjectNavigationItem[]> {
  const projects = await apiRequest<ProjectListItemDto[]>('/v1/projects')
  return projects.map(mapProjectNavigationItem)
}
