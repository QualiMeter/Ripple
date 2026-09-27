import { describe, expect, it } from 'vitest'
import type { Dependency } from '../types/dependency'
import type { CurrentProjectIssues, ImpactReason } from '../types/impact'
import type { ProjectTask } from '../types/task'
import { findScheduleConflicts } from './scheduleEngine'
import { buildTaskPlanRows, filterTaskPlanRows } from './taskPlan'
import { selectTasksRequiringAttention } from './taskAttention'

function task(id: string, startDate: string, endDate: string): ProjectTask {
  return { id, projectId: 'project', title: id, startDate, endDate, plannedStartDate: startDate, plannedEndDate: endDate, durationDays: 1, progress: 0, assigneeId: 'employee', status: 'not-started', riskState: 'none', isCritical: false }
}

const tasks = [
  task('A', '2026-10-11', '2026-10-14'),
  task('C', '2026-10-12', '2026-10-17'),
  task('B', '2026-10-17', '2026-10-20'),
  task('buffer', '2026-10-20', '2026-10-21'),
  task('overdue', '2026-09-01', '2026-09-10'),
]
const dependencies: Dependency[] = [
  { id: 'a-b', projectId: 'project', predecessorTaskId: 'A', successorTaskId: 'B', type: 'finish-to-start' },
  { id: 'c-b', projectId: 'project', predecessorTaskId: 'C', successorTaskId: 'B', type: 'finish-to-start' },
]
const deadlineIssue: ImpactReason = { sourceTaskId: 'overdue', affectedTaskIds: ['overdue'], severity: 'warning', reason: 'Срок истёк', consequence: 'Проверить', action: { type: 'open-task', taskId: 'overdue' } }
const scheduleConflicts = findScheduleConflicts(tasks, dependencies, tasks.map((item) => item.id))
const currentIssues: CurrentProjectIssues = { scheduleConflicts, statusConflicts: [], deadlineIssues: [deadlineIssue], affectedTaskIds: ['B', 'overdue'] }
const criticalTaskIds = ['A', 'B']
const slackDaysByTaskId = { A: 0, B: -2, C: 2, buffer: 3, overdue: 4 }
const rows = buildTaskPlanRows({ tasks, dependencies, criticalTaskIds, slackDaysByTaskId, currentIssues, today: '2026-09-27' })

describe('task plan rows and filters', () => {
  it('uses the existing attention selector for the default filter', () => {
    expect(filterTaskPlanRows(rows, 'attention', tasks, currentIssues.affectedTaskIds, criticalTaskIds, currentIssues).map((row) => row.task.id)).toEqual(
      selectTasksRequiringAttention(tasks, currentIssues.affectedTaskIds, criticalTaskIds, currentIssues).map((item) => item.id),
    )
  })

  it('returns every task for All', () => {
    expect(filterTaskPlanRows(rows, 'all', tasks, [], criticalTaskIds, currentIssues)).toHaveLength(tasks.length)
  })

  it('separates critical and buffered tasks from calculated slack', () => {
    expect(filterTaskPlanRows(rows, 'critical', tasks, [], criticalTaskIds, currentIssues).map((row) => row.task.id)).toEqual(['A', 'B'])
    expect(filterTaskPlanRows(rows, 'buffer', tasks, [], criticalTaskIds, currentIssues).map((row) => row.task.id)).toEqual(['C', 'buffer', 'overdue'])
  })

  it('uses the schedule-conflict successor rather than predecessor', () => {
    expect(filterTaskPlanRows(rows, 'conflicts', tasks, [], criticalTaskIds, currentIssues).map((row) => row.task.id)).toEqual(['B'])
  })

  it('uses the same overdue analysis as the badge', () => {
    expect(filterTaskPlanRows(rows, 'overdue', tasks, [], criticalTaskIds, currentIssues).map((row) => row.task.id)).toEqual(['overdue'])
    expect(rows.find((row) => row.task.id === 'overdue')?.overdue?.overdueDays).toBe(17)
  })

  it('uses the latest predecessor end for the earliest allowed start', () => {
    const row = rows.find((candidate) => candidate.task.id === 'B')!
    expect(row.predecessors.map((predecessor) => predecessor.id)).toEqual(['C', 'A'])
    expect(row.earliestAllowedStart).toBe('2026-10-18')
  })
})
