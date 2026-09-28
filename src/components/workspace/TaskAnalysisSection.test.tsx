// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'react'
import type { TaskAnalysisMessage } from '../../types/taskAnalysis'
import type { ProjectTask } from '../../types/task'
import { TaskAnalysisSection } from './TaskAnalysisSection'

const tasks: ProjectTask[] = [
  { id: 'backend', projectId: 'project', title: 'Backend', startDate: '2026-06-01', endDate: '2026-06-05', plannedStartDate: '2026-06-01', plannedEndDate: '2026-06-05', durationDays: 5, progress: 0, assigneeId: 'employee', status: 'in-progress', riskState: 'none', isCritical: false },
  { id: 'frontend', projectId: 'project', title: 'Frontend', startDate: '2026-06-06', endDate: '2026-06-10', plannedStartDate: '2026-06-06', plannedEndDate: '2026-06-10', durationDays: 5, progress: 0, assigneeId: 'employee', status: 'not-started', riskState: 'none', isCritical: false },
]

const warning: TaskAnalysisMessage = {
  severity: 'warning', triggerTaskId: 'backend', triggerTaskName: 'Backend',
  affectedTaskIds: ['frontend', 'testing'], affectedTaskNames: ['Frontend', 'Тестирование'],
  description: 'Изменение сроков нарушает зависимость.',
  actions: [
    { code: 'open-task', label: 'Открыть Frontend', targetTaskId: 'frontend' },
    { code: 'preview-shift', label: 'Рассчитать сдвиг', targetTaskId: null },
  ],
}

function renderSection(overrides: Partial<ComponentProps<typeof TaskAnalysisSection>> = {}) {
  return render(<TaskAnalysisSection
    taskId="backend"
    tasks={tasks}
    refreshKey={0}
    loadAnalysis={vi.fn().mockResolvedValue([])}
    onOpenTask={vi.fn()}
    onRequestScheduleShift={vi.fn()}
    {...overrides}
  />)
}

afterEach(cleanup)

describe('TaskAnalysisSection', () => {
  it('shows a loading state while analysis is pending', () => {
    renderSection({ loadAnalysis: () => new Promise<TaskAnalysisMessage[]>(() => undefined) })
    expect(screen.getByRole('status').textContent).toContain('Анализируем задачу…')
  })

  it('shows a calm empty state when no problems are returned', async () => {
    renderSection()
    expect(await screen.findByText('Для этой задачи проблем не обнаружено.')).toBeTruthy()
  })

  it('shows an error and retries the request', async () => {
    const loadAnalysis = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([])
    renderSection({ loadAnalysis })
    expect((await screen.findByRole('alert')).textContent).toContain('Не удалось получить анализ задачи.')
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }))
    expect(await screen.findByText('Для этой задачи проблем не обнаружено.')).toBeTruthy()
    expect(loadAnalysis).toHaveBeenCalledTimes(2)
  })

  it('visually distinguishes all severities by their labels', async () => {
    renderSection({ loadAnalysis: vi.fn().mockResolvedValue([
      { ...warning, severity: 'info', description: 'Информация' },
      warning,
      { ...warning, severity: 'error', description: 'Ошибка сервера' },
    ]) })
    const infoLabel = await screen.findByText('Информация', { selector: 'span' })
    const warningLabel = screen.getByText('Предупреждение')
    const errorLabel = screen.getByText('Ошибка', { selector: 'span' })
    expect(infoLabel.closest('article')?.className).toContain('border-sky-200')
    expect(warningLabel.closest('article')?.className).toContain('border-amber-200')
    expect(errorLabel.closest('article')?.className).toContain('border-rose-200')
  })

  it('shows affected names, all actions, and opens an existing target task', async () => {
    const onOpenTask = vi.fn()
    renderSection({ loadAnalysis: vi.fn().mockResolvedValue([warning]), onOpenTask })
    expect(await screen.findByText('Тестирование')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Frontend' }))
    expect(onOpenTask).toHaveBeenCalledWith('frontend')
    onOpenTask.mockClear()
    expect(screen.getByRole('button', { name: 'Открыть Frontend' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Рассчитать сдвиг' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Открыть Frontend' }))
    expect(onOpenTask).toHaveBeenCalledWith('frontend')
  })

  it('renders an unknown action as non-interactive recommendation text', async () => {
    renderSection({ loadAnalysis: vi.fn().mockResolvedValue([{ ...warning, actions: [{ code: 'future-action', label: 'Проверьте статус' }] }]) })
    expect(await screen.findByText('Проверьте статус')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Проверьте статус' })).toBeNull()
  })

  it('delegates a shift action to the existing preview flow with the trigger task', async () => {
    const onRequestScheduleShift = vi.fn()
    renderSection({ loadAnalysis: vi.fn().mockResolvedValue([warning]), onRequestScheduleShift })
    fireEvent.click(await screen.findByRole('button', { name: 'Рассчитать сдвиг' }))
    expect(onRequestScheduleShift).toHaveBeenCalledWith('backend')
  })

  it('reloads analysis when its refresh key changes', async () => {
    const loadAnalysis = vi.fn().mockResolvedValue([])
    const view = renderSection({ loadAnalysis })
    await waitFor(() => expect(loadAnalysis).toHaveBeenCalledTimes(1))
    view.rerender(<TaskAnalysisSection taskId="backend" tasks={tasks} refreshKey={1} loadAnalysis={loadAnalysis} onOpenTask={vi.fn()} onRequestScheduleShift={vi.fn()} />)
    await waitFor(() => expect(loadAnalysis).toHaveBeenCalledTimes(2))
  })
})
