import type { ImpactReason } from '../types/impact'
import type { ScheduleShiftPreview } from '../types/schedule'
import type { TaskUpdateRequest } from '../types/task'
import type { ProjectWorkspace } from '../types/workspace'
import { applyExplicitTaskUpdate, applyScheduleShiftPreview, calculateScheduleShiftPreview, differenceInDays, findDownstreamTaskIds, findScheduleConflicts } from './scheduleEngine'
import { findDependencyDateConflicts, type DependencyDateConflict } from './scheduleRules'
import { rebuildWorkspaceDerivedState } from './workspaceState'

export interface TimelineDraftTaskChange {
  taskId: string
  currentStartDate: string
  currentEndDate: string
  proposedStartDate: string
  proposedEndDate: string
}

export interface TimelineDraftPreview {
  sourceTaskId: string
  sourceUpdate: TaskUpdateRequest
  taskChanges: TimelineDraftTaskChange[]
  schedulePreview: ScheduleShiftPreview
  currentProjectEndDate: string
  proposedProjectEndDate: string
  projectEndDeltaDays: number
  existingConflicts: TimelineDraftConflict[]
  draftConflicts: TimelineDraftConflict[]
  resolvedConflicts: TimelineDraftConflict[]
  remainingConflicts: ImpactReason[]
  completedManualTaskIds: string[]
  workspace: ProjectWorkspace
}

export interface TimelineDraftConflict {
  key: string
  predecessorTaskId: string
  successorTaskId: string
  predecessorEndDate: string
  successorStartDate: string
  earliestStartDate: string
}

export interface TimelineDraftApplyPort {
  updateTask(workspace: ProjectWorkspace, taskId: string, update: TaskUpdateRequest): Promise<ProjectWorkspace>
  previewScheduleShift(workspace: ProjectWorkspace, sourceTaskId: string): Promise<ScheduleShiftPreview>
  applyScheduleShift(workspace: ProjectWorkspace, preview: ScheduleShiftPreview, confirmProjectEndDate: boolean): Promise<ProjectWorkspace>
}

export interface TimelineDraftApplyResult {
  sourceWorkspace: ProjectWorkspace
  workspace: ProjectWorkspace
  appliedSchedulePreview: ScheduleShiftPreview | null
}

function dependencyConflictKey(conflict: DependencyDateConflict): string {
  const { dependency } = conflict
  return `${dependency.predecessorTaskId}:${dependency.successorTaskId}:${dependency.type}`
}

function mapDraftConflict(conflict: DependencyDateConflict): TimelineDraftConflict {
  return {
    key: dependencyConflictKey(conflict),
    predecessorTaskId: conflict.predecessor.id,
    successorTaskId: conflict.successor.id,
    predecessorEndDate: conflict.predecessor.endDate,
    successorStartDate: conflict.successor.startDate,
    earliestStartDate: conflict.requiredStartDate,
  }
}

function conflictDatesSignature(conflict: TimelineDraftConflict): string {
  return `${conflict.predecessorEndDate}:${conflict.successorStartDate}:${conflict.earliestStartDate}`
}

