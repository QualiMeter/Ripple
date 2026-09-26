import { demoAssignees } from '../mocks/assignees'
import { demoProjects } from '../mocks/projects'
import { getMockProjectState } from '../mocks/workspaceStore'
import { buildRecoveryScenarios } from '../services/recoveryEngine'
import { buildCurrentProjectIssues, buildImpactAnalysis } from '../services/scheduleEngine'
import type { ProjectWorkspace } from '../types/workspace'
import type { ProjectsApi } from './projects.api'

export const mockProjectsApi: ProjectsApi = {
  async getWorkspace(projectId: string): Promise<ProjectWorkspace> {
    await new Promise((resolve) => setTimeout(resolve, 260))
    const project = demoProjects.find((candidate) => candidate.id === projectId)
    if (!project) throw new Error('Проект не найден')
    const state = getMockProjectState(projectId)
    const tasks = state.tasks.map((task) => ({ ...task }))
    const dependencies = state.dependencies.map((dependency) => ({ ...dependency }))
    const completedTaskCount = tasks.filter((task) => task.status === 'completed').length
    const impact = buildImpactAnalysis(
      project,
      tasks,
      dependencies,
      state.lastChangedTaskId,
      state.affectedTaskIds ?? undefined,
      state.lastChange,
      state.previousProjectedEndDate,
    )
    const currentIssues = buildCurrentProjectIssues(tasks, dependencies)
    return {
      project: {
        ...project,
        projectedEndDate: impact.projectedProjectEndDate,
        health: currentIssues.scheduleConflicts.length > 0 || impact.requiresIntervention || impact.atRiskTaskIds.length > 0 ? 'at-risk' : 'on-track',
        progress: tasks.length > 0
          ? Math.round(tasks.reduce((sum, task) => sum + task.progress, 0) / tasks.length)
          : 0,
        taskCount: tasks.length,
        completedTaskCount,
      },
      tasks,
      dependencies,
      assignees: demoAssignees,
      impact,
      currentIssues,
      recoveryScenarios: buildRecoveryScenarios(impact),
    }
  },
}
