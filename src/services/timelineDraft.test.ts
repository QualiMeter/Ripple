import { describe, expect, it } from 'vitest'
import type { Dependency } from '../types/dependency'
import type { ProjectTask } from '../types/task'
import type { ProjectWorkspace } from '../types/workspace'
import { buildCurrentProjectIssues, buildImpactAnalysis } from './scheduleEngine'
import { applyTimelineDraftPreview, buildTimelineDraftPreview } from './timelineDraft'

const tasks: ProjectTask[] = [
  { id: 'a', projectId: 'project', title: 'Backend', startDate: '2026-10-01', endDate: '2026-10-05', plannedStartDate: '2026-10-01', plannedEndDate: '2026-10-05', durationDays: 5, progress: 0, assigneeId: 'e', status: 'in-progress' as const, riskState: 'none' as const, isCritical: false },
  { id: 'b', projectId: 'project', title: 'Frontend', startDate: '2026-10-06', endDate: '2026-10-08', plannedStartDate: '2026-10-06', plannedEndDate: '2026-10-08', durationDays: 3, progress: 0, assigneeId: 'e', status: 'not-started' as const, riskState: 'none' as const, isCritical: false },
  { id: 'c', projectId: 'project', title: 'Testing', startDate: '2026-10-09', endDate: '2026-10-11', plannedStartDate: '2026-10-09', plannedEndDate: '2026-10-11', durationDays: 3, progress: 0, assigneeId: 'e', status: 'not-started' as const, riskState: 'none' as const, isCritical: false },
]
const dependencies: Dependency[] = [
  { id: 'a-b', projectId: 'project', predecessorTaskId: 'a', successorTaskId: 'b', type: 'finish-to-start' as const },
  { id: 'b-c', projectId: 'project', predecessorTaskId: 'b', successorTaskId: 'c', type: 'finish-to-start' as const },
]
const project = { id: 'project', creatorId: 'manager', name: 'Проект', description: '', startDate: '2026-10-01', targetEndDate: '2026-10-11' }
const impact = buildImpactAnalysis(project, tasks, dependencies, '', [], { kind: 'session-started' })
const workspace: ProjectWorkspace = {
  project: { ...project, projectedEndDate: impact.projectedProjectEndDate, ownerName: 'Менеджер', health: 'on-track', progress: 0, taskCount: 3, completedTaskCount: 0 },
  tasks, dependencies, assignees: [{ id: 'e', projectId: 'project', name: 'Иван' }], impact,
  currentIssues: buildCurrentProjectIssues(project, tasks, dependencies, '2026-10-01'), projectBoundaryIssues: [], recoveryScenarios: [],
}

function makeWorkspace(nextTasks: ProjectTask[], nextDependencies: Dependency[]): ProjectWorkspace {
  const nextImpact = buildImpactAnalysis(project, nextTasks, nextDependencies, '', [], { kind: 'session-started' })
  return {
    ...workspace,
    project: { ...workspace.project, projectedEndDate: nextImpact.projectedProjectEndDate, taskCount: nextTasks.length, completedTaskCount: nextTasks.filter((task) => task.status === 'completed').length },
    tasks: nextTasks,
    dependencies: nextDependencies,
    impact: nextImpact,
    currentIssues: buildCurrentProjectIssues(project, nextTasks, nextDependencies, '2026-10-01'),
  }
}

