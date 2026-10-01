// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProjectFormPanel } from './ProjectFormPanel'

const initialValues = { name: 'Проект', startDate: '2026-09-01', targetEndDate: '2026-09-30' }

afterEach(cleanup)

describe('ProjectFormPanel submission', () => {
  it('allows only one create request while submission is in flight', async () => {
    let resolveCreate!: () => void
    const onSubmit = vi.fn(() => new Promise<void>((resolve) => { resolveCreate = resolve }))
    render(<ProjectFormPanel title="Новый проект" submitLabel="Создать" initialValues={initialValues} onClose={() => undefined} onSubmit={onSubmit} />)

    const form = screen.getByRole('button', { name: 'Создать' }).closest('form')!
    fireEvent.submit(form)
    fireEvent.submit(form)

    expect(onSubmit).toHaveBeenCalledTimes(1)
    resolveCreate()
    await waitFor(() => expect((screen.getByRole('button', { name: 'Создать' }) as HTMLButtonElement).disabled).toBe(false))
  })

  it('releases the synchronous guard after a failed create', async () => {
    const onSubmit = vi.fn()
      .mockRejectedValueOnce(new Error('Сервер недоступен'))
      .mockResolvedValueOnce(undefined)
    render(<ProjectFormPanel title="Новый проект" submitLabel="Создать" initialValues={initialValues} onClose={() => undefined} onSubmit={onSubmit} />)

    const form = screen.getByRole('button', { name: 'Создать' }).closest('form')!
    fireEvent.submit(form)
    await screen.findByText('Сервер недоступен')
    fireEvent.submit(form)

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2))
  })

  it('imports a project from the create panel without submitting the manual form', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const onImport = vi.fn().mockResolvedValue(undefined)
    render(<ProjectFormPanel title="Новый проект" submitLabel="Создать" initialValues={initialValues} onClose={() => undefined} onSubmit={onSubmit} onImport={onImport} />)

    const file = new File(['{}'], 'project.ripple.json', { type: 'application/json' })
    fireEvent.change(screen.getByLabelText('Файл импорта проекта'), { target: { files: [file] } })

    await waitFor(() => expect(onImport).toHaveBeenCalledWith(file))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('keeps the create panel open and shows an import error', async () => {
    const onImport = vi.fn().mockRejectedValue(new Error('Файл проекта повреждён'))
    render(<ProjectFormPanel title="Новый проект" submitLabel="Создать" initialValues={initialValues} onClose={() => undefined} onSubmit={vi.fn()} onImport={onImport} />)

    fireEvent.change(screen.getByLabelText('Файл импорта проекта'), { target: { files: [new File(['bad'], 'broken.json', { type: 'application/json' })] } })

    expect((await screen.findByRole('alert')).textContent).toContain('Файл проекта повреждён')
    expect(screen.getByRole('dialog')).toBeTruthy()
  })
})
