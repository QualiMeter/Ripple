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
import type { ProjectScenarioDraft } from '../../services/scenario/scenarioTypes'
import { ScenarioBuilder } from './ScenarioBuilder'
import { ScenarioActivePanel } from './ScenarioActivePanel'

export function OverviewWorkspaceView({ workspace, timelineDraft, scenarioDraft, onScenarioCreate, onScenarioCancel, onScenarioApply, onTaskSelect, onTaskCreate, onTaskDraft, onApplyTimelineDraft, onCancelTimelineDraft, onViewWorkload, onApplyTaskReassignment, onCreateDependency, onPreviewScheduleShift, onApplyScheduleShift, requestedPreviewSourceId, onRequestedPreviewHandled }: {
  workspace: ProjectWorkspace
  timelineDraft?: TimelineDraftPreview | null
  scenarioDraft?: ProjectScenarioDraft | null
  onScenarioCreate?: (draft: ProjectScenarioDraft) => void
  onScenarioCancel?: () => void
  onScenarioApply?: () => Promise<void>
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
  const displayWorkspace = scenarioDraft?.scenarioWorkspace ?? timelineDraft?.userDraftWorkspace ?? workspace
  const [recoveryHighlightedTaskIds, setRecoveryHighlightedTaskIds] = useState<string[]>([])
  const [scenarioBuilderOpen, setScenarioBuilderOpen] = useState(false)
  const [recoveryPlanRequestKey, setRecoveryPlanRequestKey] = useState(0)
  const scenarioLockMessage = scenarioDraft ? 'Сначала примените или отмените текущий сценарий.' : undefined
  return <>
    {scenarioBuilderOpen && onScenarioCreate && <ScenarioBuilder workspace={workspace} onClose={() => setScenarioBuilderOpen(false)} onCreate={(draft) => { onScenarioCreate(draft); setScenarioBuilderOpen(false) }} />}
    {scenarioDraft && onScenarioCancel && onScenarioApply && <ScenarioActivePanel workspace={workspace} draft={scenarioDraft} onCancel={onScenarioCancel} onOpenRecovery={() => setRecoveryPlanRequestKey((value) => value + 1)} onApply={onScenarioApply} />}
    <MetricCards workspace={displayWorkspace} />
    <div className="grid items-start gap-4 2xl:grid-cols-[minmax(0,1fr)_330px]">
      <div className="min-w-0 space-y-4">
        <Timeline project={displayWorkspace.project} tasks={displayWorkspace.tasks} dependencies={displayWorkspace.dependencies} assignees={displayWorkspace.assignees} impact={displayWorkspace.impact} currentIssues={displayWorkspace.currentIssues} onTaskSelect={(task) => onTaskSelect(task.id)} onTaskDraft={onTaskDraft} onCreateDependency={onCreateDependency} recoveryHighlightedTaskIds={recoveryHighlightedTaskIds} onOpenScenario={onScenarioCreate ? () => setScenarioBuilderOpen(true) : undefined} scenarioBlocked={Boolean(timelineDraft || scenarioDraft)} interactionLockedMessage={scenarioLockMessage} />
        <TaskList tasks={displayWorkspace.tasks} dependencies={displayWorkspace.dependencies} assignees={displayWorkspace.assignees} affectedTaskIds={displayWorkspace.impact.affectedTaskIds} criticalTaskIds={displayWorkspace.impact.criticalTaskIds} slackDaysByTaskId={displayWorkspace.impact.slackDaysByTaskId} projectedProjectEndDate={displayWorkspace.impact.projectedProjectEndDate} currentIssues={displayWorkspace.currentIssues} onTaskSelect={(task) => { if (!scenarioDraft) onTaskSelect(task.id) }} onTaskCreate={() => { if (!scenarioDraft) onTaskCreate() }} />
      </div>
      <ImpactPanel workspace={displayWorkspace} timelineDraft={timelineDraft} onApplyTimelineDraft={onApplyTimelineDraft} onCancelTimelineDraft={onCancelTimelineDraft} onViewWorkload={scenarioDraft ? undefined : onViewWorkload} onApplyTaskReassignment={scenarioDraft ? undefined : onApplyTaskReassignment} onShowCriticalChain={setRecoveryHighlightedTaskIds} onPreviewScheduleShift={onPreviewScheduleShift} onApplyScheduleShift={onApplyScheduleShift} onTaskSelect={onTaskSelect} requestedPreviewSourceId={requestedPreviewSourceId} onRequestedPreviewHandled={onRequestedPreviewHandled} recoveryPlanRequestKey={recoveryPlanRequestKey} recoveryAnalysisOnly={Boolean(scenarioDraft)} />
    </div>
  </>
}
import { useState } from 'react'
