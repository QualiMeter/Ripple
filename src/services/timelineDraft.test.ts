import { describe, expect, it } from 'vitest'
import type { ProjectWorkspace } from '../types/workspace'
import { buildCurrentProjectIssues, buildImpactAnalysis } from './scheduleEngine'
import { applyTimelineDraftPreview, buildTimelineDraftPreview } from './timelineDraft'

const tasks = [
  { id: 'a', projectId: 'project', title: 'Backend', startDate: '2026-10-01', endDate: '2026-10-05', plannedStartDate: '2026-10-01', plannedEndDate: '2026-10-05', durationDays: 5, progress: 0, assigneeId: 'e', status: 'in-progress' as const, riskState: 'none' as const, isCritical: false },
  { id: 'b', projectId: 'project', title: 'Frontend', startDate: '2026-10-06', endDate: '2026-10-08', plannedStartDate: '2026-10-06', plannedEndDate: '2026-10-08', durationDays: 3, progress: 0, assigneeId: 'e', status: 'not-started' as const, riskState: 'none' as const, isCritical: false },
  { id: 'c', projectId: 'project', title: 'Testing', startDate: '2026-10-09', endDate: '2026-10-11', plannedStartDate: '2026-10-09', plannedEndDate: '2026-10-11', durationDays: 3, progress: 0, assigneeId: 'e', status: 'not-started' as const, riskState: 'none' as const, isCritical: false },
]
const dependencies = [
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

describe('timeline draft preview', () => {
  it('includes the edited task, cascading downstream shifts and project end delta without mutating workspace', () => {
    const draft = buildTimelineDraftPreview(workspace, 'a', { endDate: '2026-10-07' })
    expect(draft.taskChanges.map((change) => change.taskId)).toEqual(['a', 'b', 'c'])
    expect(draft.taskChanges.find((change) => change.taskId === 'b')).toMatchObject({ proposedStartDate: '2026-10-08', proposedEndDate: '2026-10-10' })
    expect(draft.taskChanges.find((change) => change.taskId === 'c')).toMatchObject({ proposedStartDate: '2026-10-11', proposedEndDate: '2026-10-13' })
    expect(draft.projectEndDeltaDays).toBe(2)
    expect(workspace.tasks[0].endDate).toBe('2026-10-05')
  })

  it('updates the workspace only through the existing update and schedule flows after Apply', async () => {
    const draft = buildTimelineDraftPreview(workspace, 'a', { endDate: '2026-10-07' })
    const sourceWorkspace = { ...workspace, tasks: workspace.tasks.map((item) => item.id === 'a' ? { ...item, endDate: '2026-10-07' } : item) }
    const port = {
      updateTask: async () => sourceWorkspace,
      previewScheduleShift: async () => draft.schedulePreview,
      applyScheduleShift: async () => draft.workspace,
    }
    const result = await applyTimelineDraftPreview(workspace, draft, port)
    expect(result.workspace.tasks.find((item) => item.id === 'c')?.endDate).toBe('2026-10-13')
    expect(workspace.tasks.find((item) => item.id === 'a')?.endDate).toBe('2026-10-05')
    expect(result.appliedSchedulePreview).toBe(draft.schedulePreview)
  })
})
