import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { ProjectWorkspace } from '../../types/workspace'
import { OverviewWorkspaceView } from './OverviewWorkspaceView'

const workspace: ProjectWorkspace = {
  project: { id: 'project', creatorId: 'manager', name: 'Проект', description: '', startDate: '2026-10-01', targetEndDate: '2026-10-31', projectedEndDate: '2026-10-31', ownerName: 'Менеджер', health: 'on-track', progress: 0, taskCount: 1, completedTaskCount: 0 },
  tasks: [{ id: 'task', projectId: 'project', title: 'Backend', startDate: '2026-10-01', endDate: '2026-10-03', plannedStartDate: '2026-10-01', plannedEndDate: '2026-10-03', durationDays: 3, progress: 0, assigneeId: 'employee', status: 'not-started', riskState: 'none', isCritical: false }],
  dependencies: [], assignees: [{ id: 'employee', projectId: 'project', name: 'Иван' }], recoveryScenarios: [], projectBoundaryIssues: [],
  currentIssues: { scheduleConflicts: [], statusConflicts: [], deadlineIssues: [], affectedTaskIds: [] },
  impact: { sourceTaskId: '', lastChange: { kind: 'session-started' }, affectedTaskIds: [], criticalTaskIds: ['task'], slackDaysByTaskId: { task: 0 }, atRiskTaskIds: [], previousProjectEndDate: '2026-10-31', projectedProjectEndDate: '2026-10-31', projectEndChangeDays: 0, deadlineShiftDays: 0, requiresIntervention: false, reasons: [], analyzedAt: '2026-10-01T00:00:00Z' },
}

describe('Overview workspace', () => {
  it('keeps timeline, task list, impact, current issues and automatic shift together', () => {
    const markup = renderToStaticMarkup(<OverviewWorkspaceView workspace={workspace} showAllTasks={false} onShowAllTasksChange={() => undefined} onTaskSelect={() => undefined} onTaskCreate={() => undefined} onPreviewScheduleShift={async () => { throw new Error('not called') }} onApplyScheduleShift={async () => undefined} />)
    expect(markup).toContain('Общий прогресс')
    expect(markup).toContain('План проекта')
    expect(markup).toContain('Требуют внимания')
    expect(markup).toContain('Последствия изменения')
    expect(markup).toContain('Текущие проблемы проекта')
    expect(markup).toContain('Автоматический сдвиг')
  })
})
