import type { ImpactReason } from '../types/impact'
import type { ScheduleShiftPreview } from '../types/schedule'
import type { TaskUpdateRequest } from '../types/task'
import type { ProjectWorkspace } from '../types/workspace'
import { applyExplicitTaskUpdate, applyScheduleShiftPreview, calculateScheduleShiftPreview, differenceInDays, findScheduleConflicts } from './scheduleEngine'
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
  remainingConflicts: ImpactReason[]
  completedManualTaskIds: string[]
  workspace: ProjectWorkspace
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
  const remainingConflicts = findScheduleConflicts(proposedTasks, workspace.dependencies, proposedTasks.map((task) => task.id))
  const completedManualTaskIds = [...new Set(remainingConflicts.flatMap((reason) => reason.affectedTaskIds).filter((taskId) => proposedTasks.find((task) => task.id === taskId)?.status === 'completed'))]
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
