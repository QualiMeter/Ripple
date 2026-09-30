// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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

  it.each([
    ['resize-start', 210, 280, { startDate: '2026-09-12' }],
    ['resize-end', 420, 560, { endDate: '2026-09-16' }],
  ] as const)('saves a %s drag only after pointer release', async (handle, startX, endX, expected) => {
    const onTaskUpdate = vi.fn().mockResolvedValue(undefined)
    const { container } = render(<Timeline
      project={project}
      tasks={[task]}
      dependencies={[]}
      assignees={[]}
      impact={buildImpactAnalysis(project, [task], [], '', [], { kind: 'session-started' })}
      currentIssues={buildCurrentProjectIssues(project, [task], [], '2026-09-11')}
      onTaskSelect={() => undefined}
      onTaskDraft={onTaskUpdate}
      today="2026-09-11"
    />)
    const bar = screen.getByRole('button', { name: /Редактировать задачу «Интеграция»,/ })
    const edge = container.querySelector(`[data-resize-handle="${handle === 'resize-start' ? 'start' : 'end'}"]`)!
    fireEvent.pointerDown(edge, { pointerId: 1, clientX: startX })
    fireEvent.pointerMove(bar, { pointerId: 1, clientX: endX })
    expect(onTaskUpdate).not.toHaveBeenCalled()
    fireEvent.pointerUp(bar, { pointerId: 1, clientX: endX })
    await waitFor(() => expect(onTaskUpdate).toHaveBeenCalledWith('task', expected))
  })

  it('moves the whole task while preserving its duration', async () => {
    const onTaskUpdate = vi.fn().mockResolvedValue(undefined)
    render(<Timeline
      project={project} tasks={[task]} dependencies={[]} assignees={[]}
      impact={buildImpactAnalysis(project, [task], [], '', [], { kind: 'session-started' })}
      currentIssues={buildCurrentProjectIssues(project, [task], [], '2026-09-11')}
      onTaskSelect={() => undefined} onTaskDraft={onTaskUpdate} today="2026-09-11"
    />)
    const bar = screen.getByRole('button', { name: /Редактировать задачу «Интеграция»,/ })
    fireEvent.pointerDown(bar, { pointerId: 2, clientX: 210 })
    fireEvent.pointerMove(bar, { pointerId: 2, clientX: 350 })
    fireEvent.pointerUp(bar, { pointerId: 2, clientX: 350 })
    await waitFor(() => expect(onTaskUpdate).toHaveBeenCalledWith('task', { startDate: '2026-09-13', endDate: '2026-09-16' }))
  })

  it('rolls the visual preview back when a drag save fails', async () => {
    const onTaskUpdate = vi.fn(() => { throw new Error('Сохранение недоступно') })
    render(<Timeline
      project={project} tasks={[task]} dependencies={[]} assignees={[]}
      impact={buildImpactAnalysis(project, [task], [], '', [], { kind: 'session-started' })}
      currentIssues={buildCurrentProjectIssues(project, [task], [], '2026-09-11')}
      onTaskSelect={() => undefined} onTaskDraft={onTaskUpdate} today="2026-09-11"
    />)
    const bar = screen.getByRole('button', { name: /Редактировать задачу «Интеграция»,/ })
    fireEvent.pointerDown(bar, { pointerId: 3, clientX: 210 })
    fireEvent.pointerMove(bar, { pointerId: 3, clientX: 350 })
    fireEvent.pointerUp(bar, { pointerId: 3, clientX: 350 })
    expect((await screen.findByRole('alert')).textContent).toContain('Сохранение недоступно')
    expect(bar.getAttribute('data-task-start-date')).toBe('2026-09-11')
    expect(bar.getAttribute('data-task-end-date')).toBe('2026-09-14')
  })

  it('creates a dependency by dragging the task link handle to another task', async () => {
    const successor = { ...task, id: 'successor', title: 'Тестирование', startDate: '2026-09-15', endDate: '2026-09-18' }
    const onCreateDependency = vi.fn().mockResolvedValue(undefined)
    const { container } = render(<Timeline
      project={project} tasks={[task, successor]} dependencies={[]} assignees={[]}
      impact={buildImpactAnalysis(project, [task, successor], [], '', [], { kind: 'session-started' })}
      currentIssues={buildCurrentProjectIssues(project, [task, successor], [], '2026-09-11')}
      onTaskSelect={() => undefined} onCreateDependency={onCreateDependency} today="2026-09-11"
    />)
    const handle = container.querySelector('[data-dependency-handle="task"]')!
    const target = container.querySelector('[data-timeline-task-target="successor"]')!
    const elementFromPoint = vi.fn().mockReturnValue(target)
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: elementFromPoint })
    fireEvent.pointerDown(handle, { pointerId: 4, clientX: 300, clientY: 28 })
    fireEvent.pointerMove(handle, { pointerId: 4, clientX: 500, clientY: 84 })
    fireEvent.pointerUp(handle, { pointerId: 4, clientX: 500, clientY: 84 })
    await waitFor(() => expect(onCreateDependency).toHaveBeenCalledWith({ predecessorTaskId: 'task', successorTaskId: 'successor', type: 'finish-to-start' }))
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: undefined })
  })

  it('highlights one dependency and both endpoints while other links are dimmed', () => {
    const second = { ...task, id: 'second', title: 'Frontend', startDate: '2026-09-15', endDate: '2026-09-18' }
    const third = { ...task, id: 'third', title: 'Testing', startDate: '2026-09-19', endDate: '2026-09-20' }
    const dependencies: Dependency[] = [
      { id: 'first-second', projectId: project.id, predecessorTaskId: task.id, successorTaskId: second.id, type: 'finish-to-start' },
      { id: 'second-third', projectId: project.id, predecessorTaskId: second.id, successorTaskId: third.id, type: 'finish-to-start' },
    ]
    const { container } = render(<Timeline project={project} tasks={[task, second, third]} dependencies={dependencies} assignees={[]} impact={buildImpactAnalysis(project, [task, second, third], dependencies, '', [], { kind: 'session-started' })} currentIssues={buildCurrentProjectIssues(project, [task, second, third], dependencies, '2026-09-11')} onTaskSelect={() => undefined} today="2026-09-11" />)
    const lines = container.querySelectorAll('[data-dependency-connector="true"]')
    fireEvent.mouseEnter(lines[0])
    expect(lines[0].getAttribute('data-dependency-highlighted')).toBe('true')
    expect(lines[1].parentElement?.getAttribute('opacity')).toBe('0.12')
    expect(container.querySelector('[data-timeline-task-target="task"]')?.getAttribute('data-dependency-highlighted')).toBe('true')
    expect(container.querySelector('[data-timeline-task-target="second"]')?.getAttribute('data-dependency-highlighted')).toBe('true')
    expect(lines[0].textContent).toContain('Интеграция → Frontend')
  })

  it('highlights all incoming and outgoing links when a task bar is hovered', () => {
    const second = { ...task, id: 'second', title: 'Frontend', startDate: '2026-09-15', endDate: '2026-09-18' }
    const third = { ...task, id: 'third', title: 'Testing', startDate: '2026-09-19', endDate: '2026-09-20' }
    const unrelated = { ...task, id: 'unrelated', title: 'Документация', startDate: '2026-09-11', endDate: '2026-09-12' }
    const dependencies: Dependency[] = [
      { id: 'first-second', projectId: project.id, predecessorTaskId: task.id, successorTaskId: second.id, type: 'finish-to-start' },
      { id: 'second-third', projectId: project.id, predecessorTaskId: second.id, successorTaskId: third.id, type: 'finish-to-start' },
      { id: 'unrelated-third', projectId: project.id, predecessorTaskId: unrelated.id, successorTaskId: third.id, type: 'finish-to-start' },
    ]
    const allTasks = [task, second, third, unrelated]
    const { container } = render(<Timeline project={project} tasks={allTasks} dependencies={dependencies} assignees={[]} impact={buildImpactAnalysis(project, allTasks, dependencies, '', [], { kind: 'session-started' })} currentIssues={buildCurrentProjectIssues(project, allTasks, dependencies, '2026-09-11')} onTaskSelect={() => undefined} today="2026-09-11" />)
    fireEvent.mouseEnter(container.querySelector('[data-timeline-task-target="second"]')!)
    expect(container.querySelector('[data-dependency-connector="true"][data-dependency-highlighted="true"]')).not.toBeNull()
    expect(container.querySelectorAll('[data-dependency-connector="true"][data-dependency-highlighted="true"]')).toHaveLength(2)
    expect(container.querySelector('[data-timeline-task-target="unrelated"]')?.getAttribute('data-dependency-dimmed')).toBe('true')
  })

  it('shows real project dates and switches day, week and month display scales without changing task dates', () => {
    const longProject = { ...project, targetEndDate: '2027-09-20', projectedEndDate: '2027-09-20' }
    const successor = { ...task, id: 'successor', title: 'Тестирование', startDate: '2026-09-15', endDate: '2026-09-18' }
    const dependencies: Dependency[] = [{ id: 'task-successor', projectId: project.id, predecessorTaskId: task.id, successorTaskId: successor.id, type: 'finish-to-start' }]
    const { container } = render(<Timeline
      project={longProject} tasks={[task, successor]} dependencies={dependencies} assignees={[]}
      impact={buildImpactAnalysis(longProject, [task, successor], dependencies, '', [], { kind: 'session-started' })}
      currentIssues={buildCurrentProjectIssues(longProject, [task, successor], dependencies, '2026-09-11')}
      onTaskSelect={() => undefined} today="2026-09-11"
    />)
    expect(screen.getByText(/Начало:/).parentElement?.textContent).toContain('Начало: 11 сентября')
    expect(screen.getByText(/Окончание:/).parentElement?.textContent).toContain('Окончание: 20 сентября')
    const bar = container.querySelector('[data-timeline-task-target="task"]')!
    const initialDates = [bar.getAttribute('data-task-start-date'), bar.getAttribute('data-task-end-date')]
    const dayWidth = Number(container.querySelector('[data-timeline-canvas-width]')?.getAttribute('data-timeline-canvas-width'))
    fireEvent.click(screen.getByRole('button', { name: 'Недели' }))
    const weekWidth = Number(container.querySelector('[data-timeline-canvas-width]')?.getAttribute('data-timeline-canvas-width'))
    fireEvent.click(screen.getByRole('button', { name: 'Месяцы' }))
    const monthWidth = Number(container.querySelector('[data-timeline-canvas-width]')?.getAttribute('data-timeline-canvas-width'))
    expect(dayWidth).toBeGreaterThan(weekWidth)
    expect(weekWidth).toBeGreaterThan(monthWidth)
    expect([bar.getAttribute('data-task-start-date'), bar.getAttribute('data-task-end-date')]).toEqual(initialDates)
    expect(container.querySelectorAll('[data-dependency-connector="true"]')).toHaveLength(1)
  })
})
