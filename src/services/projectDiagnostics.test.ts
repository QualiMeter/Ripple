import { describe, expect, it, vi } from 'vitest'
import type { DiagnosticsApi } from '../api/diagnostics.api'
import { buildProjectDiagnosticsFilename, downloadProjectDiagnostics } from './projectDiagnostics'

const diagnostics = {
  generatedAt: '2026-09-28T18:05:43Z',
  project: { id: 'project' },
  employees: [],
  tasks: [{ id: 'task' }],
  dependencies: [],
  projectAnalysis: [],
  taskAnalysis: {},
  history: [],
}

describe('project diagnostics download', () => {
  it('builds a safe and recognizable JSON filename', () => {
    expect(buildProjectDiagnosticsFilename('Запуск / Аврора', diagnostics.generatedAt)).toBe('ripple-Запуск-Аврора-diagnostics-2026-09-28.json')
  })

  it('downloads the unchanged backend payload as formatted JSON', async () => {
    const api: DiagnosticsApi = { getProjectDiagnostics: vi.fn().mockResolvedValue(diagnostics) }
    const saveFile = vi.fn()

    await downloadProjectDiagnostics('project', 'Аврора', api, saveFile)

    expect(api.getProjectDiagnostics).toHaveBeenCalledWith('project')
    expect(saveFile).toHaveBeenCalledWith(
      JSON.stringify(diagnostics, null, 2),
      'ripple-Аврора-diagnostics-2026-09-28.json',
    )
  })

  it('does not create a file when the backend request fails', async () => {
    const api: DiagnosticsApi = { getProjectDiagnostics: vi.fn().mockRejectedValue(new Error('Диагностика недоступна')) }
    const saveFile = vi.fn()

    await expect(downloadProjectDiagnostics('project', 'Аврора', api, saveFile)).rejects.toThrow('Диагностика недоступна')
    expect(saveFile).not.toHaveBeenCalled()
  })
})
