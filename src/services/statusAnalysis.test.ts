import { describe, expect, it } from 'vitest'
import type { Dependency } from '../types/dependency'
import type { LastChange } from '../types/impact'
import type { ProjectTask, TaskStatus } from '../types/task'
import { analyzeStatusChange } from './statusAnalysis'

function task(id: string, status: TaskStatus, plannedStartDate = '2026-01-10'): ProjectTask {
  return {
    id,
    projectId: 'project',
    title: id,
    startDate: plannedStartDate,
    endDate: '2026-01-20',
    plannedStartDate,
    plannedEndDate: '2026-01-20',
    durationDays: 11,
    progress: status === 'completed' ? 100 : 0,
    assigneeId: 'owner',
    status,
    riskState: 'none',
    isCritical: false,
  }
}

function dependency(id: string, predecessorTaskId: string, successorTaskId: string): Dependency {
  return { id, projectId: 'project', predecessorTaskId, successorTaskId, type: 'finish-to-start' }
}

function statusChange(taskId: string, previousValue: TaskStatus, nextValue: TaskStatus): LastChange {
  return {
    kind: 'task-updated',
    taskId,
    taskTitle: taskId,
    changes: [{ field: 'status', previousValue, nextValue }],
  }
}

describe('analyzeStatusChange', () => {
  it('после завершения сообщает о готовности successors с учётом плановой даты', () => {
    const tasks = [
      task('source', 'completed'),
      task('ready-now', 'not-started', '2026-01-10'),
      task('ready-later', 'not-started', '2026-02-10'),
    ]
    const findings = analyzeStatusChange(tasks, [
      dependency('d1', 'source', 'ready-now'),
      dependency('d2', 'source', 'ready-later'),
    ], statusChange('source', 'in-progress', 'completed'), '2026-01-15')

    expect(findings).toHaveLength(2)
    expect(findings.every((finding) => finding.severity === 'info')).toBe(true)
    expect(findings.find((finding) => finding.affectedTaskIds.includes('ready-now'))?.consequence).toContain('можно запускать')
    expect(findings.find((finding) => finding.affectedTaskIds.includes('ready-later'))?.consequence).toContain('ещё не наступила')
  })

  it('после завершения не предлагает старт, пока другой predecessor не закончен', () => {
    const tasks = [task('source', 'completed'), task('other', 'in-progress'), task('successor', 'not-started')]
    const findings = analyzeStatusChange(tasks, [
      dependency('d1', 'source', 'successor'),
      dependency('d2', 'other', 'successor'),
    ], statusChange('source', 'in-progress', 'completed'), '2026-01-15')

    expect(findings).toEqual([])
  })

  it('при delayed отдельно предупреждает not-started и in-progress successors', () => {
    const tasks = [task('source', 'delayed'), task('planned', 'not-started'), task('active', 'in-progress')]
    const snapshot = structuredClone(tasks)
    const findings = analyzeStatusChange(tasks, [
      dependency('d1', 'source', 'planned'),
      dependency('d2', 'source', 'active'),
    ], statusChange('source', 'in-progress', 'delayed'))

    expect(findings).toHaveLength(2)
    expect(findings.find((finding) => finding.affectedTaskIds.includes('planned'))?.consequence).toContain('дата начала')
    expect(findings.find((finding) => finding.affectedTaskIds.includes('active'))?.consequence).toContain('не остановлена автоматически')
    expect(tasks).toEqual(snapshot)
  })

  it('при переходе в in-progress предупреждает о незавершённых predecessors', () => {
    const tasks = [task('unfinished', 'delayed'), task('done', 'completed'), task('source', 'in-progress')]
    const findings = analyzeStatusChange(tasks, [
      dependency('d1', 'unfinished', 'source'),
      dependency('d2', 'done', 'source'),
    ], statusChange('source', 'not-started', 'in-progress'))

    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ severity: 'warning', sourceTaskId: 'source', affectedTaskIds: ['unfinished'] })
  })

  it('при возврате из completed предупреждает непосредственные последующие задачи', () => {
    const tasks = [task('source', 'in-progress'), task('successor', 'in-progress')]
    const findings = analyzeStatusChange(
      tasks,
      [dependency('d1', 'source', 'successor')],
      statusChange('source', 'completed', 'in-progress'),
    )

    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ severity: 'warning', affectedTaskIds: ['successor'] })
    expect(findings[0].reason).toContain('Ранее законченная')
  })
})
