import type { ImpactReason } from '../types/impact'
import type { ScheduleShiftPreview } from '../types/schedule'
import type { TaskUpdateRequest } from '../types/task'
import type { ProjectWorkspace } from '../types/workspace'
import { applyExplicitTaskUpdate, applyScheduleShiftPreview, calculateScheduleShiftPreview, differenceInDays, findDownstreamTaskIds, findScheduleConflicts } from './scheduleEngine'
import { findDependencyDateConflicts, getTaskEarliestStart, type DependencyDateConflict } from './scheduleRules'
import { rebuildWorkspaceDerivedState } from './workspaceState'
import { addCalendarDays } from '../utils/date'

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
  recommendedSourceUpdate: TaskUpdateRequest
  userTaskChanges: TimelineDraftTaskChange[]
  recommendedTaskChanges: TimelineDraftTaskChange[]
  recommendedSchedulePreview: ScheduleShiftPreview
  currentProjectEndDate: string
  userDraftProjectEndDate: string
  recommendedProjectEndDate: string
  recommendedProjectEndDeltaDays: number
  existingConflicts: TimelineDraftConflict[]
  draftConflicts: TimelineDraftConflict[]
  resolvedConflicts: TimelineDraftConflict[]
  remainingConflicts: ImpactReason[]
  completedManualTaskIds: string[]
  userDraftWorkspace: ProjectWorkspace
  recommendedWorkspace: ProjectWorkspace
}

export type TimelineDraftApplyMode = 'as-is' | 'with-dependency-fix'

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

