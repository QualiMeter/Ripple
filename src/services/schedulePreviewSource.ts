import type { CurrentProjectIssues } from '../types/impact'

export function getSchedulePreviewSourceIds(currentIssues: CurrentProjectIssues): string[] {
  return [...new Set(currentIssues.scheduleConflicts.map((reason) => reason.sourceTaskId))]
}
