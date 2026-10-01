// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ImpactAnalysis } from '../../types/impact'
import type { ProjectTask } from '../../types/task'
import type { CreateDependencyRequest, Dependency } from '../../types/dependency'
import { DependenciesView } from './DependenciesView'

const predecessor: ProjectTask = {
  id: 'predecessor', projectId: 'project', title: 'Backend', startDate: '2026-10-01', endDate: '2026-10-03',
  plannedStartDate: '2026-10-01', plannedEndDate: '2026-10-03', durationDays: 3, progress: 0,
  assigneeId: 'employee', status: 'in-progress', riskState: 'none', isCritical: false,
}
const successor: ProjectTask = {
  ...predecessor, id: 'successor', title: 'Frontend', startDate: '2026-10-04', endDate: '2026-10-06',
  plannedStartDate: '2026-10-04', plannedEndDate: '2026-10-06', status: 'not-started',
}
const impact: ImpactAnalysis = {
  sourceTaskId: '', lastChange: { kind: 'session-started' }, affectedTaskIds: [], criticalTaskIds: [],
  slackDaysByTaskId: {}, atRiskTaskIds: [], previousProjectEndDate: '2026-10-06', projectedProjectEndDate: '2026-10-06',
  projectEndChangeDays: 0, deadlineShiftDays: 0, requiresIntervention: false, reasons: [], analyzedAt: '2026-10-01T00:00:00Z',
}

afterEach(() => {
  cleanup()
  Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: undefined })
})

function renderGraph(onCreateDependency: (request: CreateDependencyRequest) => Promise<void>, dependencies: Dependency[] = []) {
  return render(<DependenciesView
    tasks={[predecessor, successor]}
    dependencies={dependencies}
    assignees={[]}
    impact={impact}
    currentIssues={{ scheduleConflicts: [], statusConflicts: [], deadlineIssues: [], affectedTaskIds: [] }}
    onTaskSelect={() => undefined}
    onCreateDependency={onCreateDependency}
    onDeleteDependency={async () => undefined}
    onTaskCreate={() => undefined}
  />)
}

describe('DependenciesView link interaction', () => {
  it('creates a dependency by dragging a node handle to another task', async () => {
    const onCreateDependency = vi.fn().mockResolvedValue(undefined)
    const { container } = renderGraph(onCreateDependency)
    const handle = container.querySelector('[data-dependency-handle="predecessor"]')!
    const target = container.querySelector('[data-dependency-target="successor"]')!
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: vi.fn().mockReturnValue(target) })

    fireEvent.pointerDown(handle, { button: 0, pointerId: 7, clientX: 250, clientY: 80 })
    fireEvent.pointerMove(handle, { pointerId: 7, clientX: 500, clientY: 100 })
    expect(container.querySelector('[data-dependency-preview="true"]')).not.toBeNull()
    expect(target.getAttribute('data-dependency-target-active')).toBe('true')
    fireEvent.pointerUp(handle, { pointerId: 7, clientX: 500, clientY: 100 })

    await waitFor(() => expect(onCreateDependency).toHaveBeenCalledWith({
      predecessorTaskId: 'predecessor', successorTaskId: 'successor', type: 'finish-to-start',
    }))
    expect(container.querySelector('[data-dependency-preview="true"]')).toBeNull()
  })

  it('uses the existing validation and does not submit a duplicate link', async () => {
    const dependency = { id: 'existing', projectId: 'project', predecessorTaskId: 'predecessor', successorTaskId: 'successor', type: 'finish-to-start' as const }
    const onCreateDependency = vi.fn().mockResolvedValue(undefined)
    const { container, findByRole } = renderGraph(onCreateDependency, [dependency])
    const handle = container.querySelector('[data-dependency-handle="predecessor"]')!
    const target = container.querySelector('[data-dependency-target="successor"]')!
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: vi.fn().mockReturnValue(target) })

    fireEvent.pointerDown(handle, { button: 0, pointerId: 8, clientX: 250, clientY: 80 })
    fireEvent.pointerUp(handle, { pointerId: 8, clientX: 500, clientY: 100 })

    expect((await findByRole('alert')).textContent).toContain('Такая зависимость уже существует')
    expect(onCreateDependency).not.toHaveBeenCalled()
  })
})
