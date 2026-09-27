import type { HistoryEntry, ServerHistoryEntry } from './historyTypes'

export interface HistoryVisitState {
  entries: HistoryEntry[]
  loaded: boolean
}

export function beginHistoryVisit(
  serverMode: boolean,
  cachedServerEntries: ServerHistoryEntry[] | undefined,
  localEntries: HistoryEntry[],
): HistoryVisitState {
  return {
    entries: serverMode ? cachedServerEntries ?? [] : localEntries,
    // Cached server entries improve first paint, but a new workspace visit must verify freshness once.
    loaded: !serverMode,
  }
}

export function shouldLoadHistoryForVisit(serverMode: boolean, activeView: string, loaded: boolean): boolean {
  return serverMode && activeView === 'history' && !loaded
}

export function shouldRefreshHistoryAfterMutation(serverMode: boolean, loaded: boolean, realtimeJoined: boolean): boolean {
  return serverMode && loaded && !realtimeJoined
}
