import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { ImpactAnalysis } from '../../types/impact'
import type { ProjectSummary } from '../../types/project'
import type { ProjectTask } from '../../types/task'
import { TaskList } from './TaskList'
import { Timeline } from './Timeline'

const task: ProjectTask = {
  id: 'task-1', projectId: 'project-1', title: 'Интеграция',
  startDate: '2026-06-02', endDate: '2026-06-05', plannedStartDate: '2026-06-02', plannedEndDate: '2026-06-05',
  durationDays: 4, progress: 62, assigneeId: 'employee-1', status: 'in-progress', riskState: 'none', isCritical: false,
}
const project: ProjectSummary = {
  id: 'project-1', creatorId: 'manager', name: 'Проект', description: '', startDate: '2026-06-01', targetEndDate: '2026-06-30',
  projectedEndDate: '2026-06-30', ownerName: 'Менеджер', health: 'on-track', progress: 0, taskCount: 1, completedTaskCount: 0,
}
const impact: ImpactAnalysis = {
  sourceTaskId: '', lastChange: { kind: 'session-started' }, affectedTaskIds: [], criticalTaskIds: [], atRiskTaskIds: [],
  previousProjectEndDate: '2026-06-30', projectedProjectEndDate: '2026-06-30', projectEndChangeDays: 0, deadlineShiftDays: 0,
  requiresIntervention: false, reasons: [], analyzedAt: '2026-06-01T00:00:00.000Z',
}
const assignees = [{ id: 'employee-1', projectId: 'project-1', name: 'Иван Иванов' }]

describe('task progress presentation', () => {
  it('does not show a progress column, percentage or bar in TaskList', () => {
    const markup = renderToStaticMarkup(<TaskList tasks={[task]} assignees={assignees} affectedTaskIds={[]} criticalTaskIds={[]} onTaskSelect={() => undefined} onTaskCreate={() => undefined} showAll onShowAllChange={() => undefined} />)
    expect(markup).not.toContain('Прогресс')
    expect(markup).not.toContain('62%')
    expect(markup).not.toContain('width:62%')
  })

  it('uses a solid full-period timeline bar without task progress fill', () => {
    const markup = renderToStaticMarkup(<Timeline project={project} tasks={[task]} assignees={assignees} impact={impact} onTaskSelect={() => undefined} />)
    expect(markup).not.toContain('width:62%')
    expect(markup).not.toContain('bg-white/20')
  })
})
