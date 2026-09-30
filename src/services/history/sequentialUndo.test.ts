import { describe, expect, it } from 'vitest'
import type { ServerHistoryEntry } from './historyTypes'
import { getLatestUndoableHistoryEntryId } from './sequentialUndo'

function entry(id: string, createdAt: string, canUndo = true, undone = false): ServerHistoryEntry {
  return { source: 'server', id, projectId: 'project', operationType: 'task.update', description: id, createdAt, canUndo, undone }
}

describe('sequential History Undo', () => {
  it('allows only the latest available entry and advances after it is undone', () => {
    const entries = [
      entry('A', '2026-09-30T10:00:00Z'),
      entry('B', '2026-09-30T11:00:00Z'),
      entry('C', '2026-09-30T12:00:00Z'),
    ]
    expect(getLatestUndoableHistoryEntryId(entries)).toBe('C')
    expect(getLatestUndoableHistoryEntryId(entries.map((item) => item.id === 'C' ? { ...item, canUndo: false, undone: true } : item))).toBe('B')
  })
})
