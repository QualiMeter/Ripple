import { demoAssignees } from '../mocks/assignees'
import { demoDependencies } from '../mocks/dependencies'
import { demoProjects } from '../mocks/projects'
import { getMockProjectState } from '../mocks/workspaceStore'
import { buildRecoveryScenarios } from '../services/recoveryEngine'
import { buildImpactAnalysis } from '../services/scheduleEngine'
import type { ProjectWorkspace } from '../types/workspace'
import type { ProjectsApi } from './projects.api'

export const mockProjectsApi: ProjectsApi = {
  async getWorkspace(projectId: string): Promise<ProjectWorkspace> {
    await new Promise((resolve) => setTimeout(resolve, 260))
    const project = demoProjects.find((candidate) => candidate.id === projectId)
    if (!project) throw new Error('Проект не найден')
    const state = getMockProjectState(projectId)
    const tasks = state.tasks.map((task) => ({ ...task }))
    const dependencies = demoDependencies.filter((dependency) => dependency.projectId === projectId)
    const completedTaskCount = tasks.filter((task) => task.status === 'completed').length
    const impact = buildImpactAnalysis(
      project,
      tasks,
      dependencies,
      state.lastChangedTaskId,
      state.affectedTaskIds ?? undefined,
    )
    return {
      project: {
        ...project,
        projectedEndDate: impact.projectedProjectEndDate,
        health: impact.requiresIntervention || impact.atRiskTaskIds.length > 0 ? 'at-risk' : 'on-track',
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
      recoveryScenarios: buildRecoveryScenarios(impact),
    }
  },
}
