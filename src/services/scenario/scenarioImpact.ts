import type { ProjectWorkspace } from '../../types/workspace'
import { differenceInDays } from '../scheduleEngine'
import { findDependencyDateConflicts } from '../scheduleRules'
import { analyzeTeamWorkloadAttention } from '../teamWorkload'
import type { ProjectScenarioDraft, ScenarioImpact } from './scenarioTypes'

function workloadIssueIds(workspace: ProjectWorkspace): string[] {
  const attention = analyzeTeamWorkloadAttention(workspace.assignees, workspace.tasks)
  return attention.workload.filter((item) => item.level === 'high' || item.level === 'elevated').map((item) => item.employeeId)
}

export function buildScenarioImpact(workspace: ProjectWorkspace, draft: ProjectScenarioDraft): ScenarioImpact {
  const scenario = draft.scenarioWorkspace
  return {
    currentProjectedEndDate: workspace.impact.projectedProjectEndDate,
    scenarioProjectedEndDate: scenario.impact.projectedProjectEndDate,
    projectEndDeltaDays: differenceInDays(scenario.impact.projectedProjectEndDate, workspace.impact.projectedProjectEndDate),
    conflictsBefore: findDependencyDateConflicts(workspace.tasks, workspace.dependencies).length,
    conflictsAfter: findDependencyDateConflicts(scenario.tasks, scenario.dependencies).length,
    affectedTaskIds: draft.affectedTaskIds,
    criticalTasksBefore: workspace.impact.criticalTaskIds,
    criticalTasksAfter: scenario.impact.criticalTaskIds,
    workloadIssuesBefore: workloadIssueIds(workspace),
    workloadIssuesAfter: workloadIssueIds(scenario),
  }
}
