// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProjectTask } from '../../types/task'
import { TaskEditPanel } from './TaskEditPanel'

const assignees = [
  { id: 'ivan', projectId: 'project', name: 'Иван' },
  { id: 'anna', projectId: 'project', name: 'Анна' },
]

const task: ProjectTask = {
  id: 'task', projectId: 'project', title: 'Исходное название', startDate: '2026-10-01', endDate: '2026-10-03',
  plannedStartDate: '2026-10-01', plannedEndDate: '2026-10-03', durationDays: 3, progress: 0,
  assigneeId: 'ivan', status: 'not-started', riskState: 'none', isCritical: false,
}

function props(currentTask: ProjectTask, onSave = vi.fn().mockResolvedValue(undefined)) {
  return {
    task: currentTask, assignees, tasks: [currentTask], dependencies: [], onSave,
    onClose: vi.fn(), onDelete: vi.fn().mockResolvedValue(undefined),
    onCreateDependency: vi.fn().mockResolvedValue(undefined), onDeleteDependency: vi.fn().mockResolvedValue(undefined),
    onCreateEmployee: vi.fn(),
  }
}

afterEach(cleanup)

describe('TaskEditPanel realtime synchronization', () => {
  it('does not overwrite a remote assignee when only the title is edited locally', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const view = render(<TaskEditPanel {...props(task, onSave)} />)
    fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Локальное название' } })
    const remoteTask = { ...task, assigneeId: 'anna' }
    view.rerender(<TaskEditPanel {...props(remoteTask, onSave)} />)

    expect((screen.getByLabelText('Ответственный') as HTMLSelectElement).value).toBe('anna')
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ title: 'Локальное название' }))
  })

  it('synchronizes untouched fields from realtime while retaining dirty fields', () => {
    const view = render(<TaskEditPanel {...props(task)} />)
    fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Локальное название' } })
    view.rerender(<TaskEditPanel {...props({ ...task, assigneeId: 'anna', startDate: '2026-10-02' })} />)
    expect((screen.getByLabelText('Название') as HTMLInputElement).value).toBe('Локальное название')
    expect((screen.getByLabelText('Ответственный') as HTMLSelectElement).value).toBe('anna')
    expect((screen.getByLabelText('Начало') as HTMLInputElement).value).toBe('2026-10-02')
  })

  it('warns when realtime changes the same dirty field and can load remote data', () => {
    const view = render(<TaskEditPanel {...props(task)} />)
    fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Локальное название' } })
    view.rerender(<TaskEditPanel {...props({ ...task, title: 'Удалённое название' })} />)
    expect(screen.getByText('Задача изменилась в другой вкладке.')).toBeTruthy()
    expect((screen.getByLabelText('Название') as HTMLInputElement).value).toBe('Локальное название')
    fireEvent.click(screen.getByRole('button', { name: 'Обновить данные' }))
    expect((screen.getByLabelText('Название') as HTMLInputElement).value).toBe('Удалённое название')
  })
})
