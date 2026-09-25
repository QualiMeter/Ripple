import { demoAssignees } from '../mocks/assignees'
import { demoDependencies } from '../mocks/dependencies'
import { demoProjects } from '../mocks/projects'
import { getMockProjectState } from '../mocks/workspaceStore'
import { buildImpactAnalysis } from '../services/scheduleEngine'
import type { RecoveryScenario } from '../types/impact'
import type { ProjectWorkspace } from '../types/workspace'
import type { ProjectsApi } from './projects.api'

const recoveryScenarios: RecoveryScenario[] = [
  {
    id: 'parallel-qa',
    title: 'Запустить QA параллельно',
    description: 'Начать подготовку тестов и проверку стабильных модулей до завершения всей интеграции.',
    expectedProjectEndDate: '2026-11-07',
    recoveredDays: 4,
    actions: ['Начать подготовку QA 29 октября', 'Провести итоговый регресс после интеграции'],
    confidence: 'high',
  },
  {
    id: 'api-support',
    title: 'Усилить работу над API аналитики',
    description: 'Подключить серверного разработчика после завершения подготовки инфраструктуры релиза.',
    expectedProjectEndDate: '2026-11-08',
    recoveredDays: 3,
    actions: ['Перенаправить 50% ресурса инфраструктуры', 'Сократить работу над API на 2 дня'],
    confidence: 'medium',
  },
]

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
      recoveryScenarios,
    }
  },
}
