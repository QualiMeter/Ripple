import { listMockEmployees } from '../mocks/employeeStore'
import { createMockProject, deleteMockProject, getMockProject, listMockProjects, updateMockProject } from '../mocks/projectStore'
import { deleteMockProjectState, getMockProjectState } from '../mocks/workspaceStore'
import { deleteMockProjectEmployees } from '../mocks/employeeStore'
import { analyzeProjectBoundaries } from '../services/projectBoundaryAnalysis'
import { calculateProjectProgress } from '../services/projectProgress'
import { validateProjectInput } from '../services/projectValidation'
import { buildRecoveryScenarios } from '../services/recoveryEngine'
import { buildCurrentProjectIssues, buildImpactAnalysis } from '../services/scheduleEngine'
import type { ProjectWorkspace } from '../types/workspace'
import type { ProjectsApi } from './projects.api'
import { deriveProjectHealth, includeCurrentIssuesInImpact } from '../services/currentProjectAnalysis'

function buildWorkspace(projectId: string): ProjectWorkspace {
  const project = getMockProject(projectId)
  if (!project) throw new Error('Проект не найден')
  const state = getMockProjectState(projectId)
  const tasks = state.tasks.map((task) => ({ ...task }))
  const dependencies = state.dependencies.map((dependency) => ({ ...dependency }))
  const completedTaskCount = tasks.filter((task) => task.status === 'completed').length
  const previousProjectedEndDate =
      state.previousProjectedEndDate || project.targetEndDate
  let impact = buildImpactAnalysis(
    project,
    tasks,
    dependencies,
    state.lastChangedTaskId,
    state.affectedTaskIds ?? undefined,
    state.lastChange,
      previousProjectedEndDate,
  )
  const currentIssues = buildCurrentProjectIssues(project, tasks, dependencies)
  impact = includeCurrentIssuesInImpact(impact, currentIssues)
  return {
    project: {
      ...project,
      projectedEndDate: impact.projectedProjectEndDate,
      ownerName: 'Майя Чен',
      health: deriveProjectHealth(project, tasks, currentIssues, impact.atRiskTaskIds, impact.projectedProjectEndDate),
      progress: calculateProjectProgress(completedTaskCount, tasks.length),
      taskCount: tasks.length,
      completedTaskCount,
    },
    tasks,
    dependencies,
    assignees: listMockEmployees(projectId),
    impact,
    currentIssues,
    projectBoundaryIssues: analyzeProjectBoundaries(project, tasks),
    recoveryScenarios: buildRecoveryScenarios(impact),
  }
}

export const mockProjectsApi: ProjectsApi = {
  async listProjects() {
    await new Promise((resolve) => setTimeout(resolve, 120))
    return listMockProjects().map((project) => buildWorkspace(project.id).project)
  },

  async createProject(request) {
    await new Promise((resolve) => setTimeout(resolve, 180))
    validateProjectInput(request)
    return createMockProject(request)
  },

  async updateProject(projectId, request) {
    await new Promise((resolve) => setTimeout(resolve, 180))
    const current = getMockProject(projectId)
    if (!current) throw new Error('Проект не найден')
    validateProjectInput({
      name: request.name ?? current.name,
      startDate: request.startDate ?? current.startDate,
      targetEndDate: request.targetEndDate ?? current.targetEndDate,
    })
    return updateMockProject(projectId, request)
  },

  async deleteProject(projectId) {
    await new Promise((resolve) => setTimeout(resolve, 180))
    deleteMockProject(projectId)
    deleteMockProjectState(projectId)
    deleteMockProjectEmployees(projectId)
  },

  async getWorkspace(projectId: string): Promise<ProjectWorkspace> {
    await new Promise((resolve) => setTimeout(resolve, 260))
    return buildWorkspace(projectId)
  },
}