export function buildTimelineDraftPreview(workspace: ProjectWorkspace, sourceTaskId: string, sourceUpdate: TaskUpdateRequest): TimelineDraftPreview {
  const source = workspace.tasks.find((task) => task.id === sourceTaskId)
  if (!source) throw new Error('Задача не найдена.')
  const updatedSource = applyExplicitTaskUpdate(source, sourceUpdate)
  const explicitlyUpdatedTasks = workspace.tasks.map((task) => task.id === sourceTaskId ? updatedSource : task)
  const schedulePreview = calculateScheduleShiftPreview(workspace.project.id, explicitlyUpdatedTasks, workspace.dependencies, sourceTaskId)
  const proposedTasks = applyScheduleShiftPreview(explicitlyUpdatedTasks, schedulePreview)
  const changedIds = new Set([sourceTaskId, ...schedulePreview.taskShifts.map((shift) => shift.taskId)])
  const taskChanges = workspace.tasks.flatMap((task) => {
    if (!changedIds.has(task.id)) return []
    const proposed = proposedTasks.find((candidate) => candidate.id === task.id)!
    if (task.startDate === proposed.startDate && task.endDate === proposed.endDate) return []
    return [{ taskId: task.id, currentStartDate: task.startDate, currentEndDate: task.endDate, proposedStartDate: proposed.startDate, proposedEndDate: proposed.endDate }]
  })
  const existingConflicts = findDependencyDateConflicts(workspace.tasks, workspace.dependencies).map(mapDraftConflict)
  const proposedConflicts = findDependencyDateConflicts(proposedTasks, workspace.dependencies).map(mapDraftConflict)
  const existingByKey = new Map(existingConflicts.map((conflict) => [conflict.key, conflict]))
  const proposedByKey = new Map(proposedConflicts.map((conflict) => [conflict.key, conflict]))
  const draftConflicts = proposedConflicts.filter((conflict) => {
    const existing = existingByKey.get(conflict.key)
    return !existing || conflictDatesSignature(existing) !== conflictDatesSignature(conflict)
  })
  const resolvedConflicts = existingConflicts.filter((conflict) => !proposedByKey.has(conflict.key))
  const draftConflictKeys = new Set(draftConflicts.map((conflict) => conflict.key))
  const remainingConflicts = findScheduleConflicts(
    proposedTasks,
    workspace.dependencies,
    draftConflicts.map((conflict) => conflict.successorTaskId),
  ).filter((reason) => reason.affectedTaskIds.some((successorTaskId) => (
    draftConflictKeys.has(`${reason.sourceTaskId}:${successorTaskId}:finish-to-start`)
  )))
  const downstreamTaskIds = new Set(findDownstreamTaskIds(sourceTaskId, workspace.dependencies))
  const completedManualTaskIds = [...new Set(draftConflicts
    .filter((conflict) => downstreamTaskIds.has(conflict.successorTaskId)
      && proposedTasks.find((task) => task.id === conflict.successorTaskId)?.status === 'completed')
    .map((conflict) => conflict.successorTaskId))]
  const draftWorkspace = rebuildWorkspaceDerivedState({ ...workspace, tasks: proposedTasks }, {
    sourceTaskId,
    affectedTaskIds: taskChanges.filter((change) => change.taskId !== sourceTaskId).map((change) => change.taskId),
    lastChange: { kind: 'task-updated', taskId: sourceTaskId, taskTitle: source.title, changes: [] },
    previousProjectedEndDate: workspace.impact.projectedProjectEndDate,
  })
  return {
    sourceTaskId,
    sourceUpdate,
    taskChanges,
    schedulePreview,
    currentProjectEndDate: workspace.impact.projectedProjectEndDate,
    proposedProjectEndDate: draftWorkspace.impact.projectedProjectEndDate,
    projectEndDeltaDays: differenceInDays(draftWorkspace.impact.projectedProjectEndDate, workspace.impact.projectedProjectEndDate),
    existingConflicts,
    draftConflicts,
    resolvedConflicts,
    remainingConflicts,
    completedManualTaskIds,
    workspace: draftWorkspace,
  }
}

export async function applyTimelineDraftPreview(workspace: ProjectWorkspace, draft: TimelineDraftPreview, port: TimelineDraftApplyPort): Promise<TimelineDraftApplyResult> {
  const sourceWorkspace = await port.updateTask(workspace, draft.sourceTaskId, draft.sourceUpdate)
  const schedulePreview = await port.previewScheduleShift(sourceWorkspace, draft.sourceTaskId)
  if (schedulePreview.taskShifts.length === 0) return { sourceWorkspace, workspace: sourceWorkspace, appliedSchedulePreview: null }
  return {
    sourceWorkspace,
    workspace: await port.applyScheduleShift(sourceWorkspace, schedulePreview, false),
    appliedSchedulePreview: schedulePreview,
  }
}
