// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProjectSummary } from '../../types/project'
import type { ProjectTask } from '../../types/task'
import type { Dependency } from '../../types/dependency'
import { buildCurrentProjectIssues, buildImpactAnalysis } from '../../services/scheduleEngine'
import { Timeline } from './Timeline'

const project: ProjectSummary = {
  id: 'project', creatorId: 'manager', name: 'Проект', description: '', startDate: '2026-09-11', targetEndDate: '2026-09-20',
  projectedEndDate: '2026-09-20', ownerName: 'Менеджер', health: 'on-track', progress: 0, taskCount: 1, completedTaskCount: 0,
}
const task: ProjectTask = {
  id: 'task', projectId: 'project', title: 'Интеграция', startDate: '2026-09-11', endDate: '2026-09-14',
  plannedStartDate: '2026-09-11', plannedEndDate: '2026-09-14', durationDays: 4, progress: 0,
  assigneeId: 'employee', status: 'not-started', riskState: 'none', isCritical: false,
}

afterEach(cleanup)

describe('Timeline task interaction', () => {
  it('opens the task editor when its timeline bar is clicked', () => {
    const onTaskSelect = vi.fn()
    const dependencies: Dependency[] = []
    render(<Timeline
      project={project}
      tasks={[task]}
      dependencies={dependencies}
      assignees={[]}
      impact={buildImpactAnalysis(project, [task], dependencies, '', [], { kind: 'session-started' })}
      currentIssues={buildCurrentProjectIssues(project, [task], dependencies, '2026-09-11')}
      onTaskSelect={onTaskSelect}
      today="2026-09-11"
    />)

    fireEvent.click(screen.getByRole('button', { name: /Редактировать задачу «Интеграция», 11\.09\.2026 — 14\.09\.2026/ }))
    expect(onTaskSelect).toHaveBeenCalledWith(task)
  })
})
