import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { ImpactAnalysis } from '../../types/impact'
import type { ProjectTask } from '../../types/task'
import { DependenciesView } from './DependenciesView'

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
  it('shows task dates in the graph node using the full Russian date format', () => {
    const markup = renderToStaticMarkup(
      <DependenciesView
        tasks={[task]}
        dependencies={[]}
        assignees={[{ id: 'employee-1', projectId: 'project-1', name: 'Иван Иванов' }]}
        impact={impact}
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
})
