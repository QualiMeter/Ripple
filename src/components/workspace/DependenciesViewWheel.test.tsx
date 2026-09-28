// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ImpactAnalysis } from '../../types/impact'
import type { ProjectTask } from '../../types/task'
import { DependenciesView } from './DependenciesView'

const task: ProjectTask = {
  id: 'task', projectId: 'project', title: 'Задача', startDate: '2026-06-02', endDate: '2026-06-05',
  plannedStartDate: '2026-06-02', plannedEndDate: '2026-06-05', durationDays: 4, progress: 0,
  assigneeId: 'employee', status: 'in-progress', riskState: 'none', isCritical: false,
}

const impact: ImpactAnalysis = {
  sourceTaskId: '', lastChange: { kind: 'session-started' }, affectedTaskIds: [], criticalTaskIds: [],
  slackDaysByTaskId: {}, atRiskTaskIds: [], previousProjectEndDate: task.endDate,
  projectedProjectEndDate: task.endDate, projectEndChangeDays: 0, deadlineShiftDays: 0,
  requiresIntervention: false, reasons: [], analyzedAt: '2026-06-01T00:00:00Z',
}

function graph() {
  return <DependenciesView
    tasks={[task]}
    dependencies={[]}
    assignees={[{ id: 'employee', projectId: 'project', name: 'Иван' }]}
    impact={impact}
    currentIssues={{ scheduleConflicts: [], statusConflicts: [], deadlineIssues: [], affectedTaskIds: [] }}
    onTaskSelect={() => undefined}
    onCreateDependency={async () => undefined}
    onDeleteDependency={async () => undefined}
    onTaskCreate={() => undefined}
  />
}

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('DependenciesView native wheel isolation', () => {
  it('registers a non-passive viewport listener and removes it on cleanup', () => {
    const addListener = vi.spyOn(HTMLElement.prototype, 'addEventListener')
    const removeListener = vi.spyOn(HTMLElement.prototype, 'removeEventListener')
    const view = render(graph())
    const registration = addListener.mock.calls.find(([type, , options]) => type === 'wheel' && (options as AddEventListenerOptions | undefined)?.passive === false)
    expect(registration).toBeTruthy()
    const handler = registration?.[1]
    view.unmount()
    expect(removeListener.mock.calls.some(([type, candidate]) => type === 'wheel' && candidate === handler)).toBe(true)
  })

  it.each([false, true])('prevents native wheel behavior inside the viewport when ctrlKey=%s', (ctrlKey) => {
    render(graph())
    const viewport = screen.getByLabelText('Интерактивный граф зависимостей')
    vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue({
      x: 10, y: 20, left: 10, top: 20, right: 610, bottom: 640, width: 600, height: 620, toJSON: () => ({}),
    })
    const event = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      clientX: 160,
      clientY: 120,
      deltaY: -100,
      ctrlKey,
    })
    fireEvent(viewport, event)
    expect(event.defaultPrevented).toBe(true)
    expect(screen.getByText('111%')).toBeTruthy()
  })
})
