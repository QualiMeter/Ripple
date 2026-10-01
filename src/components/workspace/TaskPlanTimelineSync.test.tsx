// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { ProjectWorkspace } from '../../types/workspace'
import { OverviewWorkspaceView } from './OverviewWorkspaceView'

const workspace: ProjectWorkspace = {
  project: { id: 'project', creatorId: 'owner', name: 'Проект', description: '', startDate: '2026-10-01', targetEndDate: '2026-10-10', projectedEndDate: '2026-10-06', ownerName: 'Owner', health: 'on-track', progress: 0, taskCount: 2, completedTaskCount: 0 },
  tasks: [
    { id: 'critical', projectId: 'project', title: 'Критическая задача', startDate: '2026-10-01', endDate: '2026-10-02', plannedStartDate: '2026-10-01', plannedEndDate: '2026-10-02', durationDays: 2, progress: 0, assigneeId: 'employee', status: 'not-started', riskState: 'none', isCritical: true },
    { id: 'buffer', projectId: 'project', title: 'Задача с запасом', startDate: '2026-10-03', endDate: '2026-10-06', plannedStartDate: '2026-10-03', plannedEndDate: '2026-10-06', durationDays: 4, progress: 0, assigneeId: 'employee', status: 'not-started', riskState: 'none', isCritical: false },
  ],
  dependencies: [], assignees: [{ id: 'employee', projectId: 'project', name: 'Иван' }],
  impact: { sourceTaskId: '', lastChange: { kind: 'session-started' }, affectedTaskIds: [], criticalTaskIds: ['critical'], slackDaysByTaskId: { critical: 0, buffer: 4 }, atRiskTaskIds: [], previousProjectEndDate: '2026-10-06', projectedProjectEndDate: '2026-10-06', projectEndChangeDays: 0, deadlineShiftDays: 0, requiresIntervention: false, reasons: [], analyzedAt: '2026-10-01T00:00:00Z' },
  currentIssues: { scheduleConflicts: [], statusConflicts: [], deadlineIssues: [], affectedTaskIds: [] },
  projectBoundaryIssues: [], recoveryScenarios: [],
}

const props = {
  workspace,
  onTaskSelect: () => undefined,
  onTaskCreate: () => undefined,
  onTaskDraft: () => undefined,
  onApplyTimelineDraft: async () => undefined,
  onCancelTimelineDraft: () => undefined,
  onViewWorkload: () => undefined,
  onCreateDependency: async () => undefined,
  onPreviewScheduleShift: async () => { throw new Error('not called') },
  onApplyScheduleShift: async () => undefined,
}

afterEach(cleanup)

describe('Task plan filter and Timeline', () => {
  it('shows inclusive task duration next to each Gantt task', () => {
    const { container } = render(<OverviewWorkspaceView {...props} />)
    expect(container.querySelector('[data-task-duration-days="2"]')?.textContent).toBe('2 дня')
    expect(container.querySelector('[data-task-duration-days="4"]')?.textContent).toBe('4 дня')
  })

  it('highlights on Gantt exactly the tasks matching the selected Plan filter', () => {
    const { container } = render(<OverviewWorkspaceView {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /Критические 1/ }))
    expect(container.querySelector('[data-timeline-task-target="critical"]')?.getAttribute('data-task-filter-match')).toBe('true')
    expect(container.querySelector('[data-timeline-task-target="buffer"]')?.hasAttribute('data-task-filter-match')).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: /С запасом 1/ }))
    expect(container.querySelector('[data-timeline-task-target="critical"]')?.hasAttribute('data-task-filter-match')).toBe(false)
    expect(container.querySelector('[data-timeline-task-target="buffer"]')?.getAttribute('data-task-filter-match')).toBe('true')
  })
})
