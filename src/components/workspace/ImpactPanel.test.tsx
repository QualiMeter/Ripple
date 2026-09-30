// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ImpactReason } from '../../types/impact'
import type { ProjectWorkspace } from '../../types/workspace'
import { ImpactPanel } from './ImpactPanel'
import { findScheduleConflicts } from '../../services/scheduleEngine'
import type { TimelineDraftPreview } from '../../services/timelineDraft'

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

afterEach(cleanup)

function clickAutomaticShift(): void {
  const buttons = screen.getAllByRole('button', { name: 'Рассчитать автоматический сдвиг' })
  fireEvent.click(buttons[buttons.length - 1])
}

describe('ImpactPanel current issues', () => {
  it('shows all issue categories and their total count', () => {
    const { container } = render(<ImpactPanel workspace={workspace} onPreviewScheduleShift={async () => { throw new Error('not called') }} onApplyScheduleShift={async () => undefined} onTaskSelect={() => undefined} />)
    expect(screen.getByText('Что требует внимания')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Показать все проблемы (3)' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Показать все проблемы (3)' }))
    expect(container.textContent).toContain('Конфликты зависимостей и дат')
    expect(container.textContent).toContain('Логические конфликты статусов')
    expect(container.textContent).toContain('Просроченные сроки')
    expect(container.querySelector('[data-recommendation-tone="danger"]')).not.toBeNull()
    expect(container.querySelector('[data-recommendation-tone="warning"]')).not.toBeNull()
    expect(container.textContent).toContain('Рекомендация:')
  })

  it('shows a green recommendation state when intervention is not required', () => {
    const currentIssues = { scheduleConflicts: [], statusConflicts: [], deadlineIssues: [], affectedTaskIds: [] }
    const markup = renderToStaticMarkup(<ImpactPanel workspace={{ ...workspace, currentIssues }} onPreviewScheduleShift={async () => { throw new Error('not called') }} onApplyScheduleShift={async () => undefined} onTaskSelect={() => undefined} />)
    expect(markup).toContain('data-recommendation-tone="success"')
    expect(markup).toContain('Вмешательство не требуется')
  })

  it('shows the successor and human-readable dates for a dependency conflict', () => {
    const tasks = [
      { ...workspace.tasks[0], title: 'A', endDate: '2026-10-23' },
      { ...workspace.tasks[1], title: 'B', startDate: '2026-10-23' },
    ]
    const dependencies = [{ id: 'a-b', projectId: 'project', predecessorTaskId: 'a', successorTaskId: 'b', type: 'finish-to-start' as const }]
    const scheduleConflicts = findScheduleConflicts(tasks, dependencies, ['b'])
    const { container } = render(<ImpactPanel workspace={{ ...workspace, tasks, dependencies, currentIssues: { scheduleConflicts, statusConflicts: [], deadlineIssues: [], affectedTaskIds: ['b'] } }} onPreviewScheduleShift={async () => { throw new Error('not called') }} onApplyScheduleShift={async () => undefined} onTaskSelect={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: 'Показать все проблемы (1)' }))
    const markup = container.innerHTML

    expect(markup).toContain('Задача: B')
    expect(markup).not.toContain('Задача: A')
    expect(markup).toContain('Запланированное начало: 23.10.2026')
    expect(markup).toContain('Предшественник «A» завершается: 23.10.2026')
    expect(markup).toContain('Можно начать не раньше: 24.10.2026')
    expect(markup).toContain('Рассчитать сдвиг')
    expect(markup).not.toContain('finish-to-start')
  })

  it('uses the completed-successor wording and open-task action', () => {
    const tasks = [
      { ...workspace.tasks[0], title: 'A', endDate: '2026-10-23' },
      { ...workspace.tasks[1], title: 'B', startDate: '2026-10-23', status: 'completed' as const },
    ]
    const dependencies = [{ id: 'a-b', projectId: 'project', predecessorTaskId: 'a', successorTaskId: 'b', type: 'finish-to-start' as const }]
    const scheduleConflicts = findScheduleConflicts(tasks, dependencies, ['b'])
    const { container } = render(<ImpactPanel workspace={{ ...workspace, tasks, dependencies, currentIssues: { scheduleConflicts, statusConflicts: [], deadlineIssues: [], affectedTaskIds: ['b'] } }} onPreviewScheduleShift={async () => { throw new Error('not called') }} onApplyScheduleShift={async () => undefined} onTaskSelect={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: 'Показать все проблемы (1)' }))
    const markup = container.innerHTML

    expect(markup).toContain('Фактические даты завершённой задачи конфликтуют с зависимостью.')
    expect(markup).toContain('Задача: B')
    expect(markup).toContain('Предшественник: A')
    expect(markup).toContain('Завершённую задачу нельзя сдвинуть автоматически. Проверьте фактические даты вручную.')
    expect(markup).toContain('Открыть задачу')
    expect(markup).not.toContain('Рассчитать сдвиг')
  })

  it('runs a one-shot requested preview through the existing schedule flow', async () => {
    const onPreviewScheduleShift = vi.fn().mockResolvedValue({
      projectId: 'project', sourceTaskId: 'a', taskShifts: [],
      currentProjectEndDate: '2026-10-31', proposedProjectEndDate: '2026-10-31', projectEndShiftDays: 0,
    })
    const onRequestedPreviewHandled = vi.fn()
    render(<ImpactPanel
      workspace={workspace}
      onPreviewScheduleShift={onPreviewScheduleShift}
      onApplyScheduleShift={async () => undefined}
      onTaskSelect={() => undefined}
      requestedPreviewSourceId="a"
      onRequestedPreviewHandled={onRequestedPreviewHandled}
    />)

    await waitFor(() => expect(onPreviewScheduleShift).toHaveBeenCalledWith('a'))
    expect(onRequestedPreviewHandled).toHaveBeenCalledTimes(1)
  })

  it('keeps the standard two-button preview layout when the project deadline does not change', async () => {
    render(<ImpactPanel workspace={workspace} onPreviewScheduleShift={vi.fn().mockResolvedValue({
      projectId: 'project', sourceTaskId: 'a',
      taskShifts: [{ taskId: 'b', currentStartDate: '2026-10-03', currentEndDate: '2026-10-04', proposedStartDate: '2026-10-04', proposedEndDate: '2026-10-05', shiftDays: 1 }],
      currentProjectEndDate: '2026-10-31', proposedProjectEndDate: '2026-10-31', projectEndShiftDays: 0,
    })} onApplyScheduleShift={async () => undefined} onTaskSelect={() => undefined} />)
    clickAutomaticShift()
    await screen.findByText('Предпросмотр')
    const actions = document.querySelector('[data-shift-actions="standard"]')
    expect(actions?.className).toContain('grid-cols-2')
    expect(actions?.querySelectorAll('button')).toHaveLength(2)
    expect(document.querySelector('[data-deadline-shift-action="true"]')).toBeNull()
  })

  it('places the conditional project-deadline action on a full second row', async () => {
    render(<ImpactPanel workspace={workspace} onPreviewScheduleShift={vi.fn().mockResolvedValue({
      projectId: 'project', sourceTaskId: 'a',
      taskShifts: [{ taskId: 'b', currentStartDate: '2026-10-03', currentEndDate: '2026-10-04', proposedStartDate: '2026-11-01', proposedEndDate: '2026-11-02', shiftDays: 29 }],
      currentProjectEndDate: '2026-10-31', proposedProjectEndDate: '2026-11-02', projectEndShiftDays: 2,
    })} onApplyScheduleShift={async () => undefined} onTaskSelect={() => undefined} />)
    clickAutomaticShift()
    await screen.findByText('Предпросмотр')
    const actions = document.querySelector('[data-shift-actions="with-deadline-change"]')
    const deadlineAction = document.querySelector('[data-deadline-shift-action="true"]')
    expect(actions?.className).toContain('grid-cols-1 sm:grid-cols-2')
    expect(actions?.querySelectorAll('button')).toHaveLength(3)
    expect(deadlineAction?.className).toContain('w-full')
    expect(deadlineAction?.className).toContain('sm:col-span-2')
  })

  it('sends distinct confirmation modes from the two deadline actions', async () => {
    const shiftPreview = {
      projectId: 'project', sourceTaskId: 'a',
      taskShifts: [{ taskId: 'b', currentStartDate: '2026-10-03', currentEndDate: '2026-10-04', proposedStartDate: '2026-11-01', proposedEndDate: '2026-11-02', shiftDays: 29 }],
      currentProjectEndDate: '2026-10-31', proposedProjectEndDate: '2026-11-02', projectEndShiftDays: 2,
    }
    const withoutDeadlineChange = vi.fn().mockResolvedValue(undefined)
    const first = render(<ImpactPanel workspace={workspace} onPreviewScheduleShift={vi.fn().mockResolvedValue(shiftPreview)} onApplyScheduleShift={withoutDeadlineChange} onTaskSelect={() => undefined} />)
    clickAutomaticShift()
    await screen.findByText('Предпросмотр')
    fireEvent.click(screen.getByRole('button', { name: 'Сдвинуть без изменения срока' }))
    await waitFor(() => expect(withoutDeadlineChange).toHaveBeenCalledWith(shiftPreview, false))
    first.unmount()

    const withDeadlineChange = vi.fn().mockResolvedValue(undefined)
    render(<ImpactPanel workspace={workspace} onPreviewScheduleShift={vi.fn().mockResolvedValue(shiftPreview)} onApplyScheduleShift={withDeadlineChange} onTaskSelect={() => undefined} />)
    clickAutomaticShift()
    await screen.findByText('Предпросмотр')
    fireEvent.click(screen.getByRole('button', { name: 'Сдвинуть и изменить срок проекта' }))
    await waitFor(() => expect(withDeadlineChange).toHaveBeenCalledWith(shiftPreview, true))
  })

  it('keeps shift confirmation single-flight until confirm and project resync finish', async () => {
    let resolveApply!: () => void
    const pendingApply = new Promise<void>((resolve) => { resolveApply = resolve })
    const onApplyScheduleShift = vi.fn(() => pendingApply)
    const shiftPreview = {
      projectId: 'project', sourceTaskId: 'a',
      taskShifts: [{ taskId: 'b', currentStartDate: '2026-10-03', currentEndDate: '2026-10-04', proposedStartDate: '2026-10-04', proposedEndDate: '2026-10-05', shiftDays: 1 }],
      currentProjectEndDate: '2026-10-31', proposedProjectEndDate: '2026-10-31', projectEndShiftDays: 0,
    }
    render(<ImpactPanel workspace={workspace} onPreviewScheduleShift={vi.fn().mockResolvedValue(shiftPreview)} onApplyScheduleShift={onApplyScheduleShift} onTaskSelect={() => undefined} />)
    clickAutomaticShift()
    await screen.findByText('Предпросмотр')
    const confirm = screen.getByRole('button', { name: 'Подтвердить' })
    confirm.click()
    confirm.click()
    expect(onApplyScheduleShift).toHaveBeenCalledTimes(1)
    resolveApply()
    await waitFor(() => expect(screen.queryByText('Предпросмотр')).toBeNull())
  })

  it('does not offer confirmation when every preview item requires manual resolution', async () => {
    const onApplyScheduleShift = vi.fn().mockResolvedValue(undefined)
    render(<ImpactPanel workspace={workspace} onPreviewScheduleShift={vi.fn().mockResolvedValue({
      projectId: 'project', sourceTaskId: 'a',
      taskShifts: [{
        taskId: 'b',
        currentStartDate: '2026-10-03', currentEndDate: '2026-10-04',
        proposedStartDate: '2026-10-03', proposedEndDate: '2026-10-04',
        shiftDays: 0,
        completedRequiresManualResolution: true,
        reason: 'Завершённую задачу нельзя сдвинуть автоматически.',
      }],
      currentProjectEndDate: '2026-10-31', proposedProjectEndDate: '2026-10-31', projectEndShiftDays: 0,
    })} onApplyScheduleShift={onApplyScheduleShift} onTaskSelect={() => undefined} />)

    clickAutomaticShift()
    await screen.findByText('Предпросмотр')

    expect(screen.getByText('Автоматически сдвинуть задачи нельзя. Завершённые работы требуют ручной проверки фактических дат.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Подтвердить' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Сдвинуть без изменения срока' })).toBeNull()
    expect(onApplyScheduleShift).not.toHaveBeenCalled()
  })

  it('shows a timeline draft with downstream changes and the project end delta', () => {
    const draft: TimelineDraftPreview = {
      sourceTaskId: 'a', sourceUpdate: { endDate: '2026-10-06' }, workspace,
      taskChanges: [
        { taskId: 'a', currentStartDate: '2026-10-01', currentEndDate: '2026-10-02', proposedStartDate: '2026-10-01', proposedEndDate: '2026-10-06' },
        { taskId: 'b', currentStartDate: '2026-10-03', currentEndDate: '2026-10-04', proposedStartDate: '2026-10-07', proposedEndDate: '2026-10-08' },
      ],
      schedulePreview: { projectId: 'project', sourceTaskId: 'a', taskShifts: [], currentProjectEndDate: '2026-10-04', proposedProjectEndDate: '2026-10-08', projectEndShiftDays: 4 },
      currentProjectEndDate: '2026-10-04', proposedProjectEndDate: '2026-10-08', projectEndDeltaDays: 4,
      remainingConflicts: [], completedManualTaskIds: [],
    }
    const { container } = render(<ImpactPanel workspace={workspace} timelineDraft={draft} onApplyTimelineDraft={async () => undefined} onCancelTimelineDraft={() => undefined} onPreviewScheduleShift={async () => { throw new Error('not called') }} onApplyScheduleShift={async () => undefined} onTaskSelect={() => undefined} />)
    expect(container.textContent).toContain('Черновик · 2 изменений')
    expect(container.querySelector('[data-draft-task-id="a"]')).not.toBeNull()
    expect(container.querySelector('[data-draft-task-id="b"]')).not.toBeNull()
    expect(container.textContent).toContain('+4 дн.')
  })

  it('cancels without applying and applies only after explicit confirmation', async () => {
    const draft: TimelineDraftPreview = {
      sourceTaskId: 'a', sourceUpdate: { endDate: '2026-10-06' }, workspace,
      taskChanges: [{ taskId: 'a', currentStartDate: '2026-10-01', currentEndDate: '2026-10-02', proposedStartDate: '2026-10-01', proposedEndDate: '2026-10-06' }],
      schedulePreview: { projectId: 'project', sourceTaskId: 'a', taskShifts: [], currentProjectEndDate: '2026-10-04', proposedProjectEndDate: '2026-10-06', projectEndShiftDays: 2 },
      currentProjectEndDate: '2026-10-04', proposedProjectEndDate: '2026-10-06', projectEndDeltaDays: 2,
      remainingConflicts: [], completedManualTaskIds: [],
    }
    const onCancel = vi.fn()
    const onApply = vi.fn().mockResolvedValue(undefined)
    render(<ImpactPanel workspace={workspace} timelineDraft={draft} onApplyTimelineDraft={onApply} onCancelTimelineDraft={onCancel} onPreviewScheduleShift={async () => { throw new Error('not called') }} onApplyScheduleShift={async () => undefined} onTaskSelect={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: 'Отменить' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onApply).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Применить изменения' }))
    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1))
  })
})