function collectTaskChanges(current: ProjectWorkspace['tasks'], proposed: ProjectWorkspace['tasks']): TimelineDraftTaskChange[] {
  const proposedById = new Map(proposed.map((task) => [task.id, task]))
  return current.flatMap((task) => {
    const next = proposedById.get(task.id)
    if (!next || (task.startDate === next.startDate && task.endDate === next.endDate)) return []
    return [{ taskId: task.id, currentStartDate: task.startDate, currentEndDate: task.endDate, proposedStartDate: next.startDate, proposedEndDate: next.endDate }]
  })
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
  const explicitlyUpdatedById = new Map(explicitlyUpdatedTasks.map((task) => [task.id, task]))
  const earliestSourceStart = getTaskEarliestStart(sourceTaskId, explicitlyUpdatedById, workspace.dependencies)
  const sourceCorrectionDays = source.status !== 'completed' && earliestSourceStart && updatedSource.startDate < earliestSourceStart
    ? differenceInDays(earliestSourceStart, updatedSource.startDate)
    : 0
  const recommendedSource = sourceCorrectionDays > 0
    ? { ...updatedSource, startDate: earliestSourceStart!, endDate: addCalendarDays(updatedSource.endDate, sourceCorrectionDays) }
    : updatedSource
  const recommendedSourceUpdate: TaskUpdateRequest = {
    ...sourceUpdate,
    startDate: recommendedSource.startDate,
    endDate: recommendedSource.endDate,
  }
  const recommendationBaseTasks = explicitlyUpdatedTasks.map((task) => task.id === sourceTaskId ? recommendedSource : task)
  const recommendedSchedulePreview = calculateScheduleShiftPreview(workspace.project.id, recommendationBaseTasks, workspace.dependencies, sourceTaskId)
  const recommendedTasks = applyScheduleShiftPreview(recommendationBaseTasks, recommendedSchedulePreview)
  const userTaskChanges = collectTaskChanges(workspace.tasks, explicitlyUpdatedTasks)
  const recommendedTaskChanges = collectTaskChanges(explicitlyUpdatedTasks, recommendedTasks)
  const existingConflicts = findDependencyDateConflicts(workspace.tasks, workspace.dependencies).map(mapDraftConflict)
  const proposedConflicts = findDependencyDateConflicts(explicitlyUpdatedTasks, workspace.dependencies).map(mapDraftConflict)
  const existingByKey = new Map(existingConflicts.map((conflict) => [conflict.key, conflict]))
  const proposedByKey = new Map(proposedConflicts.map((conflict) => [conflict.key, conflict]))
  const draftConflicts = proposedConflicts.filter((conflict) => {
    const existing = existingByKey.get(conflict.key)
    return !existing || conflictDatesSignature(existing) !== conflictDatesSignature(conflict)
  })
  const resolvedConflicts = existingConflicts.filter((conflict) => !proposedByKey.has(conflict.key))
  const draftConflictKeys = new Set(draftConflicts.map((conflict) => conflict.key))
  const remainingConflicts = findScheduleConflicts(
    explicitlyUpdatedTasks,
    workspace.dependencies,
    draftConflicts.map((conflict) => conflict.successorTaskId),
  ).filter((reason) => reason.affectedTaskIds.some((successorTaskId) => (
    draftConflictKeys.has(`${reason.sourceTaskId}:${successorTaskId}:finish-to-start`)
  )))
  const downstreamTaskIds = new Set([sourceTaskId, ...findDownstreamTaskIds(sourceTaskId, workspace.dependencies)])
  const completedManualTaskIds = [...new Set(draftConflicts
    .filter((conflict) => downstreamTaskIds.has(conflict.successorTaskId)
      && explicitlyUpdatedTasks.find((task) => task.id === conflict.successorTaskId)?.status === 'completed')
    .map((conflict) => conflict.successorTaskId))]
  const userDraftWorkspace = rebuildWorkspaceDerivedState({ ...workspace, tasks: explicitlyUpdatedTasks }, {
    sourceTaskId,
    affectedTaskIds: findDownstreamTaskIds(sourceTaskId, workspace.dependencies),
    lastChange: { kind: 'task-updated', taskId: sourceTaskId, taskTitle: source.title, changes: [] },
    previousProjectedEndDate: workspace.impact.projectedProjectEndDate,
  })
  const recommendedWorkspace = rebuildWorkspaceDerivedState({ ...workspace, tasks: recommendedTasks }, {
    sourceTaskId,
    affectedTaskIds: recommendedTaskChanges.filter((change) => change.taskId !== sourceTaskId).map((change) => change.taskId),
    lastChange: { kind: 'task-updated', taskId: sourceTaskId, taskTitle: source.title, changes: [] },
    previousProjectedEndDate: workspace.impact.projectedProjectEndDate,
  })
  return {
    sourceTaskId,
    sourceUpdate,
    recommendedSourceUpdate,
    userTaskChanges,
    recommendedTaskChanges,
    recommendedSchedulePreview,
    currentProjectEndDate: workspace.impact.projectedProjectEndDate,
    userDraftProjectEndDate: userDraftWorkspace.impact.projectedProjectEndDate,
    recommendedProjectEndDate: recommendedWorkspace.impact.projectedProjectEndDate,
    recommendedProjectEndDeltaDays: differenceInDays(recommendedWorkspace.impact.projectedProjectEndDate, workspace.impact.projectedProjectEndDate),
    existingConflicts,
    draftConflicts,
    resolvedConflicts,
    remainingConflicts,
    completedManualTaskIds,
    userDraftWorkspace,
    recommendedWorkspace,
  }
}

export async function applyTimelineDraftPreview(workspace: ProjectWorkspace, draft: TimelineDraftPreview, port: TimelineDraftApplyPort, mode: TimelineDraftApplyMode): Promise<TimelineDraftApplyResult> {
  const update = mode === 'with-dependency-fix' ? draft.recommendedSourceUpdate : draft.sourceUpdate
  const sourceWorkspace = await port.updateTask(workspace, draft.sourceTaskId, update)
  if (mode === 'as-is') return { sourceWorkspace, workspace: sourceWorkspace, appliedSchedulePreview: null }
  const schedulePreview = await port.previewScheduleShift(sourceWorkspace, draft.sourceTaskId)
  if (schedulePreview.taskShifts.length === 0) return { sourceWorkspace, workspace: sourceWorkspace, appliedSchedulePreview: null }
  return {
    sourceWorkspace,
    workspace: await port.applyScheduleShift(sourceWorkspace, schedulePreview, false),
    appliedSchedulePreview: schedulePreview,
  }
}
