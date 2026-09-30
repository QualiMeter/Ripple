import { describe, expect, it } from 'vitest'
import type { ImpactReason } from '../types/impact'
import type { Dependency } from '../types/dependency'
import type { ProjectTask } from '../types/task'
import type { ProjectWorkspace } from '../types/workspace'
import { buildCurrentProjectIssues, buildImpactAnalysis } from './scheduleEngine'
import { buildProjectRecommendations } from './projectRecommendations'

function task(id: string, startDate: string, endDate: string): ProjectTask {
  return {
    id, projectId: 'project', title: id, startDate, endDate, plannedStartDate: startDate, plannedEndDate: endDate,
    durationDays: 4, progress: 0, assigneeId: 'employee', status: 'not-started', riskState: 'none', isCritical: false,
  }
}

function workspace(tasks: ProjectTask[] = [task('A', '2026-09-01', '2026-09-04')]): ProjectWorkspace {
  const project = { id: 'project', creatorId: 'manager', name: 'Проект', description: '', startDate: '2026-09-01', targetEndDate: '2026-09-30' }
  const dependencies: Dependency[] = []
  const impact = buildImpactAnalysis(project, tasks, dependencies, '', [], { kind: 'session-started' })
  return {
    project: { ...project, projectedEndDate: impact.projectedProjectEndDate, ownerName: 'Менеджер', health: 'on-track', progress: 0, taskCount: tasks.length, completedTaskCount: 0 },
    tasks, dependencies, assignees: [], impact,
    currentIssues: buildCurrentProjectIssues(project, tasks, dependencies, '2026-09-01'),
    projectBoundaryIssues: [], recoveryScenarios: [],
  }
}

describe('project recommendations', () => {
  it('recommends automatic shift for a dependency schedule conflict', () => {
    const value = workspace([task('A', '2026-09-01', '2026-09-14'), task('B', '2026-09-14', '2026-09-18')])
    value.dependencies = [{ id: 'a-b', projectId: 'project', predecessorTaskId: 'A', successorTaskId: 'B', type: 'finish-to-start' }]
    value.currentIssues = buildCurrentProjectIssues(value.project, value.tasks, value.dependencies, '2026-09-01')
    const recommendation = buildProjectRecommendations(value)[0]
    expect(recommendation).toMatchObject({ id: 'schedule-conflicts', title: 'Устранить конфликт расписания', action: { type: 'preview-shift', sourceTaskId: 'A' } })
  })

  it('recommends deciding on the project deadline when the plan overruns it', () => {
    const value = workspace([task('A', '2026-09-25', '2026-10-04')])
    value.project.projectedEndDate = '2026-10-04'
    value.impact.projectedProjectEndDate = '2026-10-04'
    expect(buildProjectRecommendations(value)).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'project-deadline', title: 'Определиться со сроком проекта' }),
    ]))
  })

  it('recommends checking a task for a status conflict', () => {
    const value = workspace()
    const statusConflict: ImpactReason = {
      sourceTaskId: 'A', affectedTaskIds: ['A'], reason: 'Незавершённый predecessor', consequence: 'Проверьте статус.', severity: 'warning', action: { type: 'open-task', taskId: 'A' },
    }
    value.currentIssues = { ...value.currentIssues, statusConflicts: [statusConflict], affectedTaskIds: ['A'] }
    expect(buildProjectRecommendations(value)[0]).toMatchObject({ id: 'status-conflicts', action: { type: 'open-task', taskId: 'A' } })
  })

  it('states that intervention is not required when the plan has no issues', () => {
    expect(buildProjectRecommendations(workspace())).toEqual([
      expect.objectContaining({ id: 'no-action-required', title: 'Вмешательство не требуется', tone: 'success' }),
    ])
  })

  it('adds a workload recommendation without inventing utilization percentages', () => {
    const value = workspace([
      task('A', '2026-09-01', '2026-09-10'),
      task('B', '2026-09-02', '2026-09-10'),
      task('C', '2026-09-03', '2026-09-10'),
    ])
    value.assignees = [
      { id: 'employee', projectId: 'project', name: 'Смирнов' },
      { id: 'idle', projectId: 'project', name: 'Петров' },
    ]
    const recommendations = buildProjectRecommendations(value)
    expect(recommendations).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'team-workload', title: 'Неравномерная загрузка команды', action: { type: 'view-workload', label: 'Посмотреть загрузку' } })]))
    expect(recommendations).toHaveLength(1)
  })

  it('recommends reviewing high parallel workload when the colleague has one active task', () => {
    const value = workspace([
      task('A', '2026-09-01', '2026-09-10'),
      task('B', '2026-09-02', '2026-09-10'),
      task('C', '2026-09-03', '2026-09-10'),
      { ...task('D', '2026-09-03', '2026-09-05'), assigneeId: 'second' },
    ])
    value.assignees = [
      { id: 'employee', projectId: 'project', name: 'Сергей' },
      { id: 'second', projectId: 'project', name: 'Антон' },
    ]

    const recommendations = buildProjectRecommendations(value)

    expect(recommendations).toEqual([expect.objectContaining({
      id: 'team-high-workload',
      title: 'Высокая параллельная загрузка',
      description: expect.stringContaining('Сергей ведёт 3 задачи одновременно'),
    })])
  })

  it('returns no more than three attention cards', () => {
    const value = workspace([
      task('A', '2026-09-01', '2026-10-04'),
      task('B', '2026-09-01', '2026-10-04'),
      task('C', '2026-09-01', '2026-10-04'),
    ])
    value.assignees = [
      { id: 'employee', projectId: 'project', name: 'Смирнов' },
      { id: 'idle', projectId: 'project', name: 'Петров' },
    ]
    value.impact.projectedProjectEndDate = '2026-10-04'
    value.currentIssues = {
      scheduleConflicts: [],
      statusConflicts: [{ sourceTaskId: 'A', affectedTaskIds: ['B'], reason: 'Статус', consequence: 'Проверить', severity: 'warning' }],
      deadlineIssues: [{ sourceTaskId: 'A', affectedTaskIds: ['A'], reason: 'Срок', consequence: 'Проверить', severity: 'warning' }],
      affectedTaskIds: ['A', 'B'],
    }
    expect(buildProjectRecommendations(value)).toHaveLength(3)
  })
})
