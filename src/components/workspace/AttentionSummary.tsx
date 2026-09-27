import { ArrowUpRight } from 'lucide-react'
import { selectTasksRequiringAttention } from '../../services/taskAttention'
import type { ProjectWorkspace } from '../../types/workspace'
import { formatShortDate } from '../../utils/date'
import { StatusBadge } from '../common/StatusBadge'

export function AttentionSummary({ workspace, onTaskSelect, onShowAll }: { workspace: ProjectWorkspace; onTaskSelect: (taskId: string) => void; onShowAll: () => void }) {
  const attentionTasks = selectTasksRequiringAttention(
    workspace.tasks,
    workspace.impact.affectedTaskIds,
    workspace.impact.criticalTaskIds,
    workspace.currentIssues,
  )
  const visibleTasks = attentionTasks.slice(0, 5)

  return (
    <section className="overflow-hidden rounded-2xl border border-[#e5e3eb] bg-white shadow-panel" data-attention-summary>
      <div className="flex items-start justify-between gap-3 border-b border-[#ebe9ef] px-5 py-4">
        <div><h2 className="text-sm font-bold text-[#302d40]">Требуют внимания</h2><p className="mt-0.5 text-[11px] text-[#918d9b]">Краткая сводка незавершённых проблемных задач</p></div>
        {attentionTasks.length > 0 && <span className="rounded-full bg-[#fff0e8] px-2 py-1 text-[10px] font-bold text-[#b9542f]">{attentionTasks.length}</span>}
      </div>
      {visibleTasks.length === 0 ? <p className="px-5 py-8 text-center text-xs text-[#8f8a98]">Нет незавершённых задач, требующих внимания.</p> : <div className="divide-y divide-[#efedf2]">
        {visibleTasks.map((task) => <button key={task.id} type="button" onClick={() => onTaskSelect(task.id)} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-[#fcfbfd]" data-attention-task={task.id}>
          <span className={`h-2 w-2 shrink-0 rounded-full ${task.riskState === 'at-risk' ? 'bg-rose-500' : 'bg-[#7567e8]'}`} />
          <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-[#464152]">{task.title}</span><span className="mt-0.5 block text-[10px] text-[#9691a0]">до {formatShortDate(task.endDate)}</span></span>
          <StatusBadge status={task.status} risk={task.riskState} />
        </button>)}
      </div>}
      <button type="button" onClick={onShowAll} className="flex w-full items-center justify-center gap-1.5 border-t border-[#ebe9ef] py-3 text-[11px] font-semibold text-[#6658d7] hover:bg-[#faf9ff]">Показать все <ArrowUpRight size={13} /></button>
    </section>
  )
}
