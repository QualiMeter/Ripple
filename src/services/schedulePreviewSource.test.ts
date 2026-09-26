import { describe, expect, it } from 'vitest'
import type { CurrentProjectIssues, ImpactReason } from '../types/impact'
import { getSchedulePreviewSourceIds } from './schedulePreviewSource'

function conflict(sourceTaskId: string, affectedTaskId: string): ImpactReason {
  return {
    sourceTaskId,
    affectedTaskIds: [affectedTaskId],
    reason: 'Конфликт',
    consequence: 'Требуется решение',
    severity: 'warning',
    action: { type: 'preview-shift' },
  }
}

describe('getSchedulePreviewSourceIds', () => {
  it('возвращает пустой список без конфликтов', () => {
    expect(getSchedulePreviewSourceIds({ scheduleConflicts: [], statusConflicts: [], deadlineIssues: [], affectedTaskIds: [] })).toEqual([])
  })

  it('объединяет конфликты одного источника и сохраняет разные источники для выбора', () => {
    const issues: CurrentProjectIssues = {
      scheduleConflicts: [conflict('a', 'b'), conflict('a', 'c'), conflict('d', 'e')],
      statusConflicts: [],
      deadlineIssues: [],
      affectedTaskIds: ['b', 'c', 'e'],
    }
    expect(getSchedulePreviewSourceIds(issues)).toEqual(['a', 'd'])
  })

  it('не предлагает automatic shift для status/deadline issues и ручных schedule conflicts', () => {
    const manualConflict = { ...conflict('manual', 'completed'), action: { type: 'open-task' as const, taskId: 'completed' } }
    expect(getSchedulePreviewSourceIds({
      scheduleConflicts: [manualConflict],
      statusConflicts: [conflict('status', 'task')],
      deadlineIssues: [conflict('deadline', 'task')],
      affectedTaskIds: ['completed', 'task'],
    })).toEqual([])
  })
})
