import { useMemo, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { AlertTriangle, MoreHorizontal, Plus } from 'lucide-react'
import type { Dependency } from '../../types/dependency'
import type { CurrentProjectIssues } from '../../types/impact'
import type { Assignee, ProjectTask } from '../../types/task'
import { buildTaskPlanRows, countTaskPlanFilters, filterTaskPlanRows, type TaskPlanFilter, type TaskPlanRow } from '../../services/taskPlan'
import { getTaskVisualState, taskVisualStateClasses } from '../../services/taskVisualState'
import { formatShortDate, getTodayIsoDate } from '../../utils/date'
import { pluralizeRu } from '../../utils/plural'
import { Avatar } from '../common/Avatar'
import { CriticalTaskBadge } from '../common/CriticalTaskBadge'
import { OverdueTaskBadge } from '../common/OverdueTaskBadge'
import { StatusBadge } from '../common/StatusBadge'
import { TooltipTrigger } from '../common/TooltipTrigger'
import { TruncatedText } from '../common/TruncatedText'
interface TaskListProps {
  tasks: ProjectTask[]
  assignees: Assignee[]
  affectedTaskIds: string[]
  criticalTaskIds: string[]
  slackDaysByTaskId: Record<string, number>
  projectedProjectEndDate: string
  currentIssues: CurrentProjectIssues
  dependencies?: Dependency[]
  today?: string
  onTaskSelect: (task: ProjectTask) => void
  onTaskCreate: () => void
  selectedFilter?: TaskPlanFilter
  onFilterChange?: (filter: TaskPlanFilter) => void
}

const filters: Array<{ id: TaskPlanFilter; label: string }> = [
  { id: 'attention', label: 'Требуют внимания' },
  { id: 'all', label: 'Все' },
  { id: 'critical', label: 'Критические' },
  { id: 'buffer', label: 'С запасом' },
  { id: 'conflicts', label: 'Конфликты' },
  { id: 'overdue', label: 'Просроченные' },
]

function formatSlack(slackDays: number): string {
  if (slackDays < 0) return `Дефицит ${Math.abs(slackDays)} дн.`
  return `${slackDays} ${pluralizeRu(slackDays, ['день', 'дня', 'дней'])}`
}

function TaskBadges({ row, affected, projectedProjectEndDate }: { row: TaskPlanRow; affected: boolean; projectedProjectEndDate: string }) {
  return <>
    {affected && <span className="rounded-full bg-[#fff0e8] px-1.5 py-0.5 text-[9px] font-bold text-[#b9542f]">Затронуто</span>}
    {row.critical && <CriticalTaskBadge slackDays={row.slackDays} projectedProjectEndDate={projectedProjectEndDate} />}
    {row.task.riskState !== 'none' && <span className="rounded-full bg-rose-50 px-1.5 py-0.5 text-[9px] font-bold text-rose-700">Риск</span>}
  </>
}

function TaskConstraint({ row }: { row: TaskPlanRow }) {
  if (row.predecessors.length === 0 || !row.earliestAllowedStart) return <span className="text-[#aaa5b1]">—</span>
  const title = row.predecessors.length === 1 ? `После ${row.predecessors[0].title}` : `После ${row.predecessors.length} задач`
  const content = <div className={`text-[10px] leading-4 ${row.hasScheduleConflict ? 'text-amber-800' : 'text-[#706a79]'}`}>
    <p className="flex items-center gap-1 font-semibold">{row.hasScheduleConflict && <AlertTriangle size={11} aria-hidden="true" />}{title}</p>
    <p>{row.hasScheduleConflict ? 'Можно с' : 'не раньше'} {formatShortDate(row.earliestAllowedStart)}</p>
    {row.hasScheduleConflict && <p>Запланировано {formatShortDate(row.task.startDate)}</p>}
  </div>
  if (row.predecessors.length === 1) return content
  return <TooltipTrigger ariaLabel={`Ограничивающие задачи для «${row.task.title}»`} trigger={<span className="rounded-lg px-1 py-0.5 text-left hover:bg-[#f2eff7]">{content}</span>}>
    <span className="block text-xs font-bold">Ограничивающие задачи</span>
    <span className="mt-1.5 block space-y-1 text-[#dedbe8]">{row.predecessors.map((predecessor) => <span key={predecessor.id} className="block">{predecessor.title} · до {formatShortDate(predecessor.endDate)}</span>)}</span>
    <span className="mt-2 block text-[#dedbe8]">Начать можно не раньше: {formatShortDate(row.earliestAllowedStart)}</span>
  </TooltipTrigger>
}

function openFromKeyboard(event: KeyboardEvent<HTMLElement>, task: ProjectTask, onTaskSelect: (task: ProjectTask) => void) {
  if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault()
    onTaskSelect(task)
  }
}

