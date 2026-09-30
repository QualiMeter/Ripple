import { TriangleAlert } from 'lucide-react'
import type { CurrentProjectIssues, ImpactAnalysis } from '../../types/impact'
import type { Dependency } from '../../types/dependency'
import type { ProjectSummary } from '../../types/project'
import type { Assignee, ProjectTask } from '../../types/task'
import { calendarDaysBetween, formatFullDate, formatShortDate, getTodayIsoDate } from '../../utils/date'
import { getTaskVisualState, taskVisualStateClasses } from '../../services/taskVisualState'
import { analyzeTaskOverdue } from '../../services/deadlineAnalysis'
import { listScheduleConflictPresentations } from '../../services/scheduleConflictPresentation'
import { CriticalTaskBadge } from '../common/CriticalTaskBadge'
import { OverdueTaskBadge } from '../common/OverdueTaskBadge'
import { TooltipTrigger } from '../common/TooltipTrigger'
import { TruncatedText } from '../common/TruncatedText'
import { buildTimelineScale, buildTimelineTickDates, getTimelineBarGeometry, getTimelineDatePosition } from '../../services/timelineLayout'

const columnCount = 7
const timelineRowHeight = 56

export function Timeline({ project, tasks, assignees, impact, currentIssues, dependencies = [], onTaskSelect, today = getTodayIsoDate() }: { project: ProjectSummary; tasks: ProjectTask[]; assignees: Assignee[]; impact: ImpactAnalysis; currentIssues: CurrentProjectIssues; dependencies?: Dependency[]; onTaskSelect: (task: ProjectTask) => void; today?: string }) {
  const visibleTasks = tasks
  const criticalTaskIds = new Set(impact.criticalTaskIds)
  const dependencyConflicts = listScheduleConflictPresentations(currentIssues, tasks, dependencies)
  const conflictsBySuccessorId = new Map<string, typeof dependencyConflicts>()
  dependencyConflicts.forEach((conflict) => {
    conflictsBySuccessorId.set(conflict.successor.id, [...(conflictsBySuccessorId.get(conflict.successor.id) ?? []), conflict]
      .sort((left, right) => right.earliestStartDate.localeCompare(left.earliestStartDate)))
  })
  const scale = buildTimelineScale(project, tasks)
  const geometryByTaskId = new Map(tasks.map((task) => [task.id, getTimelineBarGeometry(task, scale)]))
  const todayPosition = getTimelineDatePosition(today, scale)
  const columnLabels = buildTimelineTickDates(scale, columnCount).map(formatShortDate)
  const conflictDependencyKeys = new Set(dependencyConflicts.map((conflict) => `${conflict.predecessor.id}->${conflict.successor.id}`))
  const taskIndexById = new Map(visibleTasks.map((task, index) => [task.id, index]))
  const dependencyConnectors = dependencies.flatMap((dependency) => {
    const predecessorGeometry = geometryByTaskId.get(dependency.predecessorTaskId)
    const successorGeometry = geometryByTaskId.get(dependency.successorTaskId)
    const predecessorIndex = taskIndexById.get(dependency.predecessorTaskId)
    const successorIndex = taskIndexById.get(dependency.successorTaskId)
    if (!predecessorGeometry || !successorGeometry || predecessorIndex === undefined || successorIndex === undefined) return []
    const startX = (predecessorGeometry.leftPercent + predecessorGeometry.widthPercent) * 10
    const endX = successorGeometry.leftPercent * 10
    const bendX = Math.max(startX + 12, (startX + endX) / 2)
    const startY = predecessorIndex * timelineRowHeight + timelineRowHeight / 2
    const endY = successorIndex * timelineRowHeight + timelineRowHeight / 2
    return [{
      ...dependency,
      path: `M ${startX} ${startY} H ${bendX} V ${endY} H ${endX}`,
      conflict: conflictDependencyKeys.has(`${dependency.predecessorTaskId}->${dependency.successorTaskId}`),
    }]
  })
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
          <div className="relative">
            <svg className="pointer-events-none absolute inset-y-0 left-[210px] right-0 z-[1] h-full w-[calc(100%_-_210px)] overflow-visible" viewBox={`0 0 1000 ${visibleTasks.length * timelineRowHeight}`} preserveAspectRatio="none" aria-label="Зависимости задач">
              <defs>
                <marker id="timeline-dependency-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto" markerUnits="userSpaceOnUse"><path d="M 0 0 L 7 3.5 L 0 7 z" fill="#928c9f" /></marker>
                <marker id="timeline-conflict-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto" markerUnits="userSpaceOnUse"><path d="M 0 0 L 7 3.5 L 0 7 z" fill="#d97706" /></marker>
              </defs>
              {dependencyConnectors.map((connector) => <path key={connector.id} d={connector.path} fill="none" stroke={connector.conflict ? '#d97706' : '#928c9f'} strokeWidth={connector.conflict ? 2.5 : 1.5} strokeDasharray={connector.conflict ? '5 3' : undefined} vectorEffect="non-scaling-stroke" markerEnd={`url(#${connector.conflict ? 'timeline-conflict-arrow' : 'timeline-dependency-arrow'})`} data-dependency-connector="true" data-dependency-conflict={connector.conflict || undefined} />)}
            </svg>
          {visibleTasks.map((task) => {
            const assignee = assignees.find((person) => person.id === task.assigneeId)
            const affected = impact.affectedTaskIds.includes(task.id)
            const visualState = getTaskVisualState(task, { affected })
            const critical = criticalTaskIds.has(task.id)
            const overdue = analyzeTaskOverdue(task, dependencies, today)
            const taskConflicts = conflictsBySuccessorId.get(task.id) ?? []
            const hasScheduleConflict = taskConflicts.length > 0
            const geometry = geometryByTaskId.get(task.id)!
            const position = { left: `${geometry.leftPercent}%`, width: `${geometry.widthPercent}%` }
            return (
              <div key={task.id} className={`grid h-14 grid-cols-[210px_1fr] border-b border-[#f0eef3] last:border-b-0 ${affected ? 'bg-[#fffdfb]' : ''}`}>
                <div role="button" tabIndex={0} onClick={(event) => { if (!(event.target as HTMLElement).closest('[data-tooltip-trigger]')) onTaskSelect(task) }} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onTaskSelect(task) } }} className="relative z-10 flex min-w-0 cursor-pointer items-center gap-2.5 border-r border-[#eeecf1] bg-white px-5 py-2.5 text-left transition hover:bg-[#faf9fc]" aria-label={`Редактировать задачу «${task.title}»`}>
                  <span data-task-visual-state={visualState} className={`h-2 w-2 shrink-0 rounded-full ${taskVisualStateClasses[visualState]}`} />
                  <div className="min-w-0 flex-1  ">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <TruncatedText
                          text={task.title}
                          className={`flex-1 text-xs text-[#444051] ${
                              critical ? 'font-bold' : 'font-semibold'
                          }`}
                      />

                      {critical && (
                          <CriticalTaskBadge
                              slackDays={impact.slackDaysByTaskId[task.id] ?? 0}
                              projectedProjectEndDate={impact.projectedProjectEndDate}
                              className="shrink-0"
                          />
                      )}
                    </div>
                    <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
                      <TruncatedText
                          text={assignee?.name ?? 'Не назначен'}
                          className="text-[10px] text-[#9a96a3]"
                      />
                      {overdue && (
                          <OverdueTaskBadge
                              overdue={overdue}
                              status={task.status}
                              compact
                          />
                      )}
                    </div>
                  </div>
                </div>
                <div className="relative h-14 bg-[linear-gradient(to_right,#eeecf1_1px,transparent_1px)] bg-[size:14.285%_100%]">
                  <button
                    type="button"
                    onClick={() => onTaskSelect(task)}
                    data-task-visual-state={visualState}
                    data-task-critical={critical || undefined}
                    data-task-schedule-conflict={hasScheduleConflict || undefined}
                    data-task-start-date={task.startDate}
                    data-task-end-date={task.endDate}
                    className={`absolute top-1/2 z-10 h-6 -translate-y-1/2 cursor-pointer rounded-md text-left transition hover:brightness-95 focus-visible:ring-2 focus-visible:ring-[#29263e] focus-visible:ring-offset-2 ${affected ? 'impact-pulse' : ''} ${overdue ? 'ring-1 ring-inset ring-rose-500' : ''} ${critical ? 'border-[3px] border-[#5548ba]' : 'border border-transparent'} ${hasScheduleConflict ? 'outline outline-2 outline-offset-1 outline-amber-500' : ''} ${taskVisualStateClasses[visualState]}`}
                    style={position}
                    title={`${formatFullDate(task.startDate)} — ${formatFullDate(task.endDate)}`}
                    aria-label={`Редактировать задачу «${task.title}», ${formatFullDate(task.startDate)} — ${formatFullDate(task.endDate)}`}
                  />
                  {hasScheduleConflict && <span className="absolute top-1/2 z-20 -translate-y-1/2" style={{ left: `calc(${position.left} + ${position.width} - 9px)` }}>
                    <TooltipTrigger ariaLabel={`Конфликт зависимости для задачи «${task.title}»`} trigger={<span className="grid h-5 w-5 place-items-center rounded-full border border-amber-300 bg-amber-50 text-amber-700 shadow-sm"><TriangleAlert size={12} aria-hidden="true" /></span>}>
                      <span className="block text-xs font-bold">Конфликт зависимости</span>
                      <span className="mt-1.5 block space-y-1 text-[#dedbe8]">{taskConflicts.map((conflict) => <span key={`${conflict.predecessor.id}-${conflict.successor.id}`} className="block">Задача начинается {formatFullDate(task.startDate)}. После «{conflict.predecessor.title}» она может начаться не раньше {formatFullDate(conflict.earliestStartDate)}.</span>)}</span>
                    </TooltipTrigger>
                  </span>}
                  {task.id === impact.sourceTaskId && calendarDaysBetween(task.plannedEndDate, task.endDate) > 0 && <span className="absolute right-[2%] top-1/2 -translate-y-1/2 rounded bg-[#fff0e8] px-1.5 py-0.5 text-[9px] font-bold text-[#b9542f]">+{calendarDaysBetween(task.plannedEndDate, task.endDate)} дн.</span>}
                </div>
              </div>
            )
          })}
          </div>
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
