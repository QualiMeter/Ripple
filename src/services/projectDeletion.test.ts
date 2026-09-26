import { describe, expect, it, vi } from 'vitest'
import { deleteProjectAndLeave } from './projectDeletion'
import { getInitialProjectPath } from './projectNavigation'

describe('project deletion flow', () => {
  it('refreshes projects and navigates away only after deletion', async () => {
    const calls: string[] = []
    await deleteProjectAndLeave('project', {
      deleteProject: async () => { calls.push('delete') },
      closeDialog: () => { calls.push('close') },
      refreshProjects: async () => { calls.push('refresh') },
      navigateHome: () => { calls.push('navigate') },
    })
    expect(calls).toEqual(['delete', 'close', 'refresh', 'navigate'])
  })

  it('does not close or navigate when deletion fails', async () => {
    const closeDialog = vi.fn()
    const navigateHome = vi.fn()
    await expect(deleteProjectAndLeave('project', {
      deleteProject: async () => { throw new Error('Backend error') },
      closeDialog,
      refreshProjects: vi.fn(),
      navigateHome,
    })).rejects.toThrow('Backend error')
    expect(closeDialog).not.toHaveBeenCalled()
    expect(navigateHome).not.toHaveBeenCalled()
  })

  it('keeps the entry route in an empty state when no projects remain', () => {
    expect(getInitialProjectPath([])).toBeNull()
  })
})
