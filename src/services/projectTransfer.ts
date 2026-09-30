import { projectTransferApi, type ProjectTransferApi } from '../api/projectTransfer.api'

export type SaveProjectExport = (blob: Blob, filename: string) => void

function safeProjectFilename(projectName: string): string {
  const safeName = projectName.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '')
  return `${safeName || 'project'}.ripple.json`
}

export const saveProjectExport: SaveProjectExport = (blob, filename) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.hidden = true
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export async function downloadProjectExport(
  projectId: string,
  projectName: string,
  api: ProjectTransferApi = projectTransferApi,
  saveFile: SaveProjectExport = saveProjectExport,
): Promise<void> {
  const exported = await api.exportProject(projectId)
  saveFile(exported.blob, exported.filename ?? safeProjectFilename(projectName))
}
