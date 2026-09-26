import { apiRequest } from '../client'
import { analyzeProjectBoundaries } from '../../services/projectBoundaryAnalysis'
import { buildCurrentProjectIssues, buildImpactAnalysis, differenceInDays } from '../../services/scheduleEngine'
import type { ProjectSummary } from '../../types/project'
import type { ProjectWorkspace } from '../../types/workspace'
import { getHttpProjectSession } from './session'
import { mapAnalysisMessage, mapDependency, mapEmployee, mapProject, mapTask } from './mappers'
import type { ProjectDetailsDto, ProjectListItemDto, UserDto } from './types'

let usersCache: Promise<Map<string, string>> | null = null

async function getUsers(): Promise<Map<string, string>> {
  usersCache ??= apiRequest<UserDto[]>('/api/v1/users')
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
  return apiRequest<ProjectDetailsDto>(`/api/v1/projects/${projectId}`)
}

export async function composeHttpWorkspace(projectId: string): Promise<ProjectWorkspace> {
  const [dto, users] = await Promise.all([fetchProjectDetails(projectId), getUsers()])
  const project = mapProject(dto)
  const tasks = dto.tasks.map(mapTask)
  const dependencies = dto.dependencies.map(mapDependency)
  const session = getHttpProjectSession(projectId)
  const currentEnd = latestEnd(tasks, project.targetEndDate)
  const previousEnd = session.previousProjectEndDate ?? currentEnd
  const impact = buildImpactAnalysis(
    project, tasks, dependencies, session.sourceTaskId, session.affectedTaskIds,
    session.lastChange, previousEnd,
  )
  impact.projectedProjectEndDate = currentEnd
  impact.projectEndChangeDays = differenceInDays(currentEnd, previousEnd)
  impact.deadlineShiftDays = differenceInDays(currentEnd, project.targetEndDate)
  if (session.analysis.length > 0) {
    impact.reasons = session.analysis.map(mapAnalysisMessage)
    impact.affectedTaskIds = [...new Set(session.analysis.flatMap((message) => message.affectedTaskIds))]
    impact.requiresIntervention = impact.deadlineShiftDays > 0 || impact.reasons.some((reason) => reason.severity !== 'info')
  }
  const currentIssues = buildCurrentProjectIssues(tasks, dependencies)
  const completedTaskCount = tasks.filter((task) => task.status === 'completed').length
  const summary: ProjectSummary = {
    ...project,
    projectedEndDate: currentEnd,
    ownerName: users.get(project.creatorId) ?? 'Менеджер',
    health: currentIssues.scheduleConflicts.length > 0 || impact.atRiskTaskIds.length > 0 || impact.deadlineShiftDays > 0 ? 'at-risk' : 'on-track',
    progress: tasks.length === 0 ? 0 : Math.round(tasks.reduce((sum, task) => sum + task.progress, 0) / tasks.length),
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

export async function listHttpProjectSummaries(): Promise<ProjectSummary[]> {
  const projects = await apiRequest<ProjectListItemDto[]>('/api/v1/projects')
  return Promise.all(projects.map(async (project) => (await composeHttpWorkspace(project.id)).project))
}
