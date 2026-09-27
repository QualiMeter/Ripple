import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { ImpactReason } from '../../types/impact'
import type { ProjectWorkspace } from '../../types/workspace'
import { ImpactPanel } from './ImpactPanel'

function issue(sourceTaskId: string, reason: string, severity: ImpactReason['severity'], action: ImpactReason['action']): ImpactReason {
  return { sourceTaskId, affectedTaskIds: [sourceTaskId], reason, consequence: 'Требуется решение.', severity, action }
}

const workspace: ProjectWorkspace = {
  project: {
    id: 'project', creatorId: 'manager', name: 'Проект', description: '', startDate: '2026-09-01', targetEndDate: '2026-10-31',
    projectedEndDate: '2026-10-31', ownerName: 'Менеджер', health: 'at-risk', progress: 0, taskCount: 2, completedTaskCount: 0,
  },
  tasks: [
    { id: 'a', projectId: 'project', title: 'A', startDate: '2026-10-01', endDate: '2026-10-02', plannedStartDate: '2026-10-01', plannedEndDate: '2026-10-02', durationDays: 2, progress: 0, assigneeId: 'e', status: 'not-started', riskState: 'none', isCritical: false },
    { id: 'b', projectId: 'project', title: 'B', startDate: '2026-10-03', endDate: '2026-10-04', plannedStartDate: '2026-10-03', plannedEndDate: '2026-10-04', durationDays: 2, progress: 0, assigneeId: 'e', status: 'in-progress', riskState: 'none', isCritical: false },
  ],
  dependencies: [], assignees: [], recoveryScenarios: [], projectBoundaryIssues: [],
  currentIssues: {
    scheduleConflicts: [issue('a', 'Конфликт дат', 'warning', { type: 'preview-shift' })],
    statusConflicts: [issue('b', 'Конфликт статуса', 'error', { type: 'open-task', taskId: 'b' })],
    deadlineIssues: [issue('b', 'Просроченный срок', 'warning', { type: 'open-task', taskId: 'b' })],
    affectedTaskIds: ['a', 'b'],
  },
  impact: {
    sourceTaskId: '', lastChange: { kind: 'session-started' }, affectedTaskIds: [], criticalTaskIds: [], slackDaysByTaskId: {}, atRiskTaskIds: [],
    previousProjectEndDate: '2026-10-31', projectedProjectEndDate: '2026-10-31', projectEndChangeDays: 0, deadlineShiftDays: 0,
    requiresIntervention: false, reasons: [], analyzedAt: '2026-09-27T00:00:00.000Z',
  },
}

describe('ImpactPanel current issues', () => {
  it('shows all issue categories and their total count', () => {
    const markup = renderToStaticMarkup(<ImpactPanel workspace={workspace} onPreviewScheduleShift={async () => { throw new Error('not called') }} onApplyScheduleShift={async () => undefined} onTaskSelect={() => undefined} />)
    expect(markup).toContain('aria-label="Всего текущих проблем: 3"')
    expect(markup).toContain('Конфликты зависимостей и дат')
    expect(markup).toContain('Логические конфликты статусов')
    expect(markup).toContain('Просроченные сроки')
    expect(markup).toContain('Рассчитать сдвиг')
    expect(markup).toContain('Открыть задачу')
  })
})
