import { describe, expect, it } from 'vitest'
import type { ImpactReason } from '../types/impact'
import type { Dependency } from '../types/dependency'
import type { ProjectTask } from '../types/task'
import type { ProjectWorkspace } from '../types/workspace'
import { buildCurrentProjectIssues, buildImpactAnalysis } from './scheduleEngine'
import { buildProjectRecommendations } from './projectRecommendations'

function task(id: string, startDate: string, endDate: string, assigneeId = 'employee'): ProjectTask {
  return {
    id, projectId: 'project', title: id, startDate, endDate, plannedStartDate: startDate, plannedEndDate: endDate,
    durationDays: 4, progress: 0, assigneeId, status: 'not-started', riskState: 'none', isCritical: false,
  }
}

function workspace(tasks: ProjectTask[] = [task('A', '2026-09-01', '2026-09-04')], dependencies: Dependency[] = []): ProjectWorkspace {
  const project = { id: 'project', creatorId: 'manager', name: 'Проект', description: '', startDate: '2026-09-01', targetEndDate: '2026-09-30' }
  const impact = buildImpactAnalysis(project, tasks, dependencies, '', [], { kind: 'session-started' })
  return {
    project: { ...project, projectedEndDate: impact.projectedProjectEndDate, ownerName: 'Менеджер', health: 'on-track', progress: 0, taskCount: tasks.length, completedTaskCount: 0 },
    tasks, dependencies, assignees: [], impact,
    currentIssues: buildCurrentProjectIssues(project, tasks, dependencies, '2026-09-01'),
    projectBoundaryIssues: [], recoveryScenarios: [],
  }
}

