// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { httpProjectTransferApi } from './projectTransfer.api'

afterEach(() => vi.unstubAllGlobals())

describe('project transfer API', () => {
  it('downloads the project export and preserves the UTF-8 filename', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"project":{}}', {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Content-Disposition': "attachment; filename*=UTF-8''%D0%9F%D1%80%D0%BE%D0%B5%D0%BA%D1%82.ripple.json" },
    }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await httpProjectTransferApi.exportProject('project-id')

    expect(fetchMock.mock.calls[0][0]).toBe('https://92.63.102.15/api/v1/projects/project-id/export')
    expect(result.filename).toBe('Проект.ripple.json')
    expect(await result.blob.text()).toBe('{"project":{}}')
  })

  it('imports a project as multipart form data without a JSON content type', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      projectId: 'imported-id', name: 'Импорт', employeeCount: 2, taskCount: 3, dependencyCount: 1,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    const file = new File(['{}'], 'project.ripple.json', { type: 'application/json' })

    const result = await httpProjectTransferApi.importProject(file)
    const [, init] = fetchMock.mock.calls[0]

    expect(fetchMock.mock.calls[0][0]).toBe('https://92.63.102.15/api/v1/projects/import')
    expect(init.method).toBe('POST')
    expect(init.body).toBeInstanceOf(FormData)
    expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined()
    expect(result.projectId).toBe('imported-id')
  })
})
