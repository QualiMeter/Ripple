import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Dependency } from '../../types/dependency'
import type { ImpactAnalysis } from '../../types/impact'
import type { ProjectSummary } from '../../types/project'
import type { ProjectTask, TaskStatus } from '../../types/task'
import { TaskList } from './TaskList'
import { Timeline } from './Timeline'

function task(status: TaskStatus): ProjectTask {
  return {
    id: 'task', projectId: 'project', title: 'Backend', startDate: '2026-09-01', endDate: '2026-09-15',
    plannedStartDate: '2026-09-01', plannedEndDate: '2026-09-15', durationDays: 15, progress: 0,
    assigneeId: 'employee', status, riskState: 'none', isCritical: false,
  }
}

const dependencies: Dependency[] = [
  { id: 'one', projectId: 'project', predecessorTaskId: 'task', successorTaskId: 'next', type: 'finish-to-start' },
  { id: 'two', projectId: 'project', predecessorTaskId: 'next', successorTaskId: 'release', type: 'finish-to-start' },
]
const project: ProjectSummary = {
  id: 'project', creatorId: 'manager', name: 'Проект', description: '', startDate: '2026-09-01', targetEndDate: '2026-10-01',
  projectedEndDate: '2026-10-01', ownerName: 'Менеджер', health: 'at-risk', progress: 0, taskCount: 1, completedTaskCount: 0,
}
const impact: ImpactAnalysis = {
  sourceTaskId: '', lastChange: { kind: 'session-started' }, affectedTaskIds: [], criticalTaskIds: [], slackDaysByTaskId: {}, atRiskTaskIds: [],
  previousProjectEndDate: '2026-10-01', projectedProjectEndDate: '2026-10-01', projectEndChangeDays: 0, deadlineShiftDays: 0,
  requiresIntervention: true, reasons: [], analyzedAt: '2026-09-27T00:00:00.000Z',
}
const assignees = [{ id: 'employee', projectId: 'project', name: 'Иван Иванов' }]
const currentIssues = { scheduleConflicts: [], statusConflicts: [], deadlineIssues: [], affectedTaskIds: [] }

function renderList(status: TaskStatus, today = '2026-09-27') {
  return renderToStaticMarkup(<TaskList tasks={[task(status)]} dependencies={dependencies} assignees={assignees} affectedTaskIds={[]} criticalTaskIds={['task']} slackDaysByTaskId={{ task: 0 }} projectedProjectEndDate={project.projectedEndDate} currentIssues={currentIssues} onTaskSelect={() => undefined} onTaskCreate={() => undefined} today={today} />)
}

describe('task overdue presentation', () => {
  it('shows in-progress status and overdue badge as separate facts', () => {
    const markup = renderList('in-progress')
    expect(markup).toContain('В работе')
    expect(markup).toContain('Просрочено · 12 дн.')
  })

  it('uses the singular day form for a one-day delay', () => {
    expect(renderList('not-started', '2026-09-16')).toContain('Просрочено · 1 день')
  })

  it('shows delayed status and overdue badge at the same time', () => {
    const markup = renderList('delayed')
    expect(markup).toContain('Задерживается')
    expect(markup).toContain('Просрочено · 12 дн.')
  })

  it('includes the deadline, calendar-day delay and downstream count in the tooltip', () => {
    const markup = renderList('in-progress')
    expect(markup).toContain('Задача должна была завершиться 15.09.2026.')
    expect(markup).toContain('Просрочка: 12 календарных дней.')
    expect(markup).toContain('Может повлиять на последующие задачи: 2.')
  })

  it('does not show current overdue for completed work', () => {
    expect(renderList('completed')).not.toContain('Просрочено')
  })

  it('adds an overdue marker without replacing the timeline visual state', () => {
    const markup = renderToStaticMarkup(<Timeline project={project} tasks={[task('in-progress')]} dependencies={dependencies} assignees={assignees} impact={impact} onTaskSelect={() => undefined} today="2026-09-27" />)
    expect(markup).toContain('Просрочено')
    expect(markup).toContain('data-task-visual-state="in-progress"')
    expect(markup).toContain('ring-rose-500')
  })
})