export function handleTaskPlanRowClick(event: Pick<MouseEvent<HTMLElement>, 'target'>, task: ProjectTask, onTaskSelect: (task: ProjectTask) => void) {
  if (!(event.target as HTMLElement).closest('[data-tooltip-trigger]')) onTaskSelect(task)
}

export function TaskList({ tasks, assignees, affectedTaskIds, criticalTaskIds, slackDaysByTaskId, projectedProjectEndDate, currentIssues, dependencies = [], today = getTodayIsoDate(), onTaskSelect, onTaskCreate, selectedFilter, onFilterChange }: TaskListProps) {
  const [localFilter, setLocalFilter] = useState<TaskPlanFilter>('all')
  const filter = selectedFilter ?? localFilter
  const rows = useMemo(() => buildTaskPlanRows({ tasks, dependencies, criticalTaskIds, slackDaysByTaskId, currentIssues, today }), [tasks, dependencies, criticalTaskIds, slackDaysByTaskId, currentIssues, today])
  const counts = useMemo(() => countTaskPlanFilters(rows, tasks, affectedTaskIds, criticalTaskIds, currentIssues), [rows, tasks, affectedTaskIds, criticalTaskIds, currentIssues])
  const visibleRows = useMemo(() => filterTaskPlanRows(rows, filter, tasks, affectedTaskIds, criticalTaskIds, currentIssues), [rows, filter, tasks, affectedTaskIds, criticalTaskIds, currentIssues])
  const affectedTaskIdSet = new Set(affectedTaskIds)

  return (
    <section className="overflow-hidden rounded-2xl border border-[#e5e3eb] bg-white shadow-panel">
      <div className="border-b border-[#ebe9ef] px-4 py-4 sm:px-5">
        <div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-bold text-[#302d40]">План задач</h2><p className="mt-0.5 text-[11px] text-[#918d9b]">Сроки, состояние и временной запас задач проекта</p></div><button type="button" onClick={onTaskCreate} className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#25223b] px-3 py-2 text-[11px] font-semibold text-white"><Plus size={14} /> Добавить задачу</button></div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Фильтры плана задач">{filters.map((item) => <button key={item.id} type="button" onClick={() => { setLocalFilter(item.id); onFilterChange?.(item.id) }} aria-pressed={filter === item.id} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[10px] font-semibold ${filter === item.id ? 'bg-[#2c2942] text-white' : 'bg-[#f4f2f7] text-[#716b7b] hover:bg-[#ebe8f1]'}`}>{item.label} <span className="opacity-70">{counts[item.id]}</span></button>)}</div>
      </div>

      {tasks.length === 0 ? <p className="px-5 py-10 text-center text-xs text-[#8f8a98]">В проекте пока нет задач. Добавьте первую задачу.</p> : <>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[980px] border-collapse text-left">
            <thead><tr className="bg-[#faf9fb] text-[10px] font-bold uppercase tracking-[.08em] text-[#9b97a4]"><th className="px-5 py-2.5">Задача</th><th className="px-3 py-2.5">Ответственный</th><th className="px-3 py-2.5">Статус</th><th className="px-3 py-2.5">Период</th><th className="px-3 py-2.5">Запас</th><th className="px-3 py-2.5">Ограничение</th><th className="w-10 px-3 py-2.5" /></tr></thead>
            <tbody>{visibleRows.map((row) => {
              const assignee = assignees.find((person) => person.id === row.task.assigneeId)
              const affected = affectedTaskIdSet.has(row.task.id)
              const visualState = getTaskVisualState(row.task, { affected })
              return <tr key={row.task.id} role="button" tabIndex={0} aria-label={`Открыть задачу «${row.task.title}»`} className="group cursor-pointer border-t border-[#efedf2] hover:bg-[#fcfbfd] focus:bg-[#fcfbfd] focus:outline-none" onClick={(event) => handleTaskPlanRowClick(event, row.task, onTaskSelect)} onKeyDown={(event) => openFromKeyboard(event, row.task, onTaskSelect)}>
                <td className="px-5 py-3"><div className="flex items-start gap-2.5"><span data-task-visual-state={visualState} className={`mt-1 h-2 w-2 shrink-0 rounded-full ${taskVisualStateClasses[visualState]}`} /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><TruncatedText
                    text={row.task.title}
                    className="text-xs font-semibold text-[#464152]"
                /><TaskBadges row={row} affected={affected} projectedProjectEndDate={projectedProjectEndDate} /></div>{row.task.changeNote && <p className="mt-0.5 text-[10px] text-[#b26042]">{row.task.changeNote}</p>}</div></div></td>
                <td className="px-3 py-3"><div className="flex items-center gap-2"><Avatar assignee={assignee} size="sm" /><span className="text-[11px] text-[#6f6a79]">{assignee?.name}</span></div></td>
                <td className="px-3 py-3"><div className="flex flex-wrap items-center gap-1.5"><StatusBadge status={row.task.status} risk={row.task.riskState} />{row.overdue && <OverdueTaskBadge overdue={row.overdue} status={row.task.status} />}</div></td>
                <td className="whitespace-nowrap px-3 py-3 text-[11px] font-semibold text-[#696474]">{formatShortDate(row.task.startDate)} — {formatShortDate(row.task.endDate)}</td>
                <td className={`whitespace-nowrap px-3 py-3 text-[11px] font-semibold ${row.slackDays < 0 ? 'text-rose-700' : row.critical ? 'text-[#6658d7]' : 'text-emerald-700'}`}>{formatSlack(row.slackDays)}</td>
                <td className={`px-3 py-3 ${row.hasScheduleConflict ? 'bg-amber-50/70' : ''}`}><TaskConstraint row={row} /></td>
                <td className="px-3 py-3"><button type="button" onClick={(event) => { event.stopPropagation(); onTaskSelect(row.task) }} className="rounded-lg p-1.5 text-[#aaa6b2] opacity-40 group-hover:opacity-100 group-focus:opacity-100" aria-label={`Открыть задачу «${row.task.title}»`}><MoreHorizontal size={16} /></button></td>
              </tr>
            })}</tbody>
          </table>
        </div>

        <div className="divide-y divide-[#efedf2] md:hidden">{visibleRows.map((row) => {
          const assignee = assignees.find((person) => person.id === row.task.assigneeId)
          const affected = affectedTaskIdSet.has(row.task.id)
          const visualState = getTaskVisualState(row.task, { affected })
          return <article key={row.task.id} role="button" tabIndex={0} aria-label={`Открыть задачу «${row.task.title}»`} onClick={(event) => handleTaskPlanRowClick(event, row.task, onTaskSelect)} onKeyDown={(event) => openFromKeyboard(event, row.task, onTaskSelect)} className="cursor-pointer p-4 outline-none hover:bg-[#fcfbfd] focus:bg-[#fcfbfd]">
            <div className="flex items-start gap-2"><span data-task-visual-state={visualState} className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${taskVisualStateClasses[visualState]}`} /><div className="min-w-0 flex-1"><p className="text-xs font-bold text-[#464152]">{row.task.title}</p><div className="mt-1.5 flex flex-wrap items-center gap-1.5"><StatusBadge status={row.task.status} risk={row.task.riskState} /><TaskBadges row={row} affected={affected} projectedProjectEndDate={projectedProjectEndDate} />{row.overdue && <OverdueTaskBadge overdue={row.overdue} status={row.task.status} />}</div></div></div>
            <div className="mt-3 grid gap-2 rounded-xl bg-[#f8f7fa] p-3 text-[10px] leading-4 text-[#706a79]"><p><span className="font-semibold text-[#4f4959]">Период:</span> {formatShortDate(row.task.startDate)} — {formatShortDate(row.task.endDate)}</p><p><span className="font-semibold text-[#4f4959]">Ответственный:</span> {assignee?.name ?? 'Не назначен'}</p><p><span className="font-semibold text-[#4f4959]">Запас:</span> {formatSlack(row.slackDays)}</p><div className="flex items-start gap-1"><span className="font-semibold text-[#4f4959]">Ограничение:</span><TaskConstraint row={row} /></div></div>
          </article>
        })}</div>
        {visibleRows.length === 0 && <p className="px-5 py-8 text-center text-xs text-[#8f8a98]">По выбранному фильтру задач нет.</p>}
      </>}
    </section>
  )
}
