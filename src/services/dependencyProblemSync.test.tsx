import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ImpactPanel } from '../components/workspace/ImpactPanel'
import { Timeline } from '../components/workspace/Timeline'
import type { Dependency } from '../types/dependency'
import type { Project } from '../types/project'
import type { ProjectTask } from '../types/task'
import type { ProjectWorkspace } from '../types/workspace'
import { buildImpactAnalysis, buildCurrentProjectIssues } from './scheduleEngine'
import { findDependencyDateConflicts } from './scheduleRules'
import { buildTaskPlanRows } from './taskPlan'

const project: Project = {
  id: 'project', creatorId: 'manager', name: 'Проект', description: '', startDate: '2026-10-01', targetEndDate: '2026-10-20',
}
const dependency: Dependency = { id: 'a-b', projectId: project.id, predecessorTaskId: 'A', successorTaskId: 'B', type: 'finish-to-start' }

function task(id: string, startDate: string, endDate: string): ProjectTask {
  return {
    id, projectId: project.id, title: id, startDate, endDate, plannedStartDate: startDate, plannedEndDate: endDate,
    durationDays: 5, progress: 0, assigneeId: 'employee', status: id === 'A' ? 'in-progress' : 'not-started', riskState: 'none', isCritical: false,
  }
}

function workspace(tasks: ProjectTask[]): ProjectWorkspace {
  const dependencies = [dependency]
  const currentIssues = buildCurrentProjectIssues(project, tasks, dependencies, '2026-09-28')
  const impact = buildImpactAnalysis(project, tasks, dependencies, 'A', ['B'], { kind: 'session-started' }, project.targetEndDate)
  const completedTaskCount = 0
  return {
    project: { ...project, projectedEndDate: impact.projectedProjectEndDate, ownerName: 'Менеджер', health: currentIssues.scheduleConflicts.length ? 'at-risk' : 'on-track', progress: 0, taskCount: tasks.length, completedTaskCount },
    tasks, dependencies, assignees: [{ id: 'employee', projectId: project.id, name: 'Сотрудник' }],
    impact, currentIssues, projectBoundaryIssues: [], recoveryScenarios: [],
  }
}

function renderConflictSurfaces(value: ProjectWorkspace) {
  const impact = renderToStaticMarkup(<ImpactPanel workspace={value} onPreviewScheduleShift={async () => { throw new Error('not called') }} onApplyScheduleShift={async () => undefined} onTaskSelect={() => undefined} />)
  const timeline = renderToStaticMarkup(<Timeline project={value.project} tasks={value.tasks} dependencies={value.dependencies} assignees={value.assignees} impact={value.impact} currentIssues={value.currentIssues} onTaskSelect={() => undefined} today="2026-09-28" />)
  const rows = buildTaskPlanRows({ tasks: value.tasks, dependencies: value.dependencies, criticalTaskIds: value.impact.criticalTaskIds, slackDaysByTaskId: value.impact.slackDaysByTaskId, currentIssues: value.currentIssues, today: '2026-09-28' })
  return { impact, timeline, rows }
}

describe('dependency problem synchronization', () => {
  it('uses the same D+1 conflict in analysis, Problems, Plan and Timeline', () => {
    const tasks = [task('A', '2026-10-01', '2026-10-08'), task('B', '2026-10-01', '2026-10-05')]
    const value = workspace(tasks)
    const conflict = findDependencyDateConflicts(tasks, [dependency])
    const surfaces = renderConflictSurfaces(value)

    expect(conflict).toHaveLength(1)
    expect(conflict[0].requiredStartDate).toBe('2026-10-09')
    expect(value.currentIssues.scheduleConflicts).toHaveLength(1)
    expect(value.impact.reasons).toHaveLength(1)
    expect(surfaces.impact.match(/Задача начинается раньше допустимой даты\./g)).toHaveLength(2)
    expect(surfaces.impact).toContain('Можно начать не раньше: 09.10.2026')
    expect(surfaces.rows.find((row) => row.task.id === 'B')?.hasScheduleConflict).toBe(true)
    expect(surfaces.timeline).toContain('data-task-schedule-conflict="true"')
    expect(surfaces.timeline).toContain('не раньше 09.10.2026')
  })

  it('removes every conflict presentation after shift reload and restores it after Undo reload', () => {
    const shifted = renderConflictSurfaces(workspace([task('A', '2026-10-01', '2026-10-08'), task('B', '2026-10-09', '2026-10-13')]))
    expect(shifted.impact).toContain('Текущих проблем не обнаружено.')
    expect(shifted.rows.find((row) => row.task.id === 'B')?.hasScheduleConflict).toBe(false)
    expect(shifted.timeline).not.toContain('data-task-schedule-conflict="true"')

    const restored = renderConflictSurfaces(workspace([task('A', '2026-10-01', '2026-10-08'), task('B', '2026-10-01', '2026-10-05')]))
    expect(restored.impact).toContain('Задача начинается раньше допустимой даты.')
    expect(restored.rows.find((row) => row.task.id === 'B')?.hasScheduleConflict).toBe(true)
    expect(restored.timeline).toContain('data-task-schedule-conflict="true"')
  })
})
