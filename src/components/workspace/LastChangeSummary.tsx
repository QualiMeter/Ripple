import { ArrowDown, ArrowRight } from 'lucide-react'
import { describeLastChange } from '../../services/changeContext'
import type { ProjectWorkspace } from '../../types/workspace'

interface LastChangeSummaryProps {
  workspace: ProjectWorkspace
  onOpenDetails?: () => void
  compact?: boolean
}

function formatShift(days: number): string {
  if (days > 0) return `+${days} дн.`
  if (days < 0) return `${days} дн.`
  return 'без изменений'
}

export function LastChangeSummary({ workspace, onOpenDetails, compact = false }: LastChangeSummaryProps) {
  const { impact } = workspace
  const change = describeLastChange(impact.lastChange, workspace.tasks, workspace.assignees)
  return (
    <section className="rounded-2xl border border-[#e5e2ea] bg-white p-4 shadow-panel" aria-labelledby="last-change-title">
      <p id="last-change-title" className="text-[10px] font-bold uppercase tracking-[.09em] text-[#918b9b]">Последнее изменение</p>
      <div className={`mt-3 ${compact ? '' : 'sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-5'}`}>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-[#373244]">{change.title}</p>
          <div className="mt-1 space-y-0.5 text-[11px] text-[#7e7889]">{change.details.map((detail) => <p key={detail}>{detail}</p>)}</div>
        </div>
        <ArrowDown size={15} className="my-2 text-[#c2bdca] sm:hidden" />
        {!compact && <ArrowRight size={17} className="hidden text-[#c2bdca] sm:block" />}
        <div className={`${compact ? 'mt-3' : ''} flex flex-wrap gap-2 text-[10px]`}>
          <span className="rounded-lg bg-[#fff2e9] px-2.5 py-1.5 font-semibold text-[#a9512e]">Затронуто: {impact.affectedTaskIds.length}</span>
          <span className="rounded-lg bg-[#f1efff] px-2.5 py-1.5 font-semibold text-[#5e50c5]">Срок проекта: {formatShift(impact.projectEndChangeDays)}</span>
          <span className="rounded-lg bg-[#f5f3f8] px-2.5 py-1.5 font-semibold text-[#696374]">Критические: {impact.criticalTaskIds.length}</span>
        </div>
      </div>
      {onOpenDetails && <button type="button" onClick={onOpenDetails} className="mt-3 text-[11px] font-bold text-[#6557d4] hover:text-[#4d40bc]">Подробнее</button>}
    </section>
  )
}
