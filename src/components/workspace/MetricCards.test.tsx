import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { ProjectWorkspace } from '../../types/workspace'
import { MetricCards } from './MetricCards'

const workspace = {
  project: {
    id: 'project', creatorId: 'manager', name: 'Проект', description: '', startDate: '2026-06-01', targetEndDate: '2026-06-30',
    projectedEndDate: '2026-07-02', ownerName: 'Менеджер', health: 'at-risk', progress: 25, taskCount: 8, completedTaskCount: 2,
  },
  tasks: [{
    id: 'task', projectId: 'project', title: 'Задача', startDate: '2026-06-01', endDate: '2026-06-02', plannedStartDate: '2026-06-01', plannedEndDate: '2026-06-02', durationDays: 2, progress: 0, assigneeId: 'employee', status: 'not-started', riskState: 'none', isCritical: false,
  }],
  dependencies: [], assignees: [], recoveryScenarios: [], projectBoundaryIssues: [],
  currentIssues: { scheduleConflicts: [], statusConflicts: [], deadlineIssues: [], affectedTaskIds: [] },
  impact: {
    sourceTaskId: '', lastChange: { kind: 'session-started' }, affectedTaskIds: [], criticalTaskIds: ['task'], atRiskTaskIds: [],
    previousProjectEndDate: '2026-06-30', projectedProjectEndDate: '2026-07-02', projectEndChangeDays: 2, deadlineShiftDays: 2,
    requiresIntervention: true, reasons: [], analyzedAt: '2026-06-01T00:00:00.000Z',
  },
} satisfies ProjectWorkspace

describe('MetricCards', () => {
  it('shows project progress based on equally weighted completed tasks', () => {
    const markup = renderToStaticMarkup(<MetricCards workspace={workspace} />)
    expect(markup).toContain('Общий прогресс')
    expect(markup).toContain('25%')
    expect(markup).toContain('2 из 8 задач завершено')
    expect(markup).toContain('width:25%')
  })

  it('uses the computed critical task metric wording', () => {
    const markup = renderToStaticMarkup(<MetricCards workspace={workspace} />)
    expect(markup).toContain('Критические задачи')
    expect(markup).toContain('Задачи без запаса по срокам')
  })
})
