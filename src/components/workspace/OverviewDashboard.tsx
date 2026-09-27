import type { ProjectWorkspace } from '../../types/workspace'
import { AttentionSummary } from './AttentionSummary'
import { LastChangeSummary } from './LastChangeSummary'
import { MetricCards } from './MetricCards'
import { Timeline } from './Timeline'

export function openRisksView(onOpenRisks: () => void) {
  onOpenRisks()
}

export function OverviewDashboard({ workspace, onTaskSelect, onOpenRisks }: { workspace: ProjectWorkspace; onTaskSelect: (taskId: string) => void; onOpenRisks: () => void }) {
  return (
    <div className="space-y-4" data-workspace-view="overview">
      <MetricCards workspace={workspace} />
      <Timeline project={workspace.project} tasks={workspace.tasks} assignees={workspace.assignees} impact={workspace.impact} onTaskSelect={(task) => onTaskSelect(task.id)} compact />
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <AttentionSummary workspace={workspace} onTaskSelect={onTaskSelect} onShowAll={() => openRisksView(onOpenRisks)} />
        <LastChangeSummary workspace={workspace} onOpenDetails={() => openRisksView(onOpenRisks)} compact />
      </div>
    </div>
  )
}
