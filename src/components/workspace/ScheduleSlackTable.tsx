import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowUpRight } from 'lucide-react'
import { buildScheduleSlackRows } from '../../services/scheduleSlack'
import type { ProjectWorkspace } from '../../types/workspace'
import { formatFullDate } from '../../utils/date'
import { pluralizeRu } from '../../utils/plural'

type SlackFilter = 'all' | 'critical' | 'buffer' | 'conflicts'

const filters: Array<{ id: SlackFilter; label: string }> = [
  { id: 'all', label: 'Все' },
  { id: 'critical', label: 'Критические' },
  { id: 'buffer', label: 'С запасом' },
  { id: 'conflicts', label: 'Конфликты' },
]

function formatDays(value: number) {
  return `${value} ${pluralizeRu(value, ['день', 'дня', 'дней'])}`
}

export function ScheduleSlackTable({ workspace, onTaskSelect, onOpenRisks }: { workspace: ProjectWorkspace; onTaskSelect: (taskId: string) => void; onOpenRisks: () => void }) {
  const [filter, setFilter] = useState<SlackFilter>('all')
  const rows = useMemo(() => buildScheduleSlackRows(workspace.tasks, workspace.dependencies, workspace.impact.slackDaysByTaskId, workspace.currentIssues), [workspace])
  const visibleRows = rows.filter((row) => (
    filter === 'all'
    || (filter === 'critical' && row.isCritical)
    || (filter === 'buffer' && row.slackDays > 0)
    || (filter === 'conflicts' && row.hasConflict)
  ))

  return (
    <section className="overflow-hidden rounded-2xl border border-[#e5e3eb] bg-white shadow-panel">
      <div className="border-b border-[#ebe9ef] px-5 py-4">
        <h2 className="text-sm font-bold text-[#302d40]">Запас расписания</h2>
        <p className="mt-0.5 text-[11px] text-[#918d9b]">Допустимый сдвиг задач и ограничения их начала по текущему плану.</p>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Фильтры запаса расписания">{filters.map((item) => <button key={item.id} type="button" onClick={() => setFilter(item.id)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[10px] font-semibold ${filter === item.id ? 'bg-[#2c2942] text-white' : 'bg-[#f4f2f7] text-[#716b7b] hover:bg-[#ebe8f1]'}`}>{item.label}</button>)}</div>
      </div>
      {workspace.tasks.length === 0 ? <p className="px-5 py-10 text-center text-xs text-[#8f8a98]">Добавьте задачи, чтобы рассчитать запас расписания.</p> : <>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[820px] border-collapse text-left">
            <thead><tr className="bg-[#faf9fb] text-[10px] font-bold uppercase tracking-[.08em] text-[#9b97a4]"><th className="px-5 py-2.5">Задача</th><th className="px-3 py-2.5">Период</th><th className="px-3 py-2.5">Длительность</th><th className="px-3 py-2.5">Запас</th><th className="px-3 py-2.5">Ограничение</th></tr></thead>
            <tbody>{visibleRows.map((row) => <tr key={row.task.id} className="cursor-pointer border-t border-[#efedf2] hover:bg-[#fcfbfd]" onClick={() => onTaskSelect(row.task.id)}><td className="px-5 py-3 text-xs font-semibold text-[#464152]">{row.task.title}</td><td className="whitespace-nowrap px-3 py-3 text-[11px] text-[#706a79]">{formatFullDate(row.task.startDate)} — {formatFullDate(row.task.endDate)}</td><td className="px-3 py-3 text-[11px] text-[#706a79]">{formatDays(row.task.durationDays)}</td><td className="px-3 py-3 text-[11px] font-semibold text-[#5d5768]">{formatDays(row.slackDays)}{row.isCritical && <span className="ml-1 text-[#6758ce]">· Критическая</span>}</td><td className="px-3 py-3">{row.limitingPredecessor ? <div className="text-[10px] leading-4 text-[#777181]"><p>Ограничивает начало: <strong className="text-[#4f4959]">{row.limitingPredecessor.title}</strong> · до {formatFullDate(row.limitingPredecessor.endDate)}</p><p>Можно начать не раньше: {formatFullDate(row.earliestAllowedStart!)} · запланировано: {formatFullDate(row.task.startDate)}</p><p>Резерв между задачами: {formatDays(row.dependencyBufferDays!)}</p>{row.hasConflict && <button type="button" onClick={(event) => { event.stopPropagation(); onOpenRisks() }} className="mt-1 inline-flex items-center gap-1 font-bold text-[#b55532]">Посмотреть проблему <ArrowUpRight size={11} /></button>}</div> : <span className="text-[11px] text-[#aaa5b1]">—</span>}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="divide-y divide-[#efedf2] md:hidden">{visibleRows.map((row) => <article key={row.task.id} className="p-4"><button type="button" onClick={() => onTaskSelect(row.task.id)} className="w-full text-left"><div className="flex items-start justify-between gap-3"><p className="text-xs font-bold text-[#464152]">{row.task.title}</p><span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-bold ${row.isCritical ? 'bg-[#efedff] text-[#5e50c5]' : 'bg-emerald-50 text-emerald-700'}`}>{formatDays(row.slackDays)}{row.isCritical ? ' · Критическая' : ''}</span></div><p className="mt-2 text-[10px] text-[#777181]">{formatFullDate(row.task.startDate)} — {formatFullDate(row.task.endDate)} · {formatDays(row.task.durationDays)}</p>{row.limitingPredecessor && <div className="mt-2 rounded-lg bg-[#f7f5f9] p-2.5 text-[10px] leading-4 text-[#706a79]"><p>Ограничивает начало: <strong>{row.limitingPredecessor.title}</strong> · до {formatFullDate(row.limitingPredecessor.endDate)}</p><p>Можно начать не раньше: {formatFullDate(row.earliestAllowedStart!)}</p><p>Резерв между задачами: {formatDays(row.dependencyBufferDays!)}</p></div>}</button>{row.hasConflict && <button type="button" onClick={onOpenRisks} className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-[#b55532]"><AlertTriangle size={12} /> Посмотреть проблему</button>}</article>)}</div>
        {visibleRows.length === 0 && <p className="px-5 py-8 text-center text-xs text-[#8f8a98]">По выбранному фильтру задач нет.</p>}
      </>}
    </section>
  )
}
