import type { ProjectWorkspace } from '../../types/workspace'
import { ScheduleSlackTable } from './ScheduleSlackTable'
import { TaskList } from './TaskList'
import { Timeline } from './Timeline'

export function PlanWorkspaceView({ workspace, onTaskSelect, onTaskCreate, onOpenRisks }: { workspace: ProjectWorkspace; onTaskSelect: (taskId: string) => void; onTaskCreate: () => void; onOpenRisks: () => void }) {
  return (
    <div className="space-y-4" data-workspace-view="plan">
      <Timeline project={workspace.project} tasks={workspace.tasks} assignees={workspace.assignees} impact={workspace.impact} onTaskSelect={(task) => onTaskSelect(task.id)} />
      <ScheduleSlackTable workspace={workspace} onTaskSelect={onTaskSelect} onOpenRisks={onOpenRisks} />
      <TaskList tasks={workspace.tasks} assignees={workspace.assignees} affectedTaskIds={workspace.impact.affectedTaskIds} criticalTaskIds={workspace.impact.criticalTaskIds} slackDaysByTaskId={workspace.impact.slackDaysByTaskId} projectedProjectEndDate={workspace.impact.projectedProjectEndDate} currentIssues={workspace.currentIssues} onTaskSelect={(task) => onTaskSelect(task.id)} onTaskCreate={onTaskCreate} showAll onShowAllChange={() => undefined} allowModeToggle={false} />
    </div>
  )
}
