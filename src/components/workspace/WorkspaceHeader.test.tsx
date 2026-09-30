// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WorkspaceHeader } from './WorkspaceHeader'

const project = { id: 'project', creatorId: 'manager', name: 'Проект', description: '', startDate: '2026-01-01', targetEndDate: '2026-01-31', projectedEndDate: '2026-01-31', ownerName: 'Менеджер', health: 'at-risk' as const, progress: 0, taskCount: 1, completedTaskCount: 0 }

afterEach(cleanup)

describe('WorkspaceHeader', () => {
  it('shows only the MVP workspace navigation including History', () => {
    const markup = renderToStaticMarkup(<WorkspaceHeader
      project={project}
      activeView="overview"
      onViewChange={() => undefined}
      onOpenNavigation={() => undefined}
      onEditProject={() => undefined}
      onDeleteProject={() => undefined}
    />)
    expect(markup).toContain('Обзор')
    expect(markup).toContain('Зависимости')
    expect(markup).toContain('Сотрудники')
    expect(markup).toContain('История')
    expect(markup).not.toContain('>План<')
    expect(markup).not.toContain('Риски и последствия')
  })

  it('offers the unobtrusive diagnostics download through the project menu', async () => {
    const onDownloadDiagnostics = vi.fn().mockResolvedValue(undefined)
    render(<WorkspaceHeader
      project={project}
      activeView="overview"
      onViewChange={() => undefined}
      onOpenNavigation={() => undefined}
      onEditProject={() => undefined}
      onDeleteProject={() => undefined}
      onDownloadDiagnostics={onDownloadDiagnostics}
    />)

    fireEvent.click(screen.getByRole('button', { name: /Меню проекта/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Скачать диагностику' }))
    await waitFor(() => expect(onDownloadDiagnostics).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
  })

  it('does not show a server diagnostics action when no handler is available', () => {
    render(<WorkspaceHeader project={project} activeView="overview" onViewChange={() => undefined} onOpenNavigation={() => undefined} onEditProject={() => undefined} onDeleteProject={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: /Меню проекта/ }))
    expect(screen.queryByRole('menuitem', { name: 'Скачать диагностику' })).toBeNull()
  })

  it('offers project export and imports the selected ripple file', async () => {
    const onExportProject = vi.fn().mockResolvedValue(undefined)
    const onImportProject = vi.fn().mockResolvedValue(undefined)
    render(<WorkspaceHeader project={project} activeView="overview" onViewChange={() => undefined} onOpenNavigation={() => undefined} onEditProject={() => undefined} onDeleteProject={() => undefined} onExportProject={onExportProject} onImportProject={onImportProject} />)

    fireEvent.click(screen.getByRole('button', { name: /Меню проекта/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Экспортировать проект' }))
    await waitFor(() => expect(onExportProject).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('button', { name: /Меню проекта/ }))
    const file = new File(['{}'], 'project.ripple.json', { type: 'application/json' })
    fireEvent.change(screen.getByLabelText('Файл импорта проекта'), { target: { files: [file] } })
    await waitFor(() => expect(onImportProject).toHaveBeenCalledWith(file))
  })
})
