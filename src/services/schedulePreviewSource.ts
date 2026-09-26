import type { CurrentProjectIssues } from '../types/impact'

export function getSchedulePreviewSourceIds(currentIssues: CurrentProjectIssues): string[] {
  return [...new Set(currentIssues.scheduleConflicts
    .filter((reason) => reason.action?.type === 'preview-shift')
    .map((reason) => reason.sourceTaskId))]
}
