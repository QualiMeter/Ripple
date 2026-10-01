import { describe, expect, it } from 'vitest'
import type { ServerHistoryEntry } from './historyTypes'
import { beginHistoryVisit, shouldLoadHistoryForVisit, shouldRefreshHistoryAfterMutation } from './historySyncPolicy'

const cached: ServerHistoryEntry = {
  source: 'server', id: 'entry', projectId: 'project', operationType: 'task-updated',
  description: 'Изменение', createdAt: '2026-09-28T00:00:00Z', canUndo: true, isCurrent: true,
}

describe('history synchronization policy', () => {
  it('keeps cache for first paint but refreshes on the first History open of every project visit', () => {
    const visitOne = beginHistoryVisit(true, [cached], [])
    expect(visitOne).toEqual({ entries: [cached], loaded: false })
    expect(shouldLoadHistoryForVisit(true, 'history', visitOne.loaded)).toBe(true)
    expect(shouldLoadHistoryForVisit(true, 'history', true)).toBe(false)

    const visitTwo = beginHistoryVisit(true, [cached], [])
    expect(shouldLoadHistoryForVisit(true, 'history', visitTwo.loaded)).toBe(true)
  })

  it('refreshes after a local mutation only as fallback when loaded History has no realtime group', () => {
    expect(shouldRefreshHistoryAfterMutation(true, false, false)).toBe(false)
    expect(shouldRefreshHistoryAfterMutation(true, true, true)).toBe(false)
    expect(shouldRefreshHistoryAfterMutation(true, true, false)).toBe(true)
  })
})
