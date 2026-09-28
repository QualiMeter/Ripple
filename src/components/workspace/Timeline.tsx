import { TriangleAlert } from 'lucide-react'
import type { ImpactAnalysis } from '../../types/impact'
import type { Dependency } from '../../types/dependency'
import type { ProjectSummary } from '../../types/project'
import type { Assignee, ProjectTask } from '../../types/task'
import { calendarDaysBetween, formatFullDate, formatShortDate, getTodayIsoDate } from '../../utils/date'
import { getTaskVisualState, taskVisualStateClasses } from '../../services/taskVisualState'
import { analyzeTaskOverdue } from '../../services/deadlineAnalysis'
import { findDependencyDateConflicts } from '../../services/scheduleRules'
import { CriticalTaskBadge } from '../common/CriticalTaskBadge'
import { OverdueTaskBadge } from '../common/OverdueTaskBadge'
import { TooltipTrigger } from '../common/TooltipTrigger'

const dayMs = 86_400_000
const columnCount = 7

function barPosition(task: ProjectTask, rangeStart: number, rangeEnd: number) {
  const range = Math.max(dayMs, rangeEnd - rangeStart)
  const start = Math.max(0, ((Date.parse(task.startDate) - rangeStart) / range) * 100)
  const width = Math.max(2.5, ((Date.parse(task.endDate) - Date.parse(task.startDate) + dayMs) / range) * 100)
  return { left: `${start}%`, width: `${Math.min(width, 100 - start)}%` }
}

