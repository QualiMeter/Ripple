import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { ImpactAnalysis } from '../../types/impact'
import type { ProjectTask } from '../../types/task'
import { calculateWheelZoom, clampScale, DependenciesView } from './DependenciesView'

const task: ProjectTask = {
  id: 'task-1',
  projectId: 'project-1',
  title: 'Интеграция',
  startDate: '2026-06-02',
  endDate: '2026-06-05',
  plannedStartDate: '2026-06-02',
  plannedEndDate: '2026-06-05',
  durationDays: 4,
  progress: 0,
  assigneeId: 'employee-1',
  status: 'in-progress',
  riskState: 'none',
  isCritical: false,
}

const impact: ImpactAnalysis = {
  sourceTaskId: '',
  lastChange: { kind: 'session-started' },
  affectedTaskIds: [],
  criticalTaskIds: [],
  slackDaysByTaskId: {},
  atRiskTaskIds: [],
  previousProjectEndDate: '2026-06-05',
  projectedProjectEndDate: '2026-06-05',
  projectEndChangeDays: 0,
  deadlineShiftDays: 0,
  requiresIntervention: false,
  reasons: [],
  analyzedAt: '2026-06-01T00:00:00.000Z',
}

describe('DependenciesView', () => {
  it('zooms smoothly in both directions and clamps the scale', () => {
    const camera = { x: 20, y: 30, scale: 1 }
    expect(calculateWheelZoom(camera, -100, { x: 100, y: 100 }).scale).toBeGreaterThan(1)
    expect(calculateWheelZoom(camera, 100, { x: 100, y: 100 }).scale).toBeLessThan(1)
    expect(clampScale(100)).toBe(1.6)
    expect(clampScale(0.01)).toBe(0.45)
  })

  it('keeps the graph point beneath the cursor fixed while zooming', () => {
    const camera = { x: 20, y: 30, scale: 1 }
    const center = { x: 140, y: 110 }
    const before = { x: (center.x - camera.x) / camera.scale, y: (center.y - camera.y) / camera.scale }
    const zoomed = calculateWheelZoom(camera, -80, center)
    const after = { x: (center.x - zoomed.x) / zoomed.scale, y: (center.y - zoomed.y) / zoomed.scale }
    expect(after.x).toBeCloseTo(before.x)
    expect(after.y).toBeCloseTo(before.y)
  })

  it('shows task dates in the graph node using the full Russian date format', () => {
    const markup = renderToStaticMarkup(
      <DependenciesView
        tasks={[task]}
        dependencies={[]}
        assignees={[{ id: 'employee-1', projectId: 'project-1', name: 'Иван Иванов' }]}
        impact={impact}
        currentIssues={{ scheduleConflicts: [], statusConflicts: [], deadlineIssues: [], affectedTaskIds: [] }}
        onTaskSelect={() => undefined}
        onCreateDependency={async () => undefined}
        onDeleteDependency={async () => undefined}
        onTaskCreate={() => undefined}
      />,
    )

    expect(markup).toContain('02.06.2026 — 05.06.2026')
    expect(markup).not.toContain('2026-06-02')
    expect(markup).not.toContain('2026-06-05')
  })

  it('shows a schedule conflict instead of claiming that there are no risks', () => {
    const markup = renderToStaticMarkup(
      <DependenciesView
        tasks={[task]}
        dependencies={[]}
        assignees={[{ id: 'employee-1', projectId: 'project-1', name: 'Иван Иванов' }]}
        impact={impact}
        currentIssues={{
          scheduleConflicts: [{ sourceTaskId: task.id, affectedTaskIds: [task.id], reason: 'Конфликт', consequence: 'Проверить', severity: 'warning' }],
          statusConflicts: [], deadlineIssues: [], affectedTaskIds: [task.id],
        }}
        onTaskSelect={() => undefined}
        onCreateDependency={async () => undefined}
        onDeleteDependency={async () => undefined}
        onTaskCreate={() => undefined}
      />,
    )
    expect(markup).toContain('Конфликт расписания')
    expect(markup).not.toContain('Рисков нет')
  })

  it('shows an error status conflict in a graph task', () => {
    const markup = renderToStaticMarkup(
      <DependenciesView
        tasks={[{ ...task, status: 'completed' }]}
        dependencies={[]}
        assignees={[]}
        impact={impact}
        currentIssues={{
          scheduleConflicts: [],
          statusConflicts: [{ sourceTaskId: task.id, affectedTaskIds: [task.id], reason: 'Некорректный статус', consequence: 'Исправить', severity: 'error' }],
          deadlineIssues: [], affectedTaskIds: [task.id],
        }}
        onTaskSelect={() => undefined}
        onCreateDependency={async () => undefined}
        onDeleteDependency={async () => undefined}
        onTaskCreate={() => undefined}
      />,
    )
    expect(markup).toContain('Ошибка состояния')
    expect(markup).not.toContain('Рисков нет')
  })

  it('keeps an in-progress status violet while showing its predecessor warning', () => {
    const predecessor = { ...task, id: 'a', title: 'A', status: 'not-started' as const }
    const successor = { ...task, id: 'b', title: 'B', status: 'in-progress' as const }
    const markup = renderToStaticMarkup(
      <DependenciesView
        tasks={[predecessor, successor]}
        dependencies={[{ id: 'a-b', projectId: task.projectId, predecessorTaskId: 'a', successorTaskId: 'b', type: 'finish-to-start' }]}
        assignees={[]}
        impact={impact}
        currentIssues={{
          scheduleConflicts: [],
          statusConflicts: [{ sourceTaskId: 'b', affectedTaskIds: ['b', 'a'], reason: 'Предшественник не завершён', consequence: 'Проверить', severity: 'warning' }],
          deadlineIssues: [], affectedTaskIds: ['a', 'b'],
        }}
        onTaskSelect={() => undefined}
        onCreateDependency={async () => undefined}
        onDeleteDependency={async () => undefined}
        onTaskCreate={() => undefined}
      />,
    )
    expect(markup).toContain('В работе')
    expect(markup).toContain('bg-violet-50')
    expect(markup).toContain('Конфликт состояния')
  })
})