describe('project recommendations', () => {
  it('calculates concrete dates and expected project end for a dependency conflict', () => {
    const dependencies: Dependency[] = [{ id: 'a-b', projectId: 'project', predecessorTaskId: 'A', successorTaskId: 'B', type: 'finish-to-start' }]
    const value = workspace([
      { ...task('A', '2026-09-01', '2026-09-14'), title: 'Architecture' },
      { ...task('B', '2026-09-14', '2026-09-18'), title: 'Backend' },
    ], dependencies)

    const recommendation = buildProjectRecommendations(value)[0]

    expect(recommendation).toMatchObject({
      id: 'schedule-conflicts',
      problem: 'Конфликт зависимости',
      action: { type: 'preview-shift', sourceTaskId: 'A', label: 'Посмотреть и применить' },
    })
    expect(recommendation.evidence).toContain('Backend» начинается 14.09.2026')
    expect(recommendation.evidence).toContain('не раньше 15.09.2026')
    expect(recommendation.proposedAction).toContain('15.09.2026–19.09.2026')
    expect(recommendation.expectedEffect).toContain('с 18.09.2026 на 19.09.2026 (+1 день)')
  })

  it('shows the concrete extension date and two deadline choices', () => {
    const value = workspace([task('A', '2026-09-25', '2026-10-04')])
    value.project.projectedEndDate = '2026-10-04'
    value.impact.projectedProjectEndDate = '2026-10-04'

    const recommendation = buildProjectRecommendations(value).find((item) => item.id === 'project-deadline')

    expect(recommendation?.evidence).toContain('04.10.2026 вместо 30.09.2026')
    expect(recommendation?.proposedAction).toContain('продлением срока до 04.10.2026')
    expect(recommendation?.alternatives).toEqual([
      expect.stringContaining('Продлить плановый срок на 4 дня — до 04.10.2026'),
      expect.stringContaining('Сохранить срок 30.09.2026'),
    ])
  })

  it('names the exact successor and predecessor in a status conflict', () => {
    const dependencies: Dependency[] = [{ id: 'a-b', projectId: 'project', predecessorTaskId: 'A', successorTaskId: 'B', type: 'finish-to-start' }]
    const value = workspace([
      { ...task('A', '2026-09-01', '2026-09-04'), title: 'Backend' },
      { ...task('B', '2026-09-05', '2026-09-08'), title: 'Тестирование', status: 'in-progress' },
    ], dependencies)
    const statusConflict: ImpactReason = {
      sourceTaskId: 'B', affectedTaskIds: ['A', 'B'], reason: 'Незавершённый predecessor', consequence: 'Проверьте статус.', severity: 'warning', action: { type: 'open-task', taskId: 'B' },
    }
    value.currentIssues = { ...value.currentIssues, statusConflicts: [statusConflict], affectedTaskIds: ['A', 'B'] }

    const recommendation = buildProjectRecommendations(value).find((item) => item.id === 'status-conflicts')

    expect(recommendation?.evidence).toContain('«Тестирование» находится в статусе «В работе»')
    expect(recommendation?.evidence).toContain('«Backend» ещё не завершён')
    expect(recommendation?.proposedAction).toContain('вернуть статус «Не в работе»')
    expect(recommendation?.action).toEqual({ type: 'open-task', taskId: 'B', label: 'Открыть Тестирование' })
  })

  it('offers two concrete alternatives without invented values when relation data is insufficient', () => {
    const value = workspace()
    value.currentIssues = {
      ...value.currentIssues,
      statusConflicts: [{ sourceTaskId: 'missing', affectedTaskIds: ['missing'], reason: 'Статусы связанных задач расходятся.', consequence: 'Нужно решение.', severity: 'warning' }],
    }

    const recommendation = buildProjectRecommendations(value)[0]

    expect(recommendation).toMatchObject({ id: 'status-conflicts', problem: 'Конфликт статусов' })
    expect(recommendation.alternatives).toHaveLength(2)
    expect(`${recommendation.proposedAction} ${recommendation.expectedEffect} ${recommendation.alternatives?.join(' ')}`).not.toMatch(/\d{2}\.\d{2}\.\d{4}|\d+%/)
  })

  it('shows a schedule-based reassignment candidate and before/after load', () => {
    const value = workspace([
      { ...task('A', '2026-09-01', '2026-09-12'), title: 'Backend' },
      { ...task('B', '2026-09-02', '2026-09-12'), title: 'Frontend' },
      { ...task('C', '2026-09-03', '2026-09-10'), title: 'Интеграция' },
      { ...task('D', '2026-09-04', '2026-09-05', 'second'), title: 'Ревью' },
    ])
    value.assignees = [
      { id: 'employee', projectId: 'project', name: 'Смирнов' },
      { id: 'second', projectId: 'project', name: 'Петров' },
    ]

    const recommendation = buildProjectRecommendations(value).find((item) => item.id === 'team-schedule-load')

    expect(recommendation?.proposedAction).toContain('сотруднику Петров')
    expect(recommendation?.proposedAction).toContain('Кандидат выбран только по расписанию')
    expect(recommendation?.expectedEffect).toMatch(/пик Смирнов снизится с 3 до 2/)
    expect(recommendation?.expectedEffect).toMatch(/пик Петров изменится с 1 до 2/)
    expect(recommendation?.action).toEqual({ type: 'view-workload', label: 'Сравнить нагрузку' })
  })

  it('describes an overdue task with its actual date and status', () => {
    const value = workspace([{ ...task('A', '2026-08-01', '2026-08-18'), title: 'Frontend', status: 'in-progress' }])
    value.currentIssues = buildCurrentProjectIssues(value.project, value.tasks, value.dependencies, '2026-09-01')

    const recommendation = buildProjectRecommendations(value).find((item) => item.id === 'overdue-tasks')

    expect(recommendation?.evidence).toContain('Frontend» должна была завершиться 18.08.2026')
    expect(recommendation?.evidence).toContain('«В работе»')
    expect(recommendation?.proposedAction).toContain('подтвердить фактический статус')
  })

  it('states that intervention is not required when the plan has no issues', () => {
    expect(buildProjectRecommendations(workspace())).toEqual([
      expect.objectContaining({ id: 'no-action-required', problem: 'Вмешательство не требуется', tone: 'success' }),
    ])
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
