import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { scheduleApi } from '../api/schedule.api'
import { TaskList } from '../components/workspace/TaskList'
import { Timeline } from '../components/workspace/Timeline'
import type { Dependency } from '../types/dependency'
import type { ProjectTask } from '../types/task'
import type { ProjectWorkspace } from '../types/workspace'
import type { ScheduleShiftPreview } from '../types/schedule'
import { buildCurrentProjectIssues, buildImpactAnalysis } from './scheduleEngine'
import { projectService } from './projectService'

vi.mock('../api/schedule.api', () => ({
  scheduleApi: { previewShift: vi.fn(), applyShift: vi.fn() },
}))

const tasks: ProjectTask[] = [
  { id: 'A', projectId: 'project', title: 'A', startDate: '2026-09-11', endDate: '2026-09-14', plannedStartDate: '2026-09-11', plannedEndDate: '2026-09-14', durationDays: 4, progress: 0, assigneeId: 'employee', status: 'in-progress', riskState: 'none', isCritical: false },
  { id: 'B', projectId: 'project', title: 'B', startDate: '2026-09-14', endDate: '2026-09-16', plannedStartDate: '2026-09-14', plannedEndDate: '2026-09-16', durationDays: 3, progress: 0, assigneeId: 'employee', status: 'not-started', riskState: 'none', isCritical: false },
]
const dependencies: Dependency[] = [{ id: 'a-b', projectId: 'project', predecessorTaskId: 'A', successorTaskId: 'B', type: 'finish-to-start' }]
const preview: ScheduleShiftPreview = {
  projectId: 'project', sourceTaskId: 'A', currentProjectEndDate: '2026-09-16', proposedProjectEndDate: '2026-09-17', projectEndShiftDays: 1,
  taskShifts: [{ taskId: 'B', currentStartDate: '2026-09-14', currentEndDate: '2026-09-16', proposedStartDate: '2026-09-15', proposedEndDate: '2026-09-17', shiftDays: 1 }],
}

function workspace(): ProjectWorkspace {
  const project = {
    id: 'project', creatorId: 'manager', name: 'Проект', description: '', startDate: '2026-09-11', targetEndDate: '2026-09-16',
    projectedEndDate: '2026-09-16', ownerName: 'Менеджер', health: 'at-risk' as const, progress: 0, taskCount: 2, completedTaskCount: 0,
  }
  return {
    project,
    tasks: tasks.map((task) => ({ ...task })),
    dependencies,
    assignees: [{ id: 'employee', projectId: 'project', name: 'Сотрудник' }],
    impact: buildImpactAnalysis(project, tasks, dependencies, 'A', ['B'], { kind: 'session-started' }, project.targetEndDate),
    currentIssues: buildCurrentProjectIssues(project, tasks, dependencies, '2026-09-12'),
    projectBoundaryIssues: [],
    recoveryScenarios: [],
  }
}

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('confirmed schedule shift workspace update', () => {
  it('updates Plan and Timeline immediately and removes the resolved conflict', async () => {
    vi.mocked(scheduleApi.applyShift).mockResolvedValue({ preview, projectEndDateChanged: false })
    const reload = vi.fn()
    vi.stubGlobal('location', { reload })
    const before = workspace()

    const updated = await projectService.applyScheduleShift(before, preview, false)

    expect(updated).not.toBe(before)
    expect(updated.tasks).not.toBe(before.tasks)
    expect(updated.tasks.find((task) => task.id === 'B')).toMatchObject({ startDate: '2026-09-15', endDate: '2026-09-17' })
    expect(before.tasks.find((task) => task.id === 'B')).toMatchObject({ startDate: '2026-09-14', endDate: '2026-09-16' })
    expect(updated.currentIssues.scheduleConflicts).toEqual([])
    expect(reload).not.toHaveBeenCalled()

    const plan = renderToStaticMarkup(<TaskList tasks={updated.tasks} dependencies={updated.dependencies} assignees={updated.assignees} affectedTaskIds={updated.impact.affectedTaskIds} criticalTaskIds={updated.impact.criticalTaskIds} slackDaysByTaskId={updated.impact.slackDaysByTaskId} projectedProjectEndDate={updated.impact.projectedProjectEndDate} currentIssues={updated.currentIssues} today="2026-09-12" onTaskSelect={() => undefined} onTaskCreate={() => undefined} />)
    const timeline = renderToStaticMarkup(<Timeline project={updated.project} tasks={updated.tasks} dependencies={updated.dependencies} assignees={updated.assignees} impact={updated.impact} today="2026-09-12" onTaskSelect={() => undefined} />)
    expect(plan).toContain('15 сент.')
    expect(plan).toContain('17 сент.')
    expect(timeline).toContain('data-task-start-date="2026-09-15"')
    expect(timeline).not.toContain('data-task-schedule-conflict="true"')
  })

  it('updates task dates without changing the project deadline when it is not confirmed', async () => {
    vi.mocked(scheduleApi.applyShift).mockResolvedValue({ preview, projectEndDateChanged: false })
    const updated = await projectService.applyScheduleShift(workspace(), preview, false)
    expect(updated.tasks.find((task) => task.id === 'B')?.endDate).toBe('2026-09-17')
    expect(updated.project.targetEndDate).toBe('2026-09-16')
    expect(updated.projectBoundaryIssues.some((issue) => issue.taskId === 'B')).toBe(true)
  })

  it('updates both task dates and the project deadline after explicit confirmation', async () => {
    vi.mocked(scheduleApi.applyShift).mockResolvedValue({ preview, projectEndDateChanged: true })
    const updated = await projectService.applyScheduleShift(workspace(), preview, true)
    expect(updated.tasks.find((task) => task.id === 'B')?.endDate).toBe('2026-09-17')
    expect(updated.project.targetEndDate).toBe('2026-09-17')
  })

  it('keeps local state unchanged when shift confirmation fails', async () => {
    vi.mocked(scheduleApi.applyShift).mockRejectedValue(new Error('Backend unavailable'))
    const before = workspace()
    const snapshot = structuredClone(before)
    await expect(projectService.applyScheduleShift(before, preview, false)).rejects.toThrow('Backend unavailable')
    expect(before).toEqual(snapshot)
  })
})
