// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import type { Dependency } from '../../types/dependency'
import type { ProjectTask } from '../../types/task'
import type { ProjectWorkspace } from '../../types/workspace'
import { applyScheduleShiftPreview, calculateScheduleShiftPreview } from '../../services/scheduleEngine'
import { rebuildWorkspaceDerivedState } from '../../services/workspaceState'
import { ImpactPanel } from './ImpactPanel'

function task(id: string, title: string, startDate: string, endDate: string): ProjectTask {
  return { id, projectId: 'project', title, startDate, endDate, plannedStartDate: startDate, plannedEndDate: endDate, durationDays: 1, progress: 0, assigneeId: 'employee', status: 'not-started', riskState: 'none', isCritical: false }
}

function createWorkspace(conflict = true): ProjectWorkspace {
  const tasks = conflict
    ? [task('a', 'Architecture', '2026-10-10', '2026-10-14'), task('b', 'Backend', '2026-10-14', '2026-10-16')]
    : [task('a', 'Architecture', '2026-10-10', '2026-10-14')]
  const dependencies: Dependency[] = conflict
    ? [{ id: 'a-b', projectId: 'project', predecessorTaskId: 'a', successorTaskId: 'b', type: 'finish-to-start' }]
    : []
  return rebuildWorkspaceDerivedState({
    project: { id: 'project', creatorId: 'owner', name: 'Проект', description: '', startDate: '2026-10-01', targetEndDate: conflict ? '2026-10-15' : '2026-10-31', projectedEndDate: '2026-10-31', ownerName: 'Менеджер', health: 'on-track', progress: 0, taskCount: tasks.length, completedTaskCount: 0 },
    tasks, dependencies, assignees: [{ id: 'employee', projectId: 'project', name: 'Иван' }],
    impact: { sourceTaskId: 'a', lastChange: { kind: 'session-started' }, affectedTaskIds: conflict ? ['b'] : [], criticalTaskIds: [], slackDaysByTaskId: {}, atRiskTaskIds: [], previousProjectEndDate: '2026-10-15', projectedProjectEndDate: '2026-10-15', projectEndChangeDays: 0, deadlineShiftDays: 0, requiresIntervention: false, reasons: [], analyzedAt: '2026-10-01T00:00:00Z' },
    currentIssues: { scheduleConflicts: [], statusConflicts: [], deadlineIssues: [], affectedTaskIds: [] },
    projectBoundaryIssues: [], recoveryScenarios: [],
  }, { sourceTaskId: 'a', affectedTaskIds: conflict ? ['b'] : [] })
}

afterEach(cleanup)

describe('RecoveryPlan UI', () => {
  it('does not show the recovery entry for a healthy project', () => {
    render(<ImpactPanel workspace={createWorkspace(false)} onPreviewScheduleShift={vi.fn()} onApplyScheduleShift={vi.fn()} onTaskSelect={() => undefined} />)
    expect(document.querySelector('[data-recovery-entry="true"]')).toBeNull()
  })

  it('opens the recovery plan and applies a backend-confirmed safe shift', async () => {
    const workspace = createWorkspace()
    const preview = calculateScheduleShiftPreview(workspace.project.id, workspace.tasks, workspace.dependencies, 'a')
    const onPreview = vi.fn().mockResolvedValue(preview)
    const onApply = vi.fn().mockResolvedValue(undefined)
    const { container } = render(<ImpactPanel workspace={workspace} onPreviewScheduleShift={onPreview} onApplyScheduleShift={onApply} onTaskSelect={() => undefined} />)

    fireEvent.click(screen.getByRole('button', { name: 'Открыть план восстановления' }))
    expect(screen.getByRole('dialog', { name: 'План восстановления' })).toBeTruthy()
    expect(container.textContent).toContain('Architecture → Backend')
    expect(container.textContent).toContain('14 окт.–16 окт.')
    expect(container.textContent).toContain('15 окт.–17 окт.')
    await waitFor(() => expect((screen.getByRole('button', { name: 'Применить безопасный сдвиг' }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: 'Применить безопасный сдвиг' }))

    await waitFor(() => expect(onApply).toHaveBeenCalledWith(preview, false))
    expect(await screen.findByText('План обновлён')).toBeTruthy()
    expect(container.querySelector('[data-recovery-success="true"]')?.textContent).toContain('1 конфликт')
    expect(container.querySelector('[data-recovery-success="true"]')?.textContent).toContain('0 конфликтов')
  })

  it('returns to Gantt with the calculated critical chain highlighted', () => {
    const workspace = createWorkspace()
    const onShowCriticalChain = vi.fn()
    render(<ImpactPanel workspace={workspace} onShowCriticalChain={onShowCriticalChain} onPreviewScheduleShift={vi.fn().mockResolvedValue(calculateScheduleShiftPreview(workspace.project.id, workspace.tasks, workspace.dependencies, 'a'))} onApplyScheduleShift={vi.fn()} onTaskSelect={() => undefined} />)

    fireEvent.click(screen.getByRole('button', { name: 'Открыть план восстановления' }))
    fireEvent.click(screen.getByRole('button', { name: 'Показать критическую цепочку' }))

    expect(onShowCriticalChain).toHaveBeenCalledWith(['a', 'b'])
    expect(screen.queryByRole('dialog', { name: 'План восстановления' })).toBeNull()
  })

  it('recalculates the available options after a successful schedule change', async () => {
    function Harness() {
      const [value, setValue] = useState(createWorkspace)
      return <ImpactPanel
        workspace={value}
        onPreviewScheduleShift={async (sourceTaskId) => calculateScheduleShiftPreview(value.project.id, value.tasks, value.dependencies, sourceTaskId)}
        onApplyScheduleShift={async (preview) => setValue((current) => rebuildWorkspaceDerivedState({ ...current, tasks: applyScheduleShiftPreview(current.tasks, preview) }))}
        onTaskSelect={() => undefined}
      />
    }
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Открыть план восстановления' }))
    await waitFor(() => expect((screen.getByRole('button', { name: 'Применить безопасный сдвиг' }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: 'Применить безопасный сдвиг' }))

    await screen.findByText('План обновлён')
    await waitFor(() => expect(screen.queryByText('Принять изменение и перестроить график')).toBeNull())
    expect(screen.getByText('Сохранить плановый срок')).toBeTruthy()
  })
})
