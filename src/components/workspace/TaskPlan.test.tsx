import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { CurrentProjectIssues } from '../../types/impact'
import type { ProjectTask } from '../../types/task'
import { findScheduleConflicts } from '../../services/scheduleEngine'
import { handleTaskPlanRowClick, TaskList } from './TaskList'

const task = (id: string, startDate: string, endDate: string): ProjectTask => ({ id, projectId: 'project', title: id, startDate, endDate, plannedStartDate: startDate, plannedEndDate: endDate, durationDays: 1, progress: 0, assigneeId: 'employee', status: 'not-started', riskState: 'none', isCritical: false })
const tasks = [task('A', '2026-10-11', '2026-10-14'), task('C', '2026-10-12', '2026-10-17'), task('B', '2026-10-17', '2026-10-20'), task('Просроченная', '2026-09-01', '2026-09-10')]
const dependencies = [
  { id: 'a-b', projectId: 'project', predecessorTaskId: 'A', successorTaskId: 'B', type: 'finish-to-start' as const },
  { id: 'c-b', projectId: 'project', predecessorTaskId: 'C', successorTaskId: 'B', type: 'finish-to-start' as const },
]
const scheduleConflicts = findScheduleConflicts(tasks, dependencies, tasks.map((item) => item.id))
const currentIssues: CurrentProjectIssues = { scheduleConflicts, statusConflicts: [], deadlineIssues: [{ sourceTaskId: 'Просроченная', affectedTaskIds: ['Просроченная'], severity: 'warning', reason: 'Срок', consequence: 'Проверить' }], affectedTaskIds: ['B', 'Просроченная'] }

function renderPlan() {
  return renderToStaticMarkup(<TaskList tasks={tasks} dependencies={dependencies} assignees={[{ id: 'employee', projectId: 'project', name: 'Иван Петров' }]} affectedTaskIds={['B', 'Просроченная']} criticalTaskIds={['A', 'B']} slackDaysByTaskId={{ A: 0, C: 3, B: -2, Просроченная: 4 }} projectedProjectEndDate="2026-10-20" currentIssues={currentIssues} onTaskSelect={() => undefined} onTaskCreate={() => undefined} today="2026-09-27" />)
}

describe('TaskList schedule insights', () => {
  it('defaults to the attention filter and shows filter counts', () => {
    const markup = renderPlan()
    expect(markup).toContain('aria-pressed="true"')
    expect(markup).toContain('Требуют внимания')
    expect(markup).toContain('Все <span class="opacity-70">4</span>')
  })

  it('shows periods, zero slack and readable deficit', () => {
    const markup = renderPlan()
    expect(markup).toContain('11 окт. — 14 окт.')
    expect(markup).toContain('0 дней')
    expect(markup).toContain('Дефицит 2 дн.')
  })

  it('shows the latest multi-predecessor constraint and keeps critical/overdue badges', () => {
    const markup = renderPlan()
    expect(markup).toContain('После 2 задач')
    expect(markup).toContain('18 окт.')
    expect(markup).toContain('Критическая')
    expect(markup).toContain('Просрочено')
  })

  it('renders mobile cards with slack and constraint information', () => {
    const markup = renderPlan()
    expect(markup).toContain('divide-y divide-[#efedf2] md:hidden')
    expect(markup).toContain('Запас:')
    expect(markup).toContain('Ограничение:')
  })

  it('opens a task when its row is clicked outside a tooltip', () => {
    const onTaskSelect = vi.fn()
    handleTaskPlanRowClick({ target: { closest: () => null } } as never, tasks[0], onTaskSelect)
    expect(onTaskSelect).toHaveBeenCalledWith(tasks[0])
  })
})
