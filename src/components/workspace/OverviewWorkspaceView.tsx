import { useMemo, useState } from 'react'
import type { ScheduleShiftPreview } from '../../types/schedule'
import type { ProjectWorkspace } from '../../types/workspace'
import type { TaskUpdateRequest } from '../../types/task'
import type { CreateDependencyRequest } from '../../types/dependency'
import { ImpactPanel } from './ImpactPanel'
import { MetricCards } from './MetricCards'
import { TaskList } from './TaskList'
import { Timeline } from './Timeline'
import type { TimelineDraftApplyMode, TimelineDraftPreview } from '../../services/timelineDraft'
import type { TaskReassignmentPreview } from '../../services/taskReassignment'
import { buildTaskPlanRows, filterTaskPlanRows, type TaskPlanFilter } from '../../services/taskPlan'
import { getTodayIsoDate } from '../../utils/date'

export function OverviewWorkspaceView({ workspace, timelineDraft, onTaskSelect, onTaskCreate, onTaskDraft, onApplyTimelineDraft, onCancelTimelineDraft, onViewWorkload, onApplyTaskReassignment, onCreateDependency, onPreviewScheduleShift, onApplyScheduleShift, requestedPreviewSourceId, onRequestedPreviewHandled }: {
  workspace: ProjectWorkspace
  timelineDraft?: TimelineDraftPreview | null
  onTaskSelect: (taskId: string) => void
  onTaskCreate: () => void
  onTaskDraft: (taskId: string, update: TaskUpdateRequest) => void
  onApplyTimelineDraft: (mode: TimelineDraftApplyMode) => Promise<void>
  onCancelTimelineDraft: () => void
  onViewWorkload: () => void
  onApplyTaskReassignment?: (preview: TaskReassignmentPreview) => Promise<void>
  onCreateDependency: (request: CreateDependencyRequest) => Promise<void>
  onPreviewScheduleShift: (sourceTaskId: string) => Promise<ScheduleShiftPreview>
  onApplyScheduleShift: (preview: ScheduleShiftPreview, confirmProjectEndDate: boolean) => Promise<void>
  requestedPreviewSourceId?: string | null
  onRequestedPreviewHandled?: () => void
}) {
  const displayWorkspace = timelineDraft?.userDraftWorkspace ?? workspace
  const [recoveryHighlightedTaskIds, setRecoveryHighlightedTaskIds] = useState<string[]>([])
  const [taskPlanFilter, setTaskPlanFilter] = useState<TaskPlanFilter>('attention')
  const today = getTodayIsoDate()
  const filteredTaskIds = useMemo(() => {
    const rows = buildTaskPlanRows({ tasks: displayWorkspace.tasks, dependencies: displayWorkspace.dependencies, criticalTaskIds: displayWorkspace.impact.criticalTaskIds, slackDaysByTaskId: displayWorkspace.impact.slackDaysByTaskId, currentIssues: displayWorkspace.currentIssues, today })
    return filterTaskPlanRows(rows, taskPlanFilter, displayWorkspace.tasks, displayWorkspace.impact.affectedTaskIds, displayWorkspace.impact.criticalTaskIds, displayWorkspace.currentIssues).map((row) => row.task.id)
  }, [displayWorkspace, taskPlanFilter, today])
  return <>
    <MetricCards workspace={displayWorkspace} />
    <div className="grid items-start gap-4 2xl:grid-cols-[minmax(0,1fr)_330px]">
      <div className="min-w-0 space-y-4">
        <Timeline project={displayWorkspace.project} tasks={displayWorkspace.tasks} dependencies={displayWorkspace.dependencies} assignees={displayWorkspace.assignees} impact={displayWorkspace.impact} currentIssues={displayWorkspace.currentIssues} onTaskSelect={(task) => onTaskSelect(task.id)} onTaskDraft={onTaskDraft} onCreateDependency={onCreateDependency} recoveryHighlightedTaskIds={recoveryHighlightedTaskIds} filterHighlightedTaskIds={filteredTaskIds} filterHighlightActive={taskPlanFilter !== 'all'} />
        <TaskList tasks={displayWorkspace.tasks} dependencies={displayWorkspace.dependencies} assignees={displayWorkspace.assignees} affectedTaskIds={displayWorkspace.impact.affectedTaskIds} criticalTaskIds={displayWorkspace.impact.criticalTaskIds} slackDaysByTaskId={displayWorkspace.impact.slackDaysByTaskId} projectedProjectEndDate={displayWorkspace.impact.projectedProjectEndDate} currentIssues={displayWorkspace.currentIssues} onTaskSelect={(task) => onTaskSelect(task.id)} onTaskCreate={onTaskCreate} selectedFilter={taskPlanFilter} onFilterChange={setTaskPlanFilter} />
      </div>
      <ImpactPanel workspace={displayWorkspace} timelineDraft={timelineDraft} onApplyTimelineDraft={onApplyTimelineDraft} onCancelTimelineDraft={onCancelTimelineDraft} onViewWorkload={onViewWorkload} onApplyTaskReassignment={onApplyTaskReassignment} onShowCriticalChain={setRecoveryHighlightedTaskIds} onPreviewScheduleShift={onPreviewScheduleShift} onApplyScheduleShift={onApplyScheduleShift} onTaskSelect={onTaskSelect} requestedPreviewSourceId={requestedPreviewSourceId} onRequestedPreviewHandled={onRequestedPreviewHandled} />
    </div>
  </>
}
