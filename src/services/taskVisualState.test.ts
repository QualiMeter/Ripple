import { describe, expect, it } from 'vitest'
import type { ProjectTask } from '../types/task'
import { getTaskVisualState } from './taskVisualState'

function task(overrides: Partial<ProjectTask> = {}): ProjectTask {
  return {
    id: 'task', projectId: 'project', title: 'Задача', startDate: '2026-10-01', endDate: '2026-10-02',
    plannedStartDate: '2026-10-01', plannedEndDate: '2026-10-02', durationDays: 2, progress: 0,
    assigneeId: 'employee', status: 'not-started', riskState: 'none', isCritical: false, ...overrides,
  }
}

describe('getTaskVisualState', () => {
  it('uses task status without substituting criticality', () => {
    expect(getTaskVisualState(task({ status: 'in-progress', isCritical: false }))).toBe('in-progress')
    expect(getTaskVisualState(task({ status: 'in-progress', isCritical: true }))).toBe('in-progress')
    expect(getTaskVisualState(task({ status: 'not-started', isCritical: true }))).toBe('not-started')
  })

  it('keeps affected and risk states above the status color', () => {
    expect(getTaskVisualState(task({ status: 'completed' }), { affected: true })).toBe('affected')
    expect(getTaskVisualState(task({ status: 'in-progress', riskState: 'at-risk' }))).toBe('risk')
    expect(getTaskVisualState(task({ status: 'delayed' }))).toBe('risk')
  })
})
