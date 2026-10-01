import { isServerHistoryEntry, type HistoryEntry } from './historyTypes'

export function isHistoryEntryUndoable(entry: HistoryEntry): boolean {
  return isServerHistoryEntry(entry)
    ? entry.canUndo && entry.isCurrent && !entry.undone
    : entry.revertStatus === 'available'
}

export function getLatestUndoableHistoryEntryId(entries: HistoryEntry[]): string | null {
  const candidates = entries
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => isHistoryEntryUndoable(entry))
    .sort((left, right) => {
      const timeDifference = Date.parse(right.entry.createdAt) - Date.parse(left.entry.createdAt)
      return timeDifference || left.index - right.index
    })
  return candidates[0]?.entry.id ?? null
}
