import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { ProjectWorkspace } from '../../types/workspace'
import { buildTimelineDraftPreview } from '../../services/timelineDraft'
import { rebuildWorkspaceDerivedState } from '../../services/workspaceState'
import { OverviewWorkspaceView } from './OverviewWorkspaceView'
import { buildTaskDelayScenario } from '../../services/scenario/scenarioEngine'

const workspace: ProjectWorkspace = {
  project: { id: 'project', creatorId: 'manager', name: 'Проект', description: '', startDate: '2026-10-01', targetEndDate: '2026-10-31', projectedEndDate: '2026-10-31', ownerName: 'Менеджер', health: 'on-track', progress: 0, taskCount: 1, completedTaskCount: 0 },
  tasks: [{ id: 'task', projectId: 'project', title: 'Backend', startDate: '2026-10-01', endDate: '2026-10-03', plannedStartDate: '2026-10-01', plannedEndDate: '2026-10-03', durationDays: 3, progress: 0, assigneeId: 'employee', status: 'not-started', riskState: 'none', isCritical: false }],
  dependencies: [], assignees: [{ id: 'employee', projectId: 'project', name: 'Иван' }], recoveryScenarios: [], projectBoundaryIssues: [],
  currentIssues: { scheduleConflicts: [], statusConflicts: [], deadlineIssues: [], affectedTaskIds: [] },
  impact: { sourceTaskId: '', lastChange: { kind: 'session-started' }, affectedTaskIds: [], criticalTaskIds: ['task'], slackDaysByTaskId: { task: 0 }, atRiskTaskIds: [], previousProjectEndDate: '2026-10-31', projectedProjectEndDate: '2026-10-31', projectEndChangeDays: 0, deadlineShiftDays: 0, requiresIntervention: false, reasons: [], analyzedAt: '2026-10-01T00:00:00Z' },
}

describe('Overview workspace', () => {
  it('keeps timeline, task list, impact, current issues and automatic shift together', () => {
    const markup = renderToStaticMarkup(<OverviewWorkspaceView workspace={workspace} onTaskSelect={() => undefined} onTaskCreate={() => undefined} onTaskDraft={() => undefined} onApplyTimelineDraft={async () => undefined} onCancelTimelineDraft={() => undefined} onViewWorkload={() => undefined} onCreateDependency={async () => undefined} onPreviewScheduleShift={async () => { throw new Error('not called') }} onApplyScheduleShift={async () => undefined} />)
    expect(markup).toContain('Общий прогресс')
    expect(markup).toContain('План проекта')
    expect(markup).toContain('Требуют внимания')
    expect(markup).toContain('Последствия изменения')
    expect(markup).toContain('Что требует внимания')
    expect(markup).toContain('Автоматический сдвиг')
  })

  it('renders exact user draft dates and keeps its dependency conflict visible on Gantt', () => {
    const value = rebuildWorkspaceDerivedState({
      ...workspace,
      tasks: [
        { ...workspace.tasks[0], id: 'architecture', title: 'Architecture', startDate: '2026-10-01', endDate: '2026-10-05' },
        { ...workspace.tasks[0], id: 'backend', title: 'Backend', startDate: '2026-10-06', endDate: '2026-10-12' },
      ],
      dependencies: [{ id: 'architecture-backend', projectId: 'project', predecessorTaskId: 'architecture', successorTaskId: 'backend', type: 'finish-to-start' }],
    })
    const draft = buildTimelineDraftPreview(value, 'backend', { startDate: '2026-10-04', endDate: '2026-10-10' })
    const markup = renderToStaticMarkup(<OverviewWorkspaceView workspace={value} timelineDraft={draft} onTaskSelect={() => undefined} onTaskCreate={() => undefined} onTaskDraft={() => undefined} onApplyTimelineDraft={async () => undefined} onCancelTimelineDraft={() => undefined} onViewWorkload={() => undefined} onCreateDependency={async () => undefined} onPreviewScheduleShift={async () => { throw new Error('not called') }} onApplyScheduleShift={async () => undefined} />)

    expect(markup).toContain('data-timeline-task-target="backend"')
    expect(markup).toContain('data-task-start-date="2026-10-04"')
    expect(markup).toContain('data-task-end-date="2026-10-10"')
    expect(markup).toContain('data-task-schedule-conflict="true"')
    expect(draft.recommendedTaskChanges).toEqual(expect.arrayContaining([
      expect.objectContaining({ taskId: 'backend', proposedStartDate: '2026-10-06', proposedEndDate: '2026-10-12' }),
    ]))
  })

  it('uses scenario workspace across the overview while keeping the real plan marked as unchanged', () => {
    const draft = buildTaskDelayScenario(workspace, 'task', 4)
    const markup = renderToStaticMarkup(<OverviewWorkspaceView workspace={workspace} scenarioDraft={draft} onScenarioCreate={() => undefined} onScenarioCancel={() => undefined} onScenarioApply={async () => undefined} onTaskSelect={() => undefined} onTaskCreate={() => undefined} onTaskDraft={() => undefined} onApplyTimelineDraft={async () => undefined} onCancelTimelineDraft={() => undefined} onViewWorkload={() => undefined} onCreateDependency={async () => undefined} onPreviewScheduleShift={async () => { throw new Error('not called') }} onApplyScheduleShift={async () => undefined} />)

    expect(markup).toContain('Режим симуляции')
    expect(markup).toContain('Реальный план не изменён')
    expect(markup).toContain('data-task-end-date="2026-10-07"')
    expect(markup).toContain('Применить изменение')
    expect(workspace.tasks[0].endDate).toBe('2026-10-03')
  })
})
