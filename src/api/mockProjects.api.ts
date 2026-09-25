import { demoAssignees } from '../mocks/assignees'
import { demoDependencies } from '../mocks/dependencies'
import { demoProjects } from '../mocks/projects'
import { demoTasks } from '../mocks/tasks'
import { buildImpactAnalysis } from '../services/scheduleEngine'
import type { RecoveryScenario } from '../types/impact'
import type { ProjectWorkspace } from '../types/workspace'
import type { ProjectsApi } from './projects.api'

const recoveryScenarios: RecoveryScenario[] = [
  {
    id: 'parallel-qa',
    title: 'Start QA in parallel',
    description: 'Begin test planning and stable-module regression before the full integration handoff.',
    expectedProjectEndDate: '2026-11-07',
    recoveredDays: 4,
    actions: ['Start QA prep on Oct 29', 'Keep final regression after integration'],
    confidence: 'high',
  },
  {
    id: 'api-support',
    title: 'Pair on the Analytics API',
    description: 'Move one backend engineer from infrastructure after its release checklist is complete.',
    expectedProjectEndDate: '2026-11-08',
    recoveredDays: 3,
    actions: ['Reassign 50% of infrastructure capacity', 'Reduce API duration by 2 days'],
    confidence: 'medium',
  },
]

export const mockProjectsApi: ProjectsApi = {
  async getWorkspace(projectId: string): Promise<ProjectWorkspace> {
    await new Promise((resolve) => setTimeout(resolve, 260))
    const project = demoProjects.find((candidate) => candidate.id === projectId)
    if (!project) throw new Error('Project not found')
    const tasks = demoTasks.filter((task) => task.projectId === projectId)
    const dependencies = demoDependencies.filter((dependency) => dependency.projectId === projectId)
    const completedTaskCount = tasks.filter((task) => task.status === 'completed').length
    return {
      project: {
        ...project,
        progress: Math.round(tasks.reduce((sum, task) => sum + task.progress, 0) / tasks.length),
        taskCount: tasks.length,
        completedTaskCount,
      },
      tasks,
      dependencies,
      assignees: demoAssignees,
      impact: buildImpactAnalysis(project, tasks, dependencies, 'api'),
      recoveryScenarios,
    }
  },
}
