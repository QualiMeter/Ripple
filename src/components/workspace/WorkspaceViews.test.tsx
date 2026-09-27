import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { ProjectWorkspace } from '../../types/workspace'
import { ImpactPanel } from './ImpactPanel'
import { openRisksView, OverviewDashboard } from './OverviewDashboard'
import { PlanWorkspaceView } from './PlanWorkspaceView'

const tasks = Array.from({ length: 7 }, (_, index) => ({
  id: `task-${index + 1}`, projectId: 'project', title: `Задача ${index + 1}`,
  startDate: `2026-10-${String(index + 1).padStart(2, '0')}`, endDate: `2026-10-${String(index + 3).padStart(2, '0')}`,
  plannedStartDate: `2026-10-${String(index + 1).padStart(2, '0')}`, plannedEndDate: `2026-10-${String(index + 3).padStart(2, '0')}`,
  durationDays: 3, progress: 0, assigneeId: 'employee', status: 'not-started' as const, riskState: 'none' as const, isCritical: false,
}))

const scheduleIssue = { sourceTaskId: 'task-1', affectedTaskIds: ['task-2'], reason: 'Начало раньше допустимой даты.', consequence: 'Зависимая задача может начаться слишком рано.', severity: 'warning' as const, action: { type: 'preview-shift' as const } }

const workspace: ProjectWorkspace = {
  project: { id: 'project', creatorId: 'manager', name: 'Проект', description: '', startDate: '2026-10-01', targetEndDate: '2026-10-31', projectedEndDate: '2026-10-31', ownerName: 'Менеджер', health: 'at-risk', progress: 0, taskCount: 7, completedTaskCount: 0 },
  tasks,
  dependencies: [{ id: 'dependency', projectId: 'project', predecessorTaskId: 'task-1', successorTaskId: 'task-2', type: 'finish-to-start' }],
  assignees: [{ id: 'employee', projectId: 'project', name: 'Иван Иванов' }],
  recoveryScenarios: [], projectBoundaryIssues: [],
  currentIssues: { scheduleConflicts: [scheduleIssue], statusConflicts: [], deadlineIssues: [], affectedTaskIds: ['task-1', 'task-2'] },
  impact: { sourceTaskId: 'task-1', lastChange: { kind: 'task-updated', taskId: 'task-1', taskTitle: 'Задача 1', changes: [{ field: 'endDate', previousValue: '2026-10-02', nextValue: '2026-10-03' }] }, affectedTaskIds: tasks.map((task) => task.id), criticalTaskIds: tasks.map((task) => task.id), slackDaysByTaskId: Object.fromEntries(tasks.map((task, index) => [task.id, index === 1 ? 3 : 0])), atRiskTaskIds: [], previousProjectEndDate: '2026-10-30', projectedProjectEndDate: '2026-10-31', projectEndChangeDays: 1, deadlineShiftDays: 0, requiresIntervention: true, reasons: [scheduleIssue], analyzedAt: '2026-09-27T00:00:00.000Z' },
}

describe('differentiated workspace views', () => {
  it('keeps Overview compact without the full impact panel and limits attention tasks to five', () => {
    const markup = renderToStaticMarkup(<OverviewDashboard workspace={workspace} onTaskSelect={() => undefined} onOpenRisks={() => undefined} />)
    expect(markup).toContain('Краткий план проекта')
    expect(markup).toContain('Последнее изменение')
    expect(markup).not.toContain('Автоматический сдвиг')
    expect(markup).not.toContain('Текущие проблемы проекта')
    expect(markup.match(/data-attention-task=/g)).toHaveLength(5)
  })

  it('uses the Risks navigation callback from Overview details', () => {
    const onOpenRisks = vi.fn()
    openRisksView(onOpenRisks)
    expect(onOpenRisks).toHaveBeenCalledOnce()
  })

  it('shows real slack and finish-to-start constraints in Plan', () => {
    const markup = renderToStaticMarkup(<PlanWorkspaceView workspace={workspace} onTaskSelect={() => undefined} onTaskCreate={() => undefined} onOpenRisks={() => undefined} />)
    expect(markup).toContain('Запас расписания')
    expect(markup).toContain('0 дней')
    expect(markup).toContain('· Критическая')
    expect(markup).toContain('3 дня')
    expect(markup).toContain('Можно начать не раньше: 04.10.2026')
    expect(markup).toContain('Ограничивает начало:')
  })

  it('keeps Risks focused on analysis and automatic shift actions', () => {
    const markup = renderToStaticMarkup(<ImpactPanel workspace={workspace} onPreviewScheduleShift={async () => { throw new Error('not called') }} onApplyScheduleShift={async () => undefined} onTaskSelect={() => undefined} />)
    expect(markup).toContain('Текущие проблемы проекта')
    expect(markup).toContain('Автоматический сдвиг')
    expect(markup).not.toContain('Общий прогресс')
    expect(markup).not.toContain('Полный список задач проекта')
  })
})
