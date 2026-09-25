import { describe, expect, it } from 'vitest'
import type { Dependency } from '../types/dependency'
import type { Project } from '../types/project'
import type { ProjectTask } from '../types/task'
import { buildRecoveryScenarios } from './recoveryEngine'
import { buildImpactAnalysis, differenceInDays, recalculateSchedule } from './scheduleEngine'

function task(id: string, startDate: string, endDate: string): ProjectTask {
  return {
    id,
    projectId: 'test-project',
    title: id,
    startDate,
    endDate,
    plannedStartDate: startDate,
    plannedEndDate: endDate,
    durationDays: 1,
    progress: 0,
    assigneeId: 'owner',
    status: 'not-started',
    riskState: 'none',
    isCritical: id !== 'independent',
  }
}

const baselineTasks = [
  task('source', '2026-01-05', '2026-01-07'),
  task('frontend', '2026-01-08', '2026-01-09'),
  task('qa', '2026-01-12', '2026-01-13'),
  task('release', '2026-01-14', '2026-01-14'),
  task('independent', '2026-01-06', '2026-01-08'),
]

const dependencies: Dependency[] = [
  { id: 'd1', projectId: 'test-project', predecessorTaskId: 'source', successorTaskId: 'frontend', type: 'finish-to-start' },
  { id: 'd2', projectId: 'test-project', predecessorTaskId: 'frontend', successorTaskId: 'qa', type: 'finish-to-start' },
  { id: 'd3', projectId: 'test-project', predecessorTaskId: 'qa', successorTaskId: 'release', type: 'finish-to-start' },
]

const project: Project = {
  id: 'test-project',
  name: 'Тестовый проект',
  description: '',
  startDate: '2026-01-05',
  targetEndDate: '2026-01-14',
  projectedEndDate: '2026-01-14',
  ownerName: 'Тест',
  health: 'on-track',
}

describe('recalculateSchedule', () => {
  it('сдвигает всю downstream-цепочку при увеличении срока source task', () => {
    const result = recalculateSchedule(
      baselineTasks,
      dependencies,
      { source: { endDate: '2026-01-09' } },
      'source',
      baselineTasks,
    )

    expect(result.affectedTaskIds).toEqual(['frontend', 'qa', 'release'])
    expect(result.tasks.find((item) => item.id === 'frontend')).toMatchObject({ startDate: '2026-01-12', endDate: '2026-01-13' })
    expect(result.tasks.find((item) => item.id === 'qa')).toMatchObject({ startDate: '2026-01-14', endDate: '2026-01-15' })
    expect(result.tasks.find((item) => item.id === 'release')).toMatchObject({ startDate: '2026-01-16', endDate: '2026-01-16' })
  })

  it('восстанавливает downstream-цепочку после последующего сокращения срока', () => {
    const delayed = recalculateSchedule(baselineTasks, dependencies, { source: { endDate: '2026-01-09' } }, 'source', baselineTasks)
    const restored = recalculateSchedule(baselineTasks, dependencies, { source: { endDate: '2026-01-07' } }, 'source', delayed.tasks)
    const delayedImpact = buildImpactAnalysis(project, delayed.tasks, dependencies, 'source', delayed.affectedTaskIds)
    const restoredImpact = buildImpactAnalysis(project, restored.tasks, dependencies, 'source', restored.affectedTaskIds)

    expect(restored.affectedTaskIds).toEqual(['frontend', 'qa', 'release'])
    expect(restored.tasks.map(({ id, startDate, endDate }) => ({ id, startDate, endDate }))).toEqual(
      baselineTasks.map(({ id, startDate, endDate }) => ({ id, startDate, endDate })),
    )
    expect(delayedImpact).toMatchObject({ projectedProjectEndDate: '2026-01-16', deadlineShiftDays: 2, requiresIntervention: true })
    expect(restoredImpact).toMatchObject({ projectedProjectEndDate: '2026-01-14', deadlineShiftDays: 0, requiresIntervention: false })
    expect(buildRecoveryScenarios(delayedImpact).every((scenario) => (
      differenceInDays(delayedImpact.projectedProjectEndDate, scenario.expectedProjectEndDate) === scenario.recoveredDays
    ))).toBe(true)
    expect(buildRecoveryScenarios(restoredImpact)).toEqual([])
  })

  it('снимает риск после устранения задержки', () => {
    const delayed = recalculateSchedule(baselineTasks, dependencies, { source: { endDate: '2026-01-09' } }, 'source', baselineTasks)
    expect(delayed.tasks.filter((item) => item.id !== 'independent').every((item) => item.riskState === 'at-risk')).toBe(true)

    const restored = recalculateSchedule(baselineTasks, dependencies, { source: { endDate: '2026-01-07' } }, 'source', delayed.tasks)
    expect(restored.tasks.every((item) => item.riskState === 'none')).toBe(true)
  })

  it('не сдвигает независимые задачи', () => {
    const result = recalculateSchedule(baselineTasks, dependencies, { source: { endDate: '2026-01-09' } }, 'source', baselineTasks)
    const independent = result.tasks.find((item) => item.id === 'independent')

    expect(independent).toMatchObject({ startDate: '2026-01-06', endDate: '2026-01-08', riskState: 'none' })
    expect(result.affectedTaskIds).not.toContain('independent')
  })
})
