import { describe, expect, it } from 'vitest'
import type { CurrentProjectIssues, ImpactAnalysis } from '../types/impact'
import type { Project } from '../types/project'
import type { ProjectTask } from '../types/task'
import { deriveProjectHealth, includeCurrentIssuesInImpact } from './currentProjectAnalysis'

const project: Project = { id: 'project', creatorId: 'manager', name: 'Проект', description: '', startDate: '2026-09-01', targetEndDate: '2026-09-26' }
const task: ProjectTask = { id: 'task', projectId: 'project', title: 'Задача', startDate: '2026-09-01', endDate: '2026-09-26', plannedStartDate: '2026-09-01', plannedEndDate: '2026-09-26', durationDays: 26, progress: 0, assigneeId: 'employee', status: 'in-progress', riskState: 'none', isCritical: false }
const warning = { sourceTaskId: 'task', affectedTaskIds: ['task'], reason: 'Проблема', consequence: 'Проверить', severity: 'warning' as const }
const noIssues: CurrentProjectIssues = { scheduleConflicts: [], statusConflicts: [], deadlineIssues: [], affectedTaskIds: [] }

describe('current project analysis', () => {
  it('marks a project off-track after its deadline while unfinished tasks remain', () => {
    expect(deriveProjectHealth(project, [task], noIssues, [], project.targetEndDate, '2026-09-27')).toBe('off-track')
    expect(deriveProjectHealth(project, [{ ...task, status: 'completed' }], noIssues, [], project.targetEndDate, '2026-09-27')).toBe('on-track')
  })

  it('marks current warnings as requiring intervention', () => {
    const impact: ImpactAnalysis = {
      sourceTaskId: '', lastChange: { kind: 'session-started' }, affectedTaskIds: [], criticalTaskIds: [], slackDaysByTaskId: {}, atRiskTaskIds: [],
      previousProjectEndDate: project.targetEndDate, projectedProjectEndDate: project.targetEndDate,
      projectEndChangeDays: 0, deadlineShiftDays: 0, requiresIntervention: false, reasons: [], analyzedAt: '',
    }
    expect(includeCurrentIssuesInImpact(impact, { ...noIssues, statusConflicts: [warning] }).requiresIntervention).toBe(true)
  })
})
