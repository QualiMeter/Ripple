import { describe, expect, it, vi } from 'vitest'
import type { Dependency } from '../../types/dependency'
import type { ProjectTask } from '../../types/task'
import type { ProjectWorkspace } from '../../types/workspace'
import { buildCurrentProjectIssues, buildImpactAnalysis } from '../scheduleEngine'
import { buildScenarioImpact } from './scenarioImpact'
import { applyProjectScenario, buildProjectDeadlineScenario, buildTaskDelayScenario, buildTaskStartScenario } from './scenarioEngine'

const tasks: ProjectTask[] = [
  { id: 'a', projectId: 'project', title: 'Backend', startDate: '2026-10-01', endDate: '2026-10-05', plannedStartDate: '2026-10-01', plannedEndDate: '2026-10-05', durationDays: 5, progress: 0, assigneeId: 'e1', status: 'in-progress', riskState: 'none', isCritical: false },
  { id: 'b', projectId: 'project', title: 'Testing', startDate: '2026-10-06', endDate: '2026-10-08', plannedStartDate: '2026-10-06', plannedEndDate: '2026-10-08', durationDays: 3, progress: 0, assigneeId: 'e2', status: 'not-started', riskState: 'none', isCritical: false },
  { id: 'c', projectId: 'project', title: 'Release', startDate: '2026-10-09', endDate: '2026-10-10', plannedStartDate: '2026-10-09', plannedEndDate: '2026-10-10', durationDays: 2, progress: 0, assigneeId: 'e2', status: 'not-started', riskState: 'none', isCritical: false },
]
const dependencies: Dependency[] = [
  { id: 'ab', projectId: 'project', predecessorTaskId: 'a', successorTaskId: 'b', type: 'finish-to-start' },
  { id: 'bc', projectId: 'project', predecessorTaskId: 'b', successorTaskId: 'c', type: 'finish-to-start' },
]
const project = { id: 'project', creatorId: 'owner', name: 'Ripple', description: '', startDate: '2026-10-01', targetEndDate: '2026-10-10' }
const impact = buildImpactAnalysis(project, tasks, dependencies, '', [], { kind: 'session-started' })
const workspace: ProjectWorkspace = {
  project: { ...project, projectedEndDate: impact.projectedProjectEndDate, ownerName: 'Owner', health: 'on-track', progress: 0, taskCount: 3, completedTaskCount: 0 },
  tasks, dependencies, assignees: [{ id: 'e1', projectId: 'project', name: 'Сергей' }, { id: 'e2', projectId: 'project', name: 'Анна' }], impact,
  currentIssues: buildCurrentProjectIssues(project, tasks, dependencies, '2026-10-01'), projectBoundaryIssues: [], recoveryScenarios: [],
}

describe('project scenario draft', () => {
  it('extends only the source task without mutating the real workspace or moving downstream tasks', () => {
    const draft = buildTaskDelayScenario(workspace, 'a', 4)
    expect(workspace.tasks[0].endDate).toBe('2026-10-05')
    expect(draft.scenarioWorkspace.tasks.find((task) => task.id === 'a')?.endDate).toBe('2026-10-09')
    expect(draft.scenarioWorkspace.tasks.find((task) => task.id === 'b')).toMatchObject({ startDate: '2026-10-06', endDate: '2026-10-08' })
    expect(draft.scenarioWorkspace.currentIssues.scheduleConflicts.length).toBeGreaterThan(0)
    expect(draft.affectedTaskIds).toEqual(expect.arrayContaining(['a', 'b', 'c']))
  })

  it('recalculates projected end and scenario impact through the workspace engine', () => {
    const draft = buildTaskDelayScenario(workspace, 'c', 4)
    const comparison = buildScenarioImpact(workspace, draft)
    expect(comparison.currentProjectedEndDate).toBe('2026-10-10')
    expect(comparison.scenarioProjectedEndDate).toBe('2026-10-14')
    expect(comparison.projectEndDeltaDays).toBe(4)
  })

  it('shifts task start preserving inclusive calendar duration', () => {
    const draft = buildTaskStartScenario(workspace, 'b', '2026-10-10')
    expect(draft.scenarioWorkspace.tasks.find((task) => task.id === 'b')).toMatchObject({ startDate: '2026-10-10', endDate: '2026-10-12' })
    expect(workspace.tasks[1]).toMatchObject({ startDate: '2026-10-06', endDate: '2026-10-08' })
  })

  it('changes only project deadline in a deadline scenario', () => {
    const draft = buildProjectDeadlineScenario(workspace, '2026-10-07')
    expect(draft.scenarioWorkspace.project.targetEndDate).toBe('2026-10-07')
    expect(draft.scenarioWorkspace.tasks).toEqual(workspace.tasks)
    expect(draft.affectedTaskIds).toContain('c')
  })

  it('does not model automatic changes to completed tasks', () => {
    const completed = { ...workspace, tasks: workspace.tasks.map((task) => task.id === 'a' ? { ...task, status: 'completed' as const } : task) }
    expect(() => buildTaskDelayScenario(completed, 'a', 2)).toThrow('Завершённую задачу')
  })

  it('applies only the source task update', async () => {
    const draft = buildTaskDelayScenario(workspace, 'a', 4)
    const updateTask = vi.fn(async (current: ProjectWorkspace, taskId: string, update: { endDate?: string }) => ({ ...current, tasks: current.tasks.map((task) => task.id === taskId ? { ...task, ...update } : task) }))
    const updateProject = vi.fn()
    const result = await applyProjectScenario(workspace, draft, { updateTask, updateProject })
    expect(updateTask).toHaveBeenCalledWith(workspace, 'a', { endDate: '2026-10-09' })
    expect(updateProject).not.toHaveBeenCalled()
    expect(result.tasks.find((task) => task.id === 'b')?.startDate).toBe('2026-10-06')
  })

  it('applies a deadline with only the project update flow', async () => {
    const draft = buildProjectDeadlineScenario(workspace, '2026-10-07')
    const updateTask = vi.fn()
    const updateProject = vi.fn(async (current: ProjectWorkspace, update: { targetEndDate: string }) => ({ ...current, project: { ...current.project, ...update } }))
    await applyProjectScenario(workspace, draft, { updateTask, updateProject })
    expect(updateProject).toHaveBeenCalledWith(workspace, { targetEndDate: '2026-10-07' })
    expect(updateTask).not.toHaveBeenCalled()
  })

  it('keeps the draft and real workspace untouched when the REST port fails', async () => {
    const draft = buildTaskDelayScenario(workspace, 'a', 4)
    await expect(applyProjectScenario(workspace, draft, { updateTask: async () => { throw new Error('REST failed') }, updateProject: vi.fn() })).rejects.toThrow('REST failed')
    expect(workspace.tasks[0].endDate).toBe('2026-10-05')
    expect(draft.scenarioWorkspace.tasks[0].endDate).toBe('2026-10-09')
  })

  it('rejects applying a stale task scenario', async () => {
    const draft = buildTaskDelayScenario(workspace, 'a', 4)
    const changedWorkspace = { ...workspace, tasks: workspace.tasks.map((task) => task.id === 'a' ? { ...task, endDate: '2026-10-06' } : task) }
    await expect(applyProjectScenario(changedWorkspace, draft, { updateTask: vi.fn(), updateProject: vi.fn() })).rejects.toThrow('изменилась после создания сценария')
  })
})
