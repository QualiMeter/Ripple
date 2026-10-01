import { describe, expect, it } from 'vitest'
import type { Employee } from '../types/employee'
import type { ProjectTask } from '../types/task'
import {
  analyzeTeamWorkload,
  analyzeTeamWorkloadAttention,
  buildDailyWorkload,
  rankReassignmentCandidates,
  simulateTaskReassignment,
} from './teamWorkload'

const employees: Employee[] = [
  { id: 'busy', projectId: 'project', name: 'Смирнов' },
  { id: 'petrov', projectId: 'project', name: 'Петров' },
  { id: 'ivanov', projectId: 'project', name: 'Иванов' },
]

function task(id: string, startDate: string, endDate: string, assigneeId = 'busy'): ProjectTask {
  return {
    id, projectId: 'project', title: id, startDate, endDate, plannedStartDate: startDate, plannedEndDate: endDate,
    durationDays: 1, progress: 0, assigneeId, status: 'in-progress', riskState: 'none', isCritical: false,
  }
}

describe('team workload schedule analysis', () => {
  it('builds inclusive daily workload and classifies two sustained long parallel tasks', () => {
    const tasks = [
      task('a', '2026-10-01', '2026-10-12'),
      task('b', '2026-10-02', '2026-10-12'),
      task('baseline', '2026-10-20', '2026-10-24', 'petrov'),
    ]
    const daily = buildDailyWorkload(tasks, 'busy')
    const workload = analyzeTeamWorkload(employees, tasks)[0]

    expect(daily.find((day) => day.date === '2026-10-02')?.taskIds).toEqual(['a', 'b'])
    expect(workload).toMatchObject({ peakConcurrency: 2, parallelDays: 11, longestParallelStreak: 11, level: 'high', primaryFactor: 'sustained' })
    expect(workload.reasons.join(' ')).toContain('11 дней подряд')
  })

  it('detects fragmentation from many relatively short tasks with close starts', () => {
    const tasks = [
      ...Array.from({ length: 7 }, (_, index) => task(`long-${index}`, `2026-11-${String(index + 1).padStart(2, '0')}`, `2026-11-${String(index + 14).padStart(2, '0')}`, index % 2 === 0 ? 'petrov' : 'ivanov')),
      ...Array.from({ length: 6 }, (_, index) => task(`short-${index}`, `2026-10-0${index + 1}`, `2026-10-0${index + 1}`)),
    ]
    const workload = analyzeTeamWorkload(employees, tasks)[0]

    expect(workload).toMatchObject({ fragmentation: 'high', level: 'high', primaryFactor: 'fragmented', shortTaskCount: 6, taskStarts: 6 })
    expect(workload.reasons.join(' ')).toContain('6 коротких задач')
  })

  it('does not treat a one-day overlap of two tasks as serious load', () => {
    const workload = analyzeTeamWorkload(employees, [
      task('a', '2026-10-01', '2026-10-05'),
      task('b', '2026-10-05', '2026-10-09'),
    ])[0]

    expect(workload).toMatchObject({ peakConcurrency: 2, parallelDays: 1, longestParallelStreak: 1, level: 'normal' })
    expect(analyzeTeamWorkloadAttention(employees, [task('a', '2026-10-01', '2026-10-05'), task('b', '2026-10-05', '2026-10-09')]).primary).toBeNull()
  })

  it('marks three strongly overlapping tasks as high load', () => {
    const workload = analyzeTeamWorkload(employees, [
      task('a', '2026-10-01', '2026-10-08'),
      task('b', '2026-10-02', '2026-10-08'),
      task('c', '2026-10-03', '2026-10-08'),
    ])[0]
    expect(workload).toMatchObject({ peakConcurrency: 3, peakDays: 6, level: 'high' })
  })

  it('does not count completed tasks in daily or aggregate load', () => {
    const tasks = [
      task('active', '2026-10-01', '2026-10-05'),
      { ...task('completed', '2026-10-01', '2026-10-05'), status: 'completed' as const },
    ]
    const workload = analyzeTeamWorkload(employees, tasks)[0]
    expect(workload).toMatchObject({ peakConcurrency: 1, assignedTaskDays: 5, taskStarts: 1 })
    expect(workload.dailyWorkload.every((day) => !day.taskIds.includes('completed'))).toBe(true)
  })

  it('can prefer a candidate with one short task over a candidate with heavy upcoming load', () => {
    const tasks = [
      task('move-me', '2026-10-01', '2026-10-10'),
      task('busy-2', '2026-10-01', '2026-10-10'),
      task('petrov-short', '2026-10-03', '2026-10-03', 'petrov'),
      task('ivanov-1', '2026-10-03', '2026-10-10', 'ivanov'),
      task('ivanov-2', '2026-10-03', '2026-10-10', 'ivanov'),
      task('ivanov-3', '2026-10-03', '2026-10-10', 'ivanov'),
    ]

    const candidates = rankReassignmentCandidates(employees, tasks, 'move-me')
    expect(candidates[0].employeeName).toBe('Петров')
    expect(candidates.find((candidate) => candidate.employeeName === 'Иванов')!.additionalSchedulingPressure)
      .toBeGreaterThan(candidates[0].additionalSchedulingPressure)
  })

  it('reports before/after deltas and simulation does not mutate source tasks', () => {
    const tasks = [task('move-me', '2026-10-01', '2026-10-10'), task('petrov', '2026-10-03', '2026-10-03', 'petrov')]
    const snapshot = structuredClone(tasks)
    const simulated = simulateTaskReassignment(tasks, 'move-me', 'petrov')
    const candidate = rankReassignmentCandidates(employees, tasks, 'move-me').find((item) => item.employeeId === 'petrov')!

    expect(tasks).toEqual(snapshot)
    expect(simulated).not.toBe(tasks)
    expect(simulated[0].assigneeId).toBe('petrov')
    expect(candidate.delta).toEqual(expect.objectContaining({ peakConcurrency: 1, parallelDays: 1 }))
  })
})
