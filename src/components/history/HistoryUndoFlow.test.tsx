// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HistoryUndoAlreadyAppliedError } from '../../services/history/serverHistoryActions'
import type { ServerHistoryEntry } from '../../services/history/historyTypes'
import type { ProjectWorkspace } from '../../types/workspace'
import { HistoryView } from './HistoryView'

const workspace: ProjectWorkspace = {
  project: { id: 'project', creatorId: 'manager', name: 'Проект', description: '', startDate: '2026-10-01', targetEndDate: '2026-10-31', projectedEndDate: '2026-10-31', ownerName: 'Менеджер', health: 'on-track', progress: 0, taskCount: 0, completedTaskCount: 0 },
  tasks: [], dependencies: [], assignees: [], recoveryScenarios: [], projectBoundaryIssues: [],
  currentIssues: { scheduleConflicts: [], statusConflicts: [], deadlineIssues: [], affectedTaskIds: [] },
  impact: { sourceTaskId: '', lastChange: { kind: 'session-started' }, affectedTaskIds: [], criticalTaskIds: [], slackDaysByTaskId: {}, atRiskTaskIds: [], previousProjectEndDate: '2026-10-31', projectedProjectEndDate: '2026-10-31', projectEndChangeDays: 0, deadlineShiftDays: 0, requiresIntervention: false, reasons: [], analyzedAt: '2026-10-01T00:00:00Z' },
}

const entry: ServerHistoryEntry = { source: 'server', id: 'abc', projectId: 'project', operationType: 'task.update', description: 'Изменена задача', createdAt: '2026-10-01T12:00:00Z', canUndo: true, isCurrent: true }

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => { resolve = resolvePromise; reject = rejectPromise })
  return { promise, resolve, reject }
}

function openConfirmation() {
  fireEvent.click(screen.getByRole('button', { name: 'Отменить последнее изменение' }))
  return screen.getByRole('button', { name: 'Отменить изменение' })
}

afterEach(cleanup)

describe('HistoryView undo flow', () => {
  it('sends only one undo for two clicks in the same render', async () => {
    const pending = deferred<void>()
    const onRevert = vi.fn(() => pending.promise)
    render(<HistoryView entries={[entry]} workspace={workspace} source="server" onRevert={onRevert} />)
    const confirm = openConfirmation()
    act(() => {
      confirm.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      confirm.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(onRevert).toHaveBeenCalledTimes(1)
    await act(async () => pending.resolve())
  })

  it('ignores another confirmation while undo is pending', async () => {
    const pending = deferred<void>()
    const onRevert = vi.fn(() => pending.promise)
    render(<HistoryView entries={[entry]} workspace={workspace} source="server" onRevert={onRevert} />)
    const confirm = openConfirmation()
    fireEvent.click(confirm)
    expect((confirm as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(confirm)
    expect(onRevert).toHaveBeenCalledTimes(1)
    await act(async () => pending.resolve())
  })

  it('closes confirmation immediately when realtime marks the entry non-current', async () => {
    const onRevert = vi.fn()
    const view = render(<HistoryView entries={[entry]} workspace={workspace} source="server" onRevert={onRevert} />)
    openConfirmation()
    view.rerender(<HistoryView entries={[{ ...entry, canUndo: false, isCurrent: false, undone: true }]} workspace={workspace} source="server" onRevert={onRevert} />)
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Отменить изменение' })).toBeNull())
    expect(onRevert).not.toHaveBeenCalled()
    expect(screen.queryByText('Backend транзакционно отменит последнее доступное изменение. Связанные сущности обновятся через realtime.')).toBeNull()
    expect(screen.getByText('Изменение уже отменено.')).toBeTruthy()
  })

  it('refreshes an open details drawer from the latest isCurrent state', async () => {
    const view = render(<HistoryView entries={[entry]} workspace={workspace} source="server" onRevert={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Подробнее' }))
    expect(screen.getByText('Доступен')).toBeTruthy()
    view.rerender(<HistoryView entries={[{ ...entry, canUndo: false, isCurrent: false, undone: true }]} workspace={workspace} source="server" onRevert={vi.fn()} />)
    await waitFor(() => expect(screen.getAllByText('Отменено').length).toBeGreaterThan(0))
    expect(screen.queryByText('Доступен')).toBeNull()
  })

  it('closes the modal and shows success after HTTP 200', async () => {
    render(<HistoryView entries={[entry]} workspace={workspace} source="server" onRevert={vi.fn().mockResolvedValue(undefined)} />)
    fireEvent.click(openConfirmation())
    await waitFor(() => expect(screen.getByText('Изменение успешно отменено.')).toBeTruthy())
    expect(screen.queryByText('Backend транзакционно отменит последнее доступное изменение. Связанные сущности обновятся через realtime.')).toBeNull()
  })

  it('closes the modal and shows neutral information after synchronized 409', async () => {
    render(<HistoryView entries={[entry]} workspace={workspace} source="server" onRevert={vi.fn().mockRejectedValue(new HistoryUndoAlreadyAppliedError())} />)
    fireEvent.click(openConfirmation())
    await waitFor(() => expect(screen.getByText('Изменение уже отменено.')).toBeTruthy())
    expect(screen.queryByText('Backend транзакционно отменит последнее доступное изменение. Связанные сущности обновятся через realtime.')).toBeNull()
    expect(screen.queryByText('Это изменение уже было отменено.')).toBeNull()
  })

  it('releases the synchronous guard after a failed request', async () => {
    const onRevert = vi.fn()
      .mockRejectedValueOnce(new Error('Временная ошибка'))
      .mockResolvedValueOnce(undefined)
    render(<HistoryView entries={[entry]} workspace={workspace} source="server" onRevert={onRevert} />)
    fireEvent.click(openConfirmation())
    await waitFor(() => expect(screen.getByText('Временная ошибка')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Отменить изменение' }))
    await waitFor(() => expect(screen.getByText('Изменение успешно отменено.')).toBeTruthy())
    expect(onRevert).toHaveBeenCalledTimes(2)
  })
})
