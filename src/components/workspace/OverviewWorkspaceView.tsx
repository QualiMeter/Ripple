import type { ScheduleShiftPreview } from '../../types/schedule'
import type { ProjectWorkspace } from '../../types/workspace'
import type { TaskUpdateRequest } from '../../types/task'
import type { CreateDependencyRequest } from '../../types/dependency'
import { ImpactPanel } from './ImpactPanel'
import { MetricCards } from './MetricCards'
import { TaskList } from './TaskList'
import { Timeline } from './Timeline'

export function OverviewWorkspaceView({ workspace, onTaskSelect, onTaskCreate, onTaskUpdate, onCreateDependency, onPreviewScheduleShift, onApplyScheduleShift, requestedPreviewSourceId, onRequestedPreviewHandled }: {
  workspace: ProjectWorkspace
  onTaskSelect: (taskId: string) => void
  onTaskCreate: () => void
  onTaskUpdate: (taskId: string, update: TaskUpdateRequest) => Promise<void>
  onCreateDependency: (request: CreateDependencyRequest) => Promise<void>
  onPreviewScheduleShift: (sourceTaskId: string) => Promise<ScheduleShiftPreview>
  onApplyScheduleShift: (preview: ScheduleShiftPreview, confirmProjectEndDate: boolean) => Promise<void>
  requestedPreviewSourceId?: string | null
  onRequestedPreviewHandled?: () => void
}) {
  return <>
    <MetricCards workspace={workspace} />
    <div className="grid items-start gap-4 2xl:grid-cols-[minmax(0,1fr)_330px]">
      <div className="min-w-0 space-y-4">
        <Timeline project={workspace.project} tasks={workspace.tasks} dependencies={workspace.dependencies} assignees={workspace.assignees} impact={workspace.impact} currentIssues={workspace.currentIssues} onTaskSelect={(task) => onTaskSelect(task.id)} onTaskUpdate={onTaskUpdate} onCreateDependency={onCreateDependency} />
        <TaskList tasks={workspace.tasks} dependencies={workspace.dependencies} assignees={workspace.assignees} affectedTaskIds={workspace.impact.affectedTaskIds} criticalTaskIds={workspace.impact.criticalTaskIds} slackDaysByTaskId={workspace.impact.slackDaysByTaskId} projectedProjectEndDate={workspace.impact.projectedProjectEndDate} currentIssues={workspace.currentIssues} onTaskSelect={(task) => onTaskSelect(task.id)} onTaskCreate={onTaskCreate} />
      </div>
      <ImpactPanel workspace={workspace} onPreviewScheduleShift={onPreviewScheduleShift} onApplyScheduleShift={onApplyScheduleShift} onTaskSelect={onTaskSelect} requestedPreviewSourceId={requestedPreviewSourceId} onRequestedPreviewHandled={onRequestedPreviewHandled} />
    </div>
  </>
}
