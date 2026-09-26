import { describe, expect, it } from 'vitest'
import type { Dependency } from '../types/dependency'
import type { Project } from '../types/project'
import type { ProjectTask, TaskStatus } from '../types/task'
import { buildCurrentProjectIssues } from './scheduleEngine'

const project: Project = {
  id: 'project', creatorId: 'manager', name: 'Проект', description: '', startDate: '2026-09-01', targetEndDate: '2026-09-26',
}

function task(id: string, status: TaskStatus, endDate = '2026-10-10'): ProjectTask {
  return {
    id, projectId: project.id, title: id, startDate: '2026-10-01', endDate,
    plannedStartDate: '2026-10-01', plannedEndDate: endDate, durationDays: 10, progress: status === 'completed' ? 100 : 0,
    assigneeId: 'owner', status, riskState: 'none', isCritical: false,
  }
}

function dependency(id: string, predecessorTaskId: string, successorTaskId: string): Dependency {
  return { id, projectId: project.id, predecessorTaskId, successorTaskId, type: 'finish-to-start' }
}

describe('current project issues', () => {
  it('detects the graph regression A -> B/C -> D without marking D ready', () => {
    const tasks = [task('A', 'not-started'), task('B', 'completed'), task('C', 'not-started'), task('D', 'not-started')]
    const dependencies = [
      dependency('a-b', 'A', 'B'), dependency('a-c', 'A', 'C'),
      dependency('b-d', 'B', 'D'), dependency('c-d', 'C', 'D'),
    ]
    const issues = buildCurrentProjectIssues(project, tasks, dependencies, '2026-09-27')
    expect(issues.statusConflicts).toEqual(expect.arrayContaining([expect.objectContaining({ sourceTaskId: 'B', severity: 'error' })]))
    expect([...issues.statusConflicts, ...issues.scheduleConflicts, ...issues.deadlineIssues]
      .some((issue) => issue.reason.includes('Все предшественники задачи «D» закончены'))).toBe(false)
  })

  it('reports completed and in-progress tasks with incomplete predecessors', () => {
    const tasks = [task('A', 'not-started'), task('B', 'completed'), task('C', 'in-progress')]
    const issues = buildCurrentProjectIssues(project, tasks, [dependency('a-b', 'A', 'B'), dependency('a-c', 'A', 'C')], '2026-09-27')
    expect(issues.statusConflicts).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceTaskId: 'B', severity: 'error' }),
      expect.objectContaining({ sourceTaskId: 'C', severity: 'warning' }),
    ]))
    expect(issues.statusConflicts.find((issue) => issue.sourceTaskId === 'B')?.reason).toContain('«A»')
  })

  it('reports overdue unfinished tasks but ignores completed and exact-today deadlines', () => {
    const tasks = [
      task('overdue', 'in-progress', '2026-09-25'),
      task('done', 'completed', '2026-09-24'),
      task('today', 'not-started', '2026-09-27'),
    ]
    const issues = buildCurrentProjectIssues({ ...project, targetEndDate: '2026-12-31' }, tasks, [], '2026-09-27')
    expect(issues.deadlineIssues.some((issue) => issue.sourceTaskId === 'overdue' && issue.reason.includes('25.09.2026'))).toBe(true)
    expect(issues.deadlineIssues.some((issue) => issue.sourceTaskId === 'done')).toBe(false)
    expect(issues.deadlineIssues.some((issue) => issue.sourceTaskId === 'today')).toBe(false)
  })

  it('reports an expired project deadline once when unfinished tasks remain', () => {
    const tasks = [task('A', 'not-started'), task('B', 'completed')]
    const issues = buildCurrentProjectIssues(project, tasks, [], '2026-09-27')
    const projectIssues = issues.deadlineIssues.filter((issue) => issue.sourceTaskId === project.id)
    expect(projectIssues).toHaveLength(1)
    expect(projectIssues[0].reason).toContain('26.09.2026. Незавершённых задач: 1')
  })
})
