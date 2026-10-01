import { describe, expect, it, vi } from 'vitest'
import type { Employee } from '../types/employee'
import type { ProjectTask } from '../types/task'
import type { ProjectWorkspace } from '../types/workspace'
import { buildCurrentProjectIssues, buildImpactAnalysis } from './scheduleEngine'
import { analyzeTeamWorkloadAttention } from './teamWorkload'
import { applyTaskReassignment, buildTaskReassignmentPreview } from './taskReassignment'

const employees: Employee[] = [
  { id: 'source', projectId: 'project', name: 'Смирнов' },
  { id: 'candidate', projectId: 'project', name: 'Петров' },
]

function task(id: string, assigneeId: string): ProjectTask {
  return {
    id, projectId: 'project', title: id === 'move' ? 'Frontend' : id,
    startDate: '2026-10-01', endDate: '2026-10-10', plannedStartDate: '2026-10-01', plannedEndDate: '2026-10-10',
    durationDays: 10, progress: 0, assigneeId, status: 'in-progress', riskState: 'none', isCritical: false,
  }
}

function createWorkspace(): ProjectWorkspace {
  const tasks = [task('move', 'source'), task('second', 'source'), task('third', 'source')]
  const project = { id: 'project', creatorId: 'owner', name: 'Проект', description: '', startDate: '2026-10-01', targetEndDate: '2026-10-31' }
  const impact = buildImpactAnalysis(project, tasks, [], '', [], { kind: 'session-started' })
  return {
    project: { ...project, ownerName: 'Менеджер', health: 'on-track', progress: 0, taskCount: tasks.length, completedTaskCount: 0, projectedEndDate: impact.projectedProjectEndDate },
    tasks, dependencies: [], assignees: employees, impact,
    currentIssues: buildCurrentProjectIssues(project, tasks, [], '2026-10-01'), projectBoundaryIssues: [], recoveryScenarios: [],
  }
}

describe('task reassignment preview', () => {
  it('builds concrete before/after workload without mutating workspace', () => {
    const workspace = createWorkspace()
    const snapshot = structuredClone(workspace)
    const suggestion = analyzeTeamWorkloadAttention(workspace.assignees, workspace.tasks).reassignment!

    const preview = buildTaskReassignmentPreview(workspace, suggestion)!

    expect(preview).toMatchObject({
      taskTitle: 'Frontend', sourceEmployeeName: 'Смирнов', candidateEmployeeName: 'Петров',
      sourceBefore: { peakConcurrency: 3 }, sourceAfter: { peakConcurrency: 2 },
      candidateBefore: { peakConcurrency: 0 }, candidateAfter: { peakConcurrency: 1 },
    })
    expect(workspace).toEqual(snapshot)
  })

  it('confirms through updateTask with assigneeId only', async () => {
    const workspace = createWorkspace()
    const suggestion = analyzeTeamWorkloadAttention(workspace.assignees, workspace.tasks).reassignment!
    const preview = buildTaskReassignmentPreview(workspace, suggestion)!
    const updateTask = vi.fn(async (current: ProjectWorkspace, taskId: string, update: { assigneeId?: string }) => ({
      ...current,
      tasks: current.tasks.map((item) => item.id === taskId ? { ...item, ...update } : item),
    }))

    const result = await applyTaskReassignment(workspace, preview, { updateTask })

    expect(updateTask).toHaveBeenCalledWith(workspace, preview.taskId, { assigneeId: preview.candidateEmployeeId })
    expect(result.tasks.find((item) => item.id === preview.taskId)).toMatchObject({
      assigneeId: preview.candidateEmployeeId,
      startDate: '2026-10-01', endDate: '2026-10-10', status: 'in-progress',
    })
  })

  it('keeps the original workspace unchanged when update fails', async () => {
    const workspace = createWorkspace()
    const snapshot = structuredClone(workspace)
    const suggestion = analyzeTeamWorkloadAttention(workspace.assignees, workspace.tasks).reassignment!
    const preview = buildTaskReassignmentPreview(workspace, suggestion)!

    await expect(applyTaskReassignment(workspace, preview, { updateTask: vi.fn().mockRejectedValue(new Error('Backend failed')) })).rejects.toThrow('Backend failed')
    expect(workspace).toEqual(snapshot)
  })
})
