import { describe, expect, it } from 'vitest'
import type { Dependency } from '../types/dependency'
import type { ProjectTask } from '../types/task'
import { analyzeCriticalPath } from './criticalPath'

function task(id: string, startDate: string, endDate: string): ProjectTask {
  const durationDays = Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86_400_000) + 1
  return {
    id,
    projectId: 'project',
    title: id,
    startDate,
    endDate,
    plannedStartDate: startDate,
    plannedEndDate: endDate,
    durationDays,
    progress: 0,
    assigneeId: 'employee',
    status: 'not-started',
    riskState: 'none',
    isCritical: false,
  }
}

function dependency(predecessorTaskId: string, successorTaskId: string, id = `${predecessorTaskId}-${successorTaskId}`): Dependency {
  return { id, projectId: 'project', predecessorTaskId, successorTaskId, type: 'finish-to-start' }
}

describe('analyzeCriticalPath', () => {
  it('возвращает пустой результат для пустого проекта', () => {
    expect(analyzeCriticalPath([], [])).toEqual({ criticalTaskIds: [], slackDaysByTaskId: {}, projectEndDate: '' })
  })

  it('считает единственную задачу критической', () => {
    expect(analyzeCriticalPath([task('A', '2026-10-01', '2026-10-03')], [])).toEqual({
      criticalTaskIds: ['A'],
      slackDaysByTaskId: { A: 0 },
      projectEndDate: '2026-10-03',
    })
  })

  it('считает линейную цепочку без зазоров критической', () => {
    const result = analyzeCriticalPath([
      task('A', '2026-10-01', '2026-10-03'),
      task('B', '2026-10-04', '2026-10-10'),
    ], [dependency('A', 'B')])

    expect(result.criticalTaskIds).toEqual(['A', 'B'])
    expect(result.slackDaysByTaskId).toEqual({ A: 0, B: 0 })
  })

  it('учитывает временной буфер между predecessor и successor', () => {
    const bufferedPredecessor = { ...task('A', '2026-10-01', '2026-10-03'), isCritical: true }
    const result = analyzeCriticalPath([
      bufferedPredecessor,
      task('B', '2026-10-08', '2026-10-10'),
    ], [dependency('A', 'B')])

    expect(result.criticalTaskIds).toEqual(['B'])
    expect(result.slackDaysByTaskId).toEqual({ A: 4, B: 0 })
  })

  it('оставляет запас на более короткой параллельной ветке', () => {
    const result = analyzeCriticalPath([
      task('root', '2026-10-01', '2026-10-01'),
      task('short', '2026-10-02', '2026-10-04'),
      task('long', '2026-10-02', '2026-10-08'),
    ], [dependency('root', 'short'), dependency('root', 'long')])

    expect(result.criticalTaskIds).toEqual(['root', 'long'])
    expect(result.slackDaysByTaskId.short).toBe(4)
  })

  it('поддерживает две одновременно критические ветки', () => {
    const result = analyzeCriticalPath([
      task('A1', '2026-10-01', '2026-10-02'),
      task('A2', '2026-10-03', '2026-10-05'),
      task('B1', '2026-10-01', '2026-10-02'),
      task('B2', '2026-10-03', '2026-10-05'),
    ], [dependency('A1', 'A2'), dependency('B1', 'B2')])

    expect(result.criticalTaskIds).toEqual(['A1', 'A2', 'B1', 'B2'])
  })

  it('учитывает несколько predecessors', () => {
    const result = analyzeCriticalPath([
      task('early', '2026-10-01', '2026-10-02'),
      task('late', '2026-10-01', '2026-10-04'),
      task('merge', '2026-10-05', '2026-10-06'),
    ], [dependency('early', 'merge'), dependency('late', 'merge')])

    expect(result.criticalTaskIds).toEqual(['late', 'merge'])
    expect(result.slackDaysByTaskId.early).toBe(2)
  })

  it('изменение даты переводит критичность с одной ветки на другую', () => {
    const initial = analyzeCriticalPath([
      task('A', '2026-10-01', '2026-10-05'),
      task('B', '2026-10-01', '2026-10-04'),
    ], [])
    const changed = analyzeCriticalPath([
      task('A', '2026-10-01', '2026-10-05'),
      task('B', '2026-10-01', '2026-10-06'),
    ], [])

    expect(initial.criticalTaskIds).toEqual(['A'])
    expect(changed.criticalTaskIds).toEqual(['B'])
  })

  it('добавление и удаление dependency меняет criticalTaskIds', () => {
    const tasks = [
      task('A', '2026-10-01', '2026-10-07'),
      task('B', '2026-10-08', '2026-10-10'),
    ]

    expect(analyzeCriticalPath(tasks, []).criticalTaskIds).toEqual(['B'])
    expect(analyzeCriticalPath(tasks, [dependency('A', 'B')]).criticalTaskIds).toEqual(['A', 'B'])
    expect(analyzeCriticalPath(tasks, []).criticalTaskIds).toEqual(['B'])
  })

  it('завершается на циклических некорректных данных', () => {
    const result = analyzeCriticalPath([
      task('A', '2026-10-01', '2026-10-02'),
      task('B', '2026-10-03', '2026-10-04'),
    ], [dependency('A', 'B'), dependency('B', 'A')])

    expect(result.projectEndDate).toBe('2026-10-04')
    expect(Object.keys(result.slackDaysByTaskId)).toEqual(['A', 'B'])
  })
})
