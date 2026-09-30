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
})
