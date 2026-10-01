import { describe, expect, it } from 'vitest'
import type { Dependency } from '../types/dependency'
import type { Employee } from '../types/employee'
import type { ProjectTask } from '../types/task'
import type { ProjectWorkspace } from '../types/workspace'
import { rebuildWorkspaceDerivedState } from './workspaceState'
import { buildRecoveryPlan, buildScheduleRecoveryResult } from './recoveryPlan'

function task(id: string, title: string, startDate: string, endDate: string, assigneeId = 'employee', status: ProjectTask['status'] = 'not-started'): ProjectTask {
  return {
    id, projectId: 'project', title, startDate, endDate, plannedStartDate: startDate, plannedEndDate: endDate,
    durationDays: 1, progress: 0, assigneeId, status, riskState: 'none', isCritical: false,
  }
}

function dependency(id: string, predecessorTaskId: string, successorTaskId: string): Dependency {
  return { id, projectId: 'project', predecessorTaskId, successorTaskId, type: 'finish-to-start' }
}

function workspace(tasks: ProjectTask[], dependencies: Dependency[] = [], assignees: Employee[] = [{ id: 'employee', projectId: 'project', name: 'Сотрудник' }], targetEndDate = '2026-10-20'): ProjectWorkspace {
  const base: ProjectWorkspace = {
    project: { id: 'project', creatorId: 'owner', name: 'Проект', description: '', startDate: '2026-10-01', targetEndDate, projectedEndDate: targetEndDate, ownerName: 'Менеджер', health: 'on-track', progress: 0, taskCount: tasks.length, completedTaskCount: 0 },
    tasks, dependencies, assignees,
    impact: { sourceTaskId: tasks[0]?.id ?? '', lastChange: { kind: 'session-started' }, affectedTaskIds: tasks.slice(1).map((item) => item.id), criticalTaskIds: [], slackDaysByTaskId: {}, atRiskTaskIds: [], previousProjectEndDate: targetEndDate, projectedProjectEndDate: targetEndDate, projectEndChangeDays: 0, deadlineShiftDays: 0, requiresIntervention: false, reasons: [], analyzedAt: '2026-10-01T00:00:00Z' },
    currentIssues: { scheduleConflicts: [], statusConflicts: [], deadlineIssues: [], affectedTaskIds: [] },
    projectBoundaryIssues: [], recoveryScenarios: [],
  }
  return rebuildWorkspaceDerivedState(base, { sourceTaskId: tasks[0]?.id ?? '', affectedTaskIds: tasks.slice(1).map((item) => item.id) })
}

describe('recovery plan', () => {
  it('does not request intervention for a healthy project', () => {
    const plan = buildRecoveryPlan(workspace([task('a', 'Задача', '2026-10-01', '2026-10-05')]))
    expect(plan.interventionRequired).toBe(false)
    expect(plan.options).toEqual([])
  })

  it('calculates a four-day delay and orders the existing critical chain', () => {
    const value = workspace([
      task('a', 'Backend', '2026-10-10', '2026-10-13'),
      task('b', 'Testing', '2026-10-14', '2026-10-17'),
      task('c', 'Release', '2026-10-18', '2026-10-24'),
    ], [dependency('a-b', 'a', 'b'), dependency('b-c', 'b', 'c')])
    const plan = buildRecoveryPlan(value)

    expect(plan.delayDays).toBe(4)
    expect(plan.criticalChainTaskIds).toEqual(['a', 'b', 'c'])
    const preserve = plan.options.find((option) => option.type === 'preserve-deadline')
    expect(preserve).toMatchObject({ daysToRecover: 4, criticalTaskIds: ['a', 'b', 'c'] })
  })

  it('builds safe-shift dates from the existing cascade calculation', () => {
    const value = workspace([
      task('a', 'Architecture', '2026-10-10', '2026-10-14'),
      task('b', 'Backend', '2026-10-14', '2026-10-16'),
      task('c', 'Testing', '2026-10-17', '2026-10-19'),
    ], [dependency('a-b', 'a', 'b'), dependency('b-c', 'b', 'c')])
    const plan = buildRecoveryPlan(value)
    const safe = plan.options.find((option) => option.type === 'schedule-shift')

    expect(safe?.taskShifts).toEqual([
      expect.objectContaining({ taskId: 'b', proposedStartDate: '2026-10-15', proposedEndDate: '2026-10-17' }),
      expect.objectContaining({ taskId: 'c', proposedStartDate: '2026-10-18', proposedEndDate: '2026-10-20' }),
    ])
    expect(safe).toMatchObject({ conflictsBefore: 1, conflictsAfter: 0 })
  })

  it('never offers completed tasks as automatic shifts', () => {
    const value = workspace([
      task('a', 'Architecture', '2026-10-10', '2026-10-14'),
      task('b', 'Completed', '2026-10-14', '2026-10-16', 'employee', 'completed'),
    ], [dependency('a-b', 'a', 'b')])
    const plan = buildRecoveryPlan(value)

    expect(plan.options.some((option) => option.type === 'schedule-shift')).toBe(false)
    expect(plan.options.find((option) => option.type === 'manual-task-review')).toMatchObject({ taskId: 'b' })
  })

  it('adds a concrete workload reassignment with before and after peaks', () => {
    const employees = [
      { id: 'sergey', projectId: 'project', name: 'Сергей' },
      { id: 'anna', projectId: 'project', name: 'Анна' },
    ]
    const value = workspace([
      task('frontend', 'Frontend', '2026-10-01', '2026-10-12', 'sergey'),
      task('backend', 'Backend', '2026-10-01', '2026-10-12', 'sergey'),
      task('testing', 'Testing', '2026-10-01', '2026-10-12', 'sergey'),
      task('docs', 'Docs', '2026-10-04', '2026-10-05', 'anna'),
    ], [], employees, '2026-10-31')
    const plan = buildRecoveryPlan(value)
    const option = plan.options.find((candidate) => candidate.type === 'workload-reassignment')

    expect(plan.interventionRequired).toBe(true)
    expect(option?.preview).toMatchObject({
      sourceEmployeeName: 'Сергей', candidateEmployeeName: 'Анна',
      sourceBefore: { peakConcurrency: 3 }, sourceAfter: { peakConcurrency: 2 },
    })
    expect(option?.preview.candidateAfter.peakConcurrency).toBeGreaterThanOrEqual(option?.preview.candidateBefore.peakConcurrency ?? 0)
  })

  it('derives the success comparison from preview state', () => {
    const value = workspace([
      task('a', 'Architecture', '2026-10-10', '2026-10-14'),
      task('b', 'Backend', '2026-10-14', '2026-10-16'),
    ], [dependency('a-b', 'a', 'b')], undefined, '2026-10-15')
    const safe = buildRecoveryPlan(value).options.find((option) => option.type === 'schedule-shift')!
    if (safe.type !== 'schedule-shift') throw new Error('Expected schedule option')

    expect(buildScheduleRecoveryResult(value, safe.preview)).toMatchObject({
      conflictsBefore: 1, conflictsAfter: 0, changedTaskCount: 1, projectedEndDateAfter: '2026-10-17', delayDaysAfter: 2,
    })
  })
})
