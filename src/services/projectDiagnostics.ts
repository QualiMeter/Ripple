import { diagnosticsApi, type DiagnosticsApi } from '../api/diagnostics.api'
import type { ProjectDiagnosticsDto } from '../api/backend/types'

export type SaveDiagnosticsFile = (contents: string, filename: string) => void

export function buildProjectDiagnosticsFilename(projectName: string, generatedAt: string): string {
  const safeName = projectName.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '') || 'project'
  const date = generatedAt.slice(0, 10) || 'diagnostics'
  return `ripple-${safeName}-diagnostics-${date}.json`
}

export const saveDiagnosticsFile: SaveDiagnosticsFile = (contents, filename) => {
  const url = URL.createObjectURL(new Blob([contents], { type: 'application/json;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.hidden = true
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export async function downloadProjectDiagnostics(
  projectId: string,
  projectName: string,
  api: DiagnosticsApi = diagnosticsApi,
  saveFile: SaveDiagnosticsFile = saveDiagnosticsFile,
): Promise<ProjectDiagnosticsDto> {
  const diagnostics = await api.getProjectDiagnostics(projectId)
  saveFile(JSON.stringify(diagnostics, null, 2), buildProjectDiagnosticsFilename(projectName, diagnostics.generatedAt))
  return diagnostics
}