export function Timeline({ project, tasks, assignees, impact, dependencies = [], onTaskSelect, today = getTodayIsoDate() }: { project: ProjectSummary; tasks: ProjectTask[]; assignees: Assignee[]; impact: ImpactAnalysis; dependencies?: Dependency[]; onTaskSelect: (task: ProjectTask) => void; today?: string }) {
  const visibleTasks = tasks
  const criticalTaskIds = new Set(impact.criticalTaskIds)
  const dependencyConflicts = findDependencyDateConflicts(tasks, dependencies)
  const conflictsBySuccessorId = new Map<string, typeof dependencyConflicts>()
  dependencyConflicts.forEach((conflict) => {
    conflictsBySuccessorId.set(conflict.successor.id, [...(conflictsBySuccessorId.get(conflict.successor.id) ?? []), conflict]
      .sort((left, right) => right.requiredStartDate.localeCompare(left.requiredStartDate)))
  })
  const startCandidates = [project.startDate, ...tasks.map((task) => task.startDate)]
  const endCandidates = [project.targetEndDate, project.projectedEndDate, ...tasks.map((task) => task.endDate)]
  const rangeStart = Math.min(...startCandidates.map(Date.parse))
  const rangeEnd = Math.max(...endCandidates.map(Date.parse)) + dayMs
  const range = Math.max(dayMs, rangeEnd - rangeStart)
  const todayTimestamp = Date.parse(today)
  const todayPosition = todayTimestamp >= rangeStart && todayTimestamp < rangeEnd
    ? ((todayTimestamp - rangeStart) / range) * 100
    : null
  const columnLabels = Array.from({ length: columnCount }, (_, index) => (
    formatShortDate(new Date(rangeStart + (range * index) / columnCount).toISOString())
  ))
  return (
    <section className="overflow-hidden rounded-2xl border border-[#e5e3eb] bg-white shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#ebe9ef] px-5 py-4">
        <div>
          <h2 className="text-sm font-bold text-[#302d40]">План проекта</h2>
          <p className="mt-0.5 text-[11px] text-[#918d9b]">Критический путь и сдвиг зависимостей</p>
        </div>
        <p className="rounded-lg bg-[#f5f3fa] px-2.5 py-1.5 text-[10px] font-semibold text-[#777181]">Сегодня: {formatFullDate(today)}</p>
      </div>
      {tasks.length === 0 ? <div className="grid min-h-48 place-items-center px-6 py-12 text-center"><div><p className="text-sm font-semibold text-[#4b4658]">В проекте пока нет задач</p><p className="mt-1 text-[11px] text-[#918d9b]">Добавьте задачу, чтобы сформировать план проекта.</p></div></div> : <>
      <div className="overflow-x-auto">
        <div className="relative min-w-[760px]">
          {todayPosition !== null && <div className="pointer-events-none absolute inset-0 z-10 grid grid-cols-[210px_1fr]" aria-label={`Сегодня: ${formatFullDate(today)}`}><span /><span className="relative"><i className="absolute inset-y-0 border-l border-[#e46f42]" style={{ left: `${todayPosition}%` }}><b className="absolute left-0 top-1 -translate-x-1/2 rounded bg-[#fff0e8] px-1.5 py-0.5 text-[8px] font-bold not-italic text-[#b9542f]">Сегодня</b></i></span></div>}
          <div className="grid grid-cols-[210px_1fr] border-b border-[#eeecf1] bg-[#faf9fb]">
            <div className="border-r border-[#eeecf1] px-5 py-2.5 text-[10px] font-bold uppercase tracking-[.1em] text-[#9a96a3]">Задача</div>
            <div className="grid grid-cols-7">
              {columnLabels.map((label, index) => <div key={`${label}-${index}`} className="border-r border-[#eeecf1] px-2 py-2.5 text-center text-[10px] font-semibold text-[#8f8b99] last:border-r-0">{label}</div>)}
            </div>
          </div>
          {visibleTasks.map((task) => {
            const assignee = assignees.find((person) => person.id === task.assigneeId)
            const affected = impact.affectedTaskIds.includes(task.id)
            const visualState = getTaskVisualState(task, { affected })
            const critical = criticalTaskIds.has(task.id)
            const overdue = analyzeTaskOverdue(task, dependencies, today)
            const taskConflicts = conflictsBySuccessorId.get(task.id) ?? []
            const hasScheduleConflict = taskConflicts.length > 0
            const position = barPosition(task, rangeStart, rangeEnd)
            return (
              <div key={task.id} className={`grid grid-cols-[210px_1fr] border-b border-[#f0eef3] last:border-b-0 ${affected ? 'bg-[#fffdfb]' : ''}`}>
                <div role="button" tabIndex={0} onClick={(event) => { if (!(event.target as HTMLElement).closest('[data-tooltip-trigger]')) onTaskSelect(task) }} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onTaskSelect(task) } }} className="flex min-w-0 items-center gap-2.5 border-r border-[#eeecf1] px-5 py-2.5 text-left hover:bg-[#faf9fc]" aria-label={`Редактировать задачу «${task.title}»`}>
                  <span data-task-visual-state={visualState} className={`h-2 w-2 shrink-0 rounded-full ${taskVisualStateClasses[visualState]}`} />
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-1.5"><p className={`truncate text-xs text-[#444051] ${critical ? 'font-bold' : 'font-semibold'}`}>{task.title}</p>{critical && <CriticalTaskBadge slackDays={impact.slackDaysByTaskId[task.id] ?? 0} projectedProjectEndDate={impact.projectedProjectEndDate} className="shrink-0" />}</div>
                    <div className="mt-0.5 flex min-w-0 items-center gap-1.5"><p className="truncate text-[10px] text-[#9a96a3]">{assignee?.name}</p>{overdue && <OverdueTaskBadge overdue={overdue} status={task.status} compact />}</div>
                  </div>
                </div>
                <div className="relative min-h-[48px] bg-[linear-gradient(to_right,#eeecf1_1px,transparent_1px)] bg-[size:14.285%_100%]">
                  <button
                    type="button"
                    onClick={() => onTaskSelect(task)}
                    data-task-visual-state={visualState}
                    data-task-critical={critical || undefined}
                    data-task-schedule-conflict={hasScheduleConflict || undefined}
                    data-task-start-date={task.startDate}
                    data-task-end-date={task.endDate}
                    className={`absolute top-1/2 h-6 -translate-y-1/2 rounded-md text-left ${affected ? 'impact-pulse' : ''} ${overdue ? 'ring-1 ring-inset ring-rose-500' : ''} ${critical ? 'border-[3px] border-[#5548ba]' : 'border border-transparent'} ${hasScheduleConflict ? 'outline outline-2 outline-offset-1 outline-amber-500' : ''} ${taskVisualStateClasses[visualState]}`}
                    style={position}
                    aria-label={`Редактировать задачу «${task.title}»`}
                  />
                  {hasScheduleConflict && <span className="absolute top-1/2 z-20 -translate-y-1/2" style={{ left: `calc(${position.left} + ${position.width} - 9px)` }}>
                    <TooltipTrigger ariaLabel={`Конфликт зависимости для задачи «${task.title}»`} trigger={<span className="grid h-5 w-5 place-items-center rounded-full border border-amber-300 bg-amber-50 text-amber-700 shadow-sm"><TriangleAlert size={12} aria-hidden="true" /></span>}>
                      <span className="block text-xs font-bold">Конфликт зависимости</span>
                      <span className="mt-1.5 block space-y-1 text-[#dedbe8]">{taskConflicts.map((conflict) => <span key={conflict.dependency.id} className="block">Задача начинается {formatFullDate(task.startDate)}. После «{conflict.predecessor.title}» она может начаться не раньше {formatFullDate(conflict.requiredStartDate)}.</span>)}</span>
                    </TooltipTrigger>
                  </span>}
                  {task.id === impact.sourceTaskId && calendarDaysBetween(task.plannedEndDate, task.endDate) > 0 && <span className="absolute right-[2%] top-1/2 -translate-y-1/2 rounded bg-[#fff0e8] px-1.5 py-0.5 text-[9px] font-bold text-[#b9542f]">+{calendarDaysBetween(task.plannedEndDate, task.endDate)} дн.</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <div className="flex items-center gap-5 border-t border-[#ebe9ef] bg-[#faf9fb] px-5 py-2.5 text-[10px] text-[#85818f]">
        <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#e7774d]" /> Затронуто</span>
        <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#df5e64]" /> Под риском</span>
        <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#7768ed]" /> В работе</span>
        <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#aaa5b6]" /> Не в работе</span>
        <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#55ad89]" /> Закончено</span>
      </div>
      </>}
    </section>
  )
}