describe('timeline draft preview', () => {
  it('keeps only the explicit user dates in Gantt and calculates cascade separately', () => {
    const draft = buildTimelineDraftPreview(workspace, 'a', { endDate: '2026-10-07' })
    expect(draft.userTaskChanges.map((change) => change.taskId)).toEqual(['a'])
    expect(draft.userDraftWorkspace.tasks.find((task) => task.id === 'a')).toMatchObject({ endDate: '2026-10-07' })
    expect(draft.userDraftWorkspace.tasks.find((task) => task.id === 'b')).toMatchObject({ startDate: '2026-10-06', endDate: '2026-10-08' })
    expect(draft.userDraftWorkspace.tasks.find((task) => task.id === 'c')).toMatchObject({ startDate: '2026-10-09', endDate: '2026-10-11' })
    expect(draft.userDraftWorkspace.currentIssues.scheduleConflicts).toHaveLength(1)
    expect(draft.recommendedTaskChanges.find((change) => change.taskId === 'b')).toMatchObject({ proposedStartDate: '2026-10-08', proposedEndDate: '2026-10-10' })
    expect(draft.recommendedTaskChanges.find((change) => change.taskId === 'c')).toMatchObject({ proposedStartDate: '2026-10-11', proposedEndDate: '2026-10-13' })
    expect(draft.recommendedProjectEndDeltaDays).toBe(2)
    expect(workspace.tasks[0].endDate).toBe('2026-10-05')
  })

  it('applies only the source task when user chooses as-is', async () => {
    const draft = buildTimelineDraftPreview(workspace, 'a', { endDate: '2026-10-07' })
    const sourceWorkspace = { ...workspace, tasks: workspace.tasks.map((item) => item.id === 'a' ? { ...item, endDate: '2026-10-07' } : item) }
    const port = {
      updateTask: async () => sourceWorkspace,
      previewScheduleShift: async () => { throw new Error('not called') },
      applyScheduleShift: async () => { throw new Error('not called') },
    }
    const result = await applyTimelineDraftPreview(workspace, draft, port, 'as-is')
    expect(result.workspace.tasks.find((item) => item.id === 'a')?.endDate).toBe('2026-10-07')
    expect(result.workspace.tasks.find((item) => item.id === 'b')?.startDate).toBe('2026-10-06')
    expect(result.appliedSchedulePreview).toBeNull()
    expect(workspace.tasks.find((item) => item.id === 'a')?.endDate).toBe('2026-10-05')
  })

  it('applies the recommended source correction and downstream cascade through existing flows', async () => {
    const draft = buildTimelineDraftPreview(workspace, 'a', { endDate: '2026-10-07' })
    const correctedSourceWorkspace = makeWorkspace(workspace.tasks.map((item) => item.id === 'a' ? { ...item, endDate: '2026-10-07' } : item), dependencies)
    let receivedUpdate = {}
    const port = {
      updateTask: async (_workspace: ProjectWorkspace, _taskId: string, update: object) => { receivedUpdate = update; return correctedSourceWorkspace },
      previewScheduleShift: async () => draft.recommendedSchedulePreview,
      applyScheduleShift: async () => draft.recommendedWorkspace,
    }
    const result = await applyTimelineDraftPreview(workspace, draft, port, 'with-dependency-fix')
    expect(receivedUpdate).toMatchObject({ endDate: '2026-10-07' })
    expect(result.workspace.tasks.find((item) => item.id === 'c')).toMatchObject({ startDate: '2026-10-11', endDate: '2026-10-13' })
    expect(result.appliedSchedulePreview).toBe(draft.recommendedSchedulePreview)
  })

  it('does not present an unchanged existing conflict as a draft consequence', () => {
    const conflictedTasks = [
      tasks[0],
      { ...tasks[1], startDate: '2026-10-05', endDate: '2026-10-07' },
      { ...tasks[2], id: 'unrelated', title: 'Документация', startDate: '2026-10-02', endDate: '2026-10-03' },
    ]
    const draft = buildTimelineDraftPreview(makeWorkspace(conflictedTasks, [dependencies[0]]), 'unrelated', { endDate: '2026-10-04' })

    expect(draft.existingConflicts).toHaveLength(1)
    expect(draft.draftConflicts).toEqual([])
    expect(draft.remainingConflicts).toEqual([])
  })

  it('shows a dependency conflict created by moving the successor earlier', () => {
    const draft = buildTimelineDraftPreview(workspace, 'b', { startDate: '2026-10-05', endDate: '2026-10-07' })

    expect(draft.draftConflicts).toEqual([expect.objectContaining({
      predecessorTaskId: 'a', successorTaskId: 'b', successorStartDate: '2026-10-05', earliestStartDate: '2026-10-06',
    })])
    expect(draft.remainingConflicts).toHaveLength(1)
    expect(draft.userDraftWorkspace.tasks.find((task) => task.id === 'b')).toMatchObject({ startDate: '2026-10-05', endDate: '2026-10-07' })
    expect(draft.recommendedTaskChanges.find((change) => change.taskId === 'b')).toMatchObject({ proposedStartDate: '2026-10-06', proposedEndDate: '2026-10-08' })
  })

  it('tracks a conflict resolved by the draft without showing it as remaining', () => {
    const conflictedTasks = [tasks[0], { ...tasks[1], startDate: '2026-10-05', endDate: '2026-10-07' }, tasks[2]]
    const draft = buildTimelineDraftPreview(makeWorkspace(conflictedTasks, dependencies), 'b', { startDate: '2026-10-06', endDate: '2026-10-08' })

    expect(draft.resolvedConflicts).toEqual([expect.objectContaining({ predecessorTaskId: 'a', successorTaskId: 'b' })])
    expect(draft.draftConflicts).toEqual([])
    expect(draft.remainingConflicts).toEqual([])
  })

  it('describes a moved successor after a completed predecessor as a normal conflict', () => {
    const completedPredecessorTasks = [{ ...tasks[0], status: 'completed' as const }, tasks[1], tasks[2]]
    const draft = buildTimelineDraftPreview(makeWorkspace(completedPredecessorTasks, dependencies), 'b', { startDate: '2026-10-05', endDate: '2026-10-07' })

    expect(draft.draftConflicts).toEqual([expect.objectContaining({ predecessorTaskId: 'a', successorTaskId: 'b' })])
    expect(draft.completedManualTaskIds).toEqual([])
  })

  it('requires manual resolution only when a completed downstream successor would need a shift', () => {
    const completedSuccessorTasks = [tasks[0], { ...tasks[1], status: 'completed' as const }, tasks[2]]
    const draft = buildTimelineDraftPreview(makeWorkspace(completedSuccessorTasks, dependencies), 'a', { endDate: '2026-10-06' })

    expect(draft.draftConflicts).toEqual([expect.objectContaining({ predecessorTaskId: 'a', successorTaskId: 'b' })])
    expect(draft.completedManualTaskIds).toEqual(['b'])
    expect(draft.recommendedWorkspace.tasks.find((task) => task.id === 'b')).toMatchObject({ startDate: '2026-10-06', endDate: '2026-10-08', status: 'completed' })
  })

  it('does not include an unrelated existing completed conflict in manual resolution', () => {
    const extendedTasks = [
      ...tasks,
      { ...tasks[0], id: 'x', title: 'Архитектура', startDate: '2026-09-01', endDate: '2026-09-06', status: 'completed' as const },
      { ...tasks[1], id: 'y', title: 'Старый completed conflict', startDate: '2026-09-06', endDate: '2026-09-08', status: 'completed' as const },
    ]
    const extendedDependencies = [...dependencies, { id: 'x-y', projectId: 'project', predecessorTaskId: 'x', successorTaskId: 'y', type: 'finish-to-start' as const }]
    const draft = buildTimelineDraftPreview(makeWorkspace(extendedTasks, extendedDependencies), 'a', { endDate: '2026-10-07' })

    expect(draft.existingConflicts).toEqual([expect.objectContaining({ predecessorTaskId: 'x', successorTaskId: 'y' })])
    expect(draft.completedManualTaskIds).not.toContain('y')
  })
})
