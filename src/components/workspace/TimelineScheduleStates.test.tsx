import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Dependency } from '../../types/dependency'
import type { ImpactAnalysis } from '../../types/impact'
import type { ProjectSummary } from '../../types/project'
import type { ProjectTask } from '../../types/task'
import { buildCurrentProjectIssues } from '../../services/scheduleEngine'
import { Timeline } from './Timeline'

const project: ProjectSummary = {
  id: 'project', creatorId: 'manager', name: 'Проект', description: '', startDate: '2026-09-11', targetEndDate: '2026-09-30',
  projectedEndDate: '2026-09-30', ownerName: 'Менеджер', health: 'on-track', progress: 0, taskCount: 2, completedTaskCount: 0,
}

function task(id: string, startDate: string, endDate: string): ProjectTask {
  return { id, projectId: project.id, title: id, startDate, endDate, plannedStartDate: startDate, plannedEndDate: endDate, durationDays: 4, progress: 0, assigneeId: 'employee', status: 'not-started', riskState: 'none', isCritical: false }
}

function impact(criticalTaskIds: string[] = []): ImpactAnalysis {
  return {
    sourceTaskId: '', lastChange: { kind: 'session-started' }, affectedTaskIds: [], criticalTaskIds,
    slackDaysByTaskId: Object.fromEntries(criticalTaskIds.map((id) => [id, 0])), atRiskTaskIds: [],
    previousProjectEndDate: project.targetEndDate, projectedProjectEndDate: project.targetEndDate,
    projectEndChangeDays: 0, deadlineShiftDays: 0, requiresIntervention: false, reasons: [], analyzedAt: '2026-09-11T00:00:00Z',
  }
}

function renderTimeline(tasks: ProjectTask[], dependencies: Dependency[] = [], criticalTaskIds: string[] = []) {
  return renderToStaticMarkup(<Timeline project={project} tasks={tasks} dependencies={dependencies} assignees={[]} impact={impact(criticalTaskIds)} currentIssues={buildCurrentProjectIssues(project, tasks, dependencies, '2026-09-11')} onTaskSelect={() => undefined} today="2026-09-11" />)
}

describe('Timeline schedule visual states', () => {
  it('uses a stronger border only for computed critical tasks', () => {
    const markup = renderTimeline([task('A', '2026-09-11', '2026-09-14'), task('B', '2026-09-15', '2026-09-17')], [], ['B'])
    expect(markup.match(/data-task-critical="true"/g)).toHaveLength(1)
    expect(markup).toContain('border-[3px] border-[#5548ba]')
  })

  it('places a four-day bar on the inclusive project calendar scale', () => {
    const markup = renderTimeline([task('A', '2026-09-11', '2026-09-14')])
    expect(markup).toContain('data-task-start-date="2026-09-11"')
    expect(markup).toContain('data-task-end-date="2026-09-14"')
    expect(markup).toContain('left:0%;width:20%')
    expect(markup).toContain('title="11.09.2026 — 14.09.2026"')
  })

  it('does not mark overlapping independent tasks as a dependency conflict', () => {
    const markup = renderTimeline([task('A', '2026-09-11', '2026-09-14'), task('B', '2026-09-14', '2026-09-17')])
    expect(markup).not.toContain('data-task-schedule-conflict="true"')
    expect(markup).not.toContain('Конфликт зависимости')
  })

  it('marks a same-day finish-to-start successor and explains its earliest valid date', () => {
    const tasks = [task('A', '2026-09-11', '2026-09-14'), task('B', '2026-09-14', '2026-09-17')]
    const dependencies = [{ id: 'a-b', projectId: project.id, predecessorTaskId: 'A', successorTaskId: 'B', type: 'finish-to-start' as const }]
    const markup = renderTimeline(tasks, dependencies)
    expect(markup).toContain('data-task-schedule-conflict="true"')
    expect(markup).toContain('Конфликт зависимости')
    expect(markup).toContain('Задача начинается 14.09.2026. После «A» она может начаться не раньше 15.09.2026.')
  })

  it('does not mark a successor that starts on the next calendar day', () => {
    const tasks = [task('A', '2026-09-11', '2026-09-14'), task('B', '2026-09-15', '2026-09-17')]
    const dependencies = [{ id: 'a-b', projectId: project.id, predecessorTaskId: 'A', successorTaskId: 'B', type: 'finish-to-start' as const }]
    const markup = renderTimeline(tasks, dependencies)
    expect(markup).not.toContain('data-task-schedule-conflict="true"')
    expect(markup).toContain('data-dependency-connector="true"')
    expect(markup).not.toContain('data-dependency-conflict="true"')
  })

  it('highlights the dependency connector when its dates conflict', () => {
    const tasks = [task('A', '2026-09-11', '2026-09-14'), task('B', '2026-09-14', '2026-09-17')]
    const dependencies = [{ id: 'a-b', projectId: project.id, predecessorTaskId: 'A', successorTaskId: 'B', type: 'finish-to-start' as const }]
    const markup = renderTimeline(tasks, dependencies)
    expect(markup).toContain('data-dependency-connector="true"')
    expect(markup).toContain('data-dependency-conflict="true"')
  })

  it('renders every dependency connector for branched schedules', () => {
    const tasks = [task('A', '2026-09-11', '2026-09-12'), task('B', '2026-09-13', '2026-09-14'), task('C', '2026-09-13', '2026-09-15')]
    const dependencies = [
      { id: 'a-b', projectId: project.id, predecessorTaskId: 'A', successorTaskId: 'B', type: 'finish-to-start' as const },
      { id: 'a-c', projectId: project.id, predecessorTaskId: 'A', successorTaskId: 'C', type: 'finish-to-start' as const },
    ]
    expect(renderTimeline(tasks, dependencies).match(/data-dependency-connector="true"/g)).toHaveLength(2)
  })

  it('preserves both critical and conflict visual states on the same task', () => {
    const tasks = [task('A', '2026-09-11', '2026-09-14'), task('B', '2026-09-14', '2026-09-17')]
    const dependencies = [{ id: 'a-b', projectId: project.id, predecessorTaskId: 'A', successorTaskId: 'B', type: 'finish-to-start' as const }]
    const markup = renderTimeline(tasks, dependencies, ['B'])
    expect(markup).toContain('data-task-critical="true"')
    expect(markup).toContain('data-task-schedule-conflict="true"')
    expect(markup).toContain('border-[3px] border-[#5548ba]')
    expect(markup).toContain('outline-amber-500')
  })
})
