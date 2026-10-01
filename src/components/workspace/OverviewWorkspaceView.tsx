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
  return <>
    <MetricCards workspace={displayWorkspace} />
    <div className="grid items-start gap-4 2xl:grid-cols-[minmax(0,1fr)_330px]">
      <div className="min-w-0 space-y-4">
        <Timeline project={displayWorkspace.project} tasks={displayWorkspace.tasks} dependencies={displayWorkspace.dependencies} assignees={displayWorkspace.assignees} impact={displayWorkspace.impact} currentIssues={displayWorkspace.currentIssues} onTaskSelect={(task) => onTaskSelect(task.id)} onTaskDraft={onTaskDraft} onCreateDependency={onCreateDependency} />
        <TaskList tasks={workspace.tasks} dependencies={workspace.dependencies} assignees={workspace.assignees} affectedTaskIds={workspace.impact.affectedTaskIds} criticalTaskIds={workspace.impact.criticalTaskIds} slackDaysByTaskId={workspace.impact.slackDaysByTaskId} projectedProjectEndDate={workspace.impact.projectedProjectEndDate} currentIssues={workspace.currentIssues} onTaskSelect={(task) => onTaskSelect(task.id)} onTaskCreate={onTaskCreate} />
      </div>
      <ImpactPanel workspace={displayWorkspace} timelineDraft={timelineDraft} onApplyTimelineDraft={onApplyTimelineDraft} onCancelTimelineDraft={onCancelTimelineDraft} onViewWorkload={onViewWorkload} onApplyTaskReassignment={onApplyTaskReassignment} onPreviewScheduleShift={onPreviewScheduleShift} onApplyScheduleShift={onApplyScheduleShift} onTaskSelect={onTaskSelect} requestedPreviewSourceId={requestedPreviewSourceId} onRequestedPreviewHandled={onRequestedPreviewHandled} />
    </div>
  </>
}
