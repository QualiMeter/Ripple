import type { ProjectImportResponse } from './backend/types'
import { apiFetch } from './client'

export interface ProjectExportFile {
  blob: Blob
  filename: string | null
}

export interface ProjectTransferApi {
  exportProject(projectId: string): Promise<ProjectExportFile>
  importProject(file: File): Promise<ProjectImportResponse>
}

function decodeExportFilename(contentDisposition: string | null): string | null {
  if (!contentDisposition) return null
  const encoded = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  if (encoded) {
    try {
      return decodeURIComponent(encoded)
    } catch {
      return encoded
    }
  }
  return contentDisposition.match(/filename="?([^";]+)"?/i)?.[1] ?? null
}

export const httpProjectTransferApi: ProjectTransferApi = {
  async exportProject(projectId) {
    const response = await apiFetch(`/v1/projects/${projectId}/export`)
    return {
      blob: await response.blob(),
      filename: decodeExportFilename(response.headers.get('Content-Disposition')),
    }
  },
  async importProject(file) {
    const body = new FormData()
    body.append('file', file)
    const response = await apiFetch('/v1/projects/import', { method: 'POST', body })
    return await response.json() as ProjectImportResponse
  },
}

const mode = import.meta.env.VITE_API_MODE ?? 'mock'

const unavailableInMock = () => Promise.reject(new Error('Экспорт и импорт проектов доступны только в режиме HTTP.'))

export const projectTransferApi: ProjectTransferApi = mode === 'http'
  ? httpProjectTransferApi
  : {
      exportProject: unavailableInMock,
      importProject: unavailableInMock,
    }
