import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { ProjectWorkspace } from '../../types/workspace'
import { HistoryView } from './HistoryView'

const workspace = {
  project: { id: 'project', creatorId: 'manager', name: 'Проект', description: '', startDate: '2026-10-01', targetEndDate: '2026-10-31', projectedEndDate: '2026-10-31', ownerName: 'Менеджер', health: 'on-track', progress: 0, taskCount: 0, completedTaskCount: 0 },
  tasks: [], dependencies: [], assignees: [], recoveryScenarios: [], projectBoundaryIssues: [],
  currentIssues: { scheduleConflicts: [], statusConflicts: [], deadlineIssues: [], affectedTaskIds: [] },
  impact: { sourceTaskId: '', lastChange: { kind: 'session-started' }, affectedTaskIds: [], criticalTaskIds: [], slackDaysByTaskId: {}, atRiskTaskIds: [], previousProjectEndDate: '2026-10-31', projectedProjectEndDate: '2026-10-31', projectEndChangeDays: 0, deadlineShiftDays: 0, requiresIntervention: false, reasons: [], analyzedAt: '2026-10-01T00:00:00Z' },
} satisfies ProjectWorkspace

describe('HistoryView', () => {
  it('explains browser-local history and renders a truthful empty state', () => {
    const markup = renderToStaticMarkup(<HistoryView entries={[]} workspace={workspace} onRevert={async () => undefined} />)
    expect(markup).toContain('Изменения, выполненные в этом браузере')
    expect(markup).toContain('История пока пуста')
    expect(markup).toContain('после включения истории')
  })

  it('explains why an employee deletion cannot be reverted', () => {
    const markup = renderToStaticMarkup(<HistoryView entries={[{ id: 'event', projectId: 'project', createdAt: '2026-10-01T12:00:00Z', kind: 'employee-deleted', title: 'Удалён сотрудник', description: 'Иван Петров', entityType: 'employee', entityId: 'employee', before: { id: 'employee', name: 'Иван Петров' }, revertStatus: 'unavailable' }]} workspace={workspace} onRevert={async () => undefined} />)
    expect(markup).toContain('Удалён сотрудник')
    expect(markup).toContain('Почему откат недоступен')
    expect(markup).toContain('потребуется серверная история')
  })

  it('uses backend canUndo and disables unavailable server undo', () => {
    const entry = { source: 'server' as const, id: 'abc', projectId: 'project', operationType: 'task-updated', description: 'Изменена задача', createdAt: '2026-10-01T12:00:00Z', canUndo: false }
    const markup = renderToStaticMarkup(<HistoryView entries={[entry]} workspace={workspace} source="server" onRevert={async () => undefined} />)
    expect(markup).toContain('История проекта из backend')
    expect(markup).toContain('disabled=""')
    expect(markup).not.toContain('Для точного восстановления этого изменения потребуется серверная история')
  })
})
