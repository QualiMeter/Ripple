import { describe, expect, it } from 'vitest'
import type { Employee } from '../types/employee'
import type { ProjectTask } from '../types/task'
import { analyzeTeamWorkload, analyzeTeamWorkloadAttention, findWorkloadImbalance } from './teamWorkload'

const employees: Employee[] = [
  { id: 'busy', projectId: 'project', name: 'Смирнов' },
  { id: 'idle', projectId: 'project', name: 'Петров' },
]

function task(id: string, startDate: string, endDate: string, assigneeId = 'busy'): ProjectTask {
  return { id, projectId: 'project', title: id, startDate, endDate, plannedStartDate: startDate, plannedEndDate: endDate, durationDays: 1, progress: 0, assigneeId, status: 'in-progress', riskState: 'none', isCritical: false }
}

describe('team workload', () => {
  it('finds three concurrent unfinished tasks and their peak interval', () => {
    const result = analyzeTeamWorkload(employees, [task('a', '2026-10-10', '2026-10-15'), task('b', '2026-10-12', '2026-10-18'), task('c', '2026-10-12', '2026-10-15')])
    expect(result[0]).toMatchObject({ employeeName: 'Смирнов', maxConcurrentTasks: 3, peakStartDate: '2026-10-12', peakEndDate: '2026-10-15' })
  })

  it('returns zero load for an employee without tasks', () => {
    expect(analyzeTeamWorkload(employees, [task('a', '2026-10-10', '2026-10-15')])[1]).toMatchObject({ employeeName: 'Петров', maxConcurrentTasks: 0, peakStartDate: null })
  })

  it('detects a meaningful imbalance without inventing percentages', () => {
    const result = findWorkloadImbalance(employees, [task('a', '2026-10-10', '2026-10-15'), task('b', '2026-10-12', '2026-10-18'), task('c', '2026-10-12', '2026-10-15')])
    expect(result?.overloaded.maxConcurrentTasks).toBe(3)
    expect(result?.idleEmployeeNames).toEqual(['Петров'])
  })

  it('reports high workload for 3 vs 1 without calling the colleague idle', () => {
    const result = analyzeTeamWorkloadAttention(employees, [
      task('a', '2026-10-10', '2026-10-15'),
      task('b', '2026-10-12', '2026-10-18'),
      task('c', '2026-10-12', '2026-10-15'),
      task('d', '2026-10-12', '2026-10-13', 'idle'),
    ])

    expect(result.highWorkloads).toEqual([expect.objectContaining({ employeeName: 'Смирнов', maxConcurrentTasks: 3 })])
    expect(result.imbalance).toBeNull()
  })

  it('reports imbalance for 3 vs 0', () => {
    const result = analyzeTeamWorkloadAttention(employees, [
      task('a', '2026-10-10', '2026-10-15'),
      task('b', '2026-10-12', '2026-10-18'),
      task('c', '2026-10-12', '2026-10-15'),
    ])

    expect(result.imbalance).toMatchObject({ overloaded: { employeeName: 'Смирнов', maxConcurrentTasks: 3 }, idleEmployeeNames: ['Петров'] })
  })

  it('does not create a workload warning for 2 vs 0', () => {
    const result = analyzeTeamWorkloadAttention(employees, [
      task('a', '2026-10-10', '2026-10-15'),
      task('b', '2026-10-12', '2026-10-18'),
    ])

    expect(result.highWorkloads).toEqual([])
    expect(result.imbalance).toBeNull()
  })

  it('does not count completed tasks in concurrent workload', () => {
    const result = analyzeTeamWorkloadAttention(employees, [
      task('a', '2026-10-10', '2026-10-15'),
      task('b', '2026-10-12', '2026-10-18'),
      { ...task('completed', '2026-10-12', '2026-10-15'), status: 'completed' },
    ])

    expect(result.workload[0].maxConcurrentTasks).toBe(2)
    expect(result.highWorkloads).toEqual([])
  })
})
