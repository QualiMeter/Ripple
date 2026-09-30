import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Link2, TriangleAlert } from 'lucide-react'
import type { CurrentProjectIssues, ImpactAnalysis } from '../../types/impact'
import type { CreateDependencyRequest, Dependency } from '../../types/dependency'
import type { ProjectSummary } from '../../types/project'
import type { Assignee, ProjectTask, TaskUpdateRequest } from '../../types/task'
import { calendarDaysBetween, formatFullDate, formatMonthDay, getTodayIsoDate } from '../../utils/date'
import { getTaskVisualState, taskVisualStateClasses } from '../../services/taskVisualState'
import { analyzeTaskOverdue } from '../../services/deadlineAnalysis'
import { listScheduleConflictPresentations } from '../../services/scheduleConflictPresentation'
import { CriticalTaskBadge } from '../common/CriticalTaskBadge'
import { OverdueTaskBadge } from '../common/OverdueTaskBadge'
import { TooltipTrigger } from '../common/TooltipTrigger'
import { TruncatedText } from '../common/TruncatedText'
import { buildTimelineColumns, buildTimelineScale, getTimelineBarGeometry, getTimelineDatePosition, getTimelineViewportMetrics, type TimelineScaleMode } from '../../services/timelineLayout'
import { buildTimelineTaskPreview, timelineDragDeltaDays, type TimelineDragMode, type TimelineTaskPreview } from '../../services/timelineInteraction'
import { validateDependency, validateDependencyTasks } from '../../services/dependencyGraph'

const timelineRowHeight = 56
const taskColumnWidth = 210

interface TaskDragState {
  pointerId: number
  task: ProjectTask
  mode: TimelineDragMode
  startX: number
  preview: TimelineTaskPreview
}

interface LinkDragState {
  pointerId: number
  sourceTaskId: string
  endX: number
  endY: number
}

interface TimelineProps {
  project: ProjectSummary
  tasks: ProjectTask[]
  assignees: Assignee[]
  impact: ImpactAnalysis
  currentIssues: CurrentProjectIssues
  dependencies?: Dependency[]
  onTaskSelect: (task: ProjectTask) => void
  onTaskDraft?: (taskId: string, update: TaskUpdateRequest) => void
  onCreateDependency?: (request: CreateDependencyRequest) => Promise<void>
  today?: string
}

export function Timeline({ project, tasks, assignees, impact, currentIssues, dependencies = [], onTaskSelect, onTaskDraft, onCreateDependency, today = getTodayIsoDate() }: TimelineProps) {
  const [scaleMode, setScaleMode] = useState<TimelineScaleMode>('day')
  const [taskPreview, setTaskPreview] = useState<{ taskId: string; value: TimelineTaskPreview } | null>(null)
  const [linkPreview, setLinkPreview] = useState<LinkDragState | null>(null)
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [hoveredDependencyId, setHoveredDependencyId] = useState<string | null>(null)
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null)
  const dragRef = useRef<TaskDragState | null>(null)
  const linkRef = useRef<LinkDragState | null>(null)
  const suppressClickRef = useRef(false)
  const rowsRef = useRef<HTMLDivElement | null>(null)
  const visibleTasks = tasks.map((task) => taskPreview?.taskId === task.id ? { ...task, startDate: taskPreview.value.startDate, endDate: taskPreview.value.endDate } : task)
  const criticalTaskIds = new Set(impact.criticalTaskIds)
  const dependencyConflicts = listScheduleConflictPresentations(currentIssues, tasks, dependencies)
  const conflictsBySuccessorId = new Map<string, typeof dependencyConflicts>()
  dependencyConflicts.forEach((conflict) => {
    conflictsBySuccessorId.set(conflict.successor.id, [...(conflictsBySuccessorId.get(conflict.successor.id) ?? []), conflict]
      .sort((left, right) => right.earliestStartDate.localeCompare(left.earliestStartDate)))
  })
  const scale = buildTimelineScale(project, tasks)
  const viewport = getTimelineViewportMetrics(scale, scaleMode)
  const timelineColumns = buildTimelineColumns(scale, scaleMode)
  const geometryByTaskId = new Map(visibleTasks.map((task) => [task.id, getTimelineBarGeometry(task, scale)]))
  const todayPosition = getTimelineDatePosition(today, scale)
  const conflictDependencyKeys = new Set(dependencyConflicts.map((conflict) => `${conflict.predecessor.id}->${conflict.successor.id}`))
  const taskIndexById = new Map(visibleTasks.map((task, index) => [task.id, index]))
  const dependencyConnectors = dependencies.flatMap((dependency, dependencyIndex) => {
    const predecessorGeometry = geometryByTaskId.get(dependency.predecessorTaskId)
    const successorGeometry = geometryByTaskId.get(dependency.successorTaskId)
    const predecessorIndex = taskIndexById.get(dependency.predecessorTaskId)
    const successorIndex = taskIndexById.get(dependency.successorTaskId)
    if (!predecessorGeometry || !successorGeometry || predecessorIndex === undefined || successorIndex === undefined) return []
    const startX = (predecessorGeometry.leftPercent + predecessorGeometry.widthPercent) * 10
    const endX = successorGeometry.leftPercent * 10
    const laneOffset = (dependencyIndex % 5 - 2) * 3
    const startY = predecessorIndex * timelineRowHeight + timelineRowHeight / 2 + laneOffset
    const endY = successorIndex * timelineRowHeight + timelineRowHeight / 2 + laneOffset
    const routedBendX = endX > startX + 28 ? (startX + endX) / 2 : startX + 18 + (dependencyIndex % 4) * 7
    return [{
      ...dependency,
      path: `M ${startX} ${startY} H ${routedBendX} V ${endY} H ${endX}`,
      conflict: conflictDependencyKeys.has(`${dependency.predecessorTaskId}->${dependency.successorTaskId}`),
    }]
  })
  const activeDependencyIds = new Set(hoveredDependencyId
    ? [hoveredDependencyId]
    : hoveredTaskId
      ? dependencies.filter((dependency) => dependency.predecessorTaskId === hoveredTaskId || dependency.successorTaskId === hoveredTaskId).map((dependency) => dependency.id)
      : [])
  const highlightedTaskIds = new Set(activeDependencyIds.size > 0
    ? dependencies.filter((dependency) => activeDependencyIds.has(dependency.id)).flatMap((dependency) => [dependency.predecessorTaskId, dependency.successorTaskId])
    : [])
  const hasDependencyHighlight = activeDependencyIds.size > 0

  const getRenderedPlotWidth = () => {
    const measuredWidth = (rowsRef.current?.getBoundingClientRect().width ?? 0) - taskColumnWidth
    return measuredWidth > 0 ? measuredWidth : viewport.canvasWidthPx
  }

  const startTaskDrag = (event: ReactPointerEvent<HTMLButtonElement>, task: ProjectTask) => {
    if (!onTaskDraft) return
    const handle = (event.target as HTMLElement).closest<HTMLElement>('[data-resize-handle]')?.dataset.resizeHandle
    const mode: TimelineDragMode = handle === 'start' ? 'resize-start' : handle === 'end' ? 'resize-end' : 'move'
    const preview = buildTimelineTaskPreview(task, mode, 0)
    dragRef.current = { pointerId: event.pointerId, task, mode, startX: event.clientX, preview }
    setTaskPreview({ taskId: task.id, value: preview })
    setMutationError(null)
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const moveTaskDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const deltaDays = timelineDragDeltaDays(event.clientX - drag.startX, getRenderedPlotWidth(), scale.totalDays)
    const preview = buildTimelineTaskPreview(drag.task, drag.mode, deltaDays)
    dragRef.current = { ...drag, preview }
    setTaskPreview({ taskId: drag.task.id, value: preview })
  }

  const finishTaskDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    const changed = drag.preview.startDate !== drag.task.startDate || drag.preview.endDate !== drag.task.endDate
    if (!changed || !onTaskDraft) {
      setTaskPreview(null)
      return
    }
    suppressClickRef.current = true
    try {
      onTaskDraft(drag.task.id, drag.preview.update)
      setMutationError(null)
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : 'Не удалось изменить сроки задачи.')
    }
    setTaskPreview(null)
  }

  const cancelTaskDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    setTaskPreview(null)
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const startLinkDrag = (event: ReactPointerEvent<HTMLButtonElement>, sourceTaskId: string) => {
    if (!onCreateDependency) return
    event.preventDefault()
    event.stopPropagation()
    const rows = rowsRef.current
    const sourceGeometry = geometryByTaskId.get(sourceTaskId)
    const sourceIndex = taskIndexById.get(sourceTaskId)
    if (!rows || !sourceGeometry || sourceIndex === undefined) return
    const state = {
      pointerId: event.pointerId,
      sourceTaskId,
      endX: (sourceGeometry.leftPercent + sourceGeometry.widthPercent) * 10,
      endY: sourceIndex * timelineRowHeight + timelineRowHeight / 2,
    }
    linkRef.current = state
    setLinkPreview(state)
    setMutationError(null)
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const moveLinkDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const link = linkRef.current
    const rows = rowsRef.current
    if (!link || link.pointerId !== event.pointerId || !rows) return
    const bounds = rows.getBoundingClientRect()
    const next = {
      ...link,
      endX: Math.max(0, Math.min(1000, ((event.clientX - bounds.left - taskColumnWidth) / getRenderedPlotWidth()) * 1000)),
      endY: Math.max(0, Math.min(visibleTasks.length * timelineRowHeight, event.clientY - bounds.top)),
    }
    linkRef.current = next
    setLinkPreview(next)
  }

  const finishLinkDrag = async (event: ReactPointerEvent<HTMLButtonElement>) => {
    const link = linkRef.current
    if (!link || link.pointerId !== event.pointerId) return
    linkRef.current = null
    setLinkPreview(null)
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-timeline-task-target]')
    const successorTaskId = target?.dataset.timelineTaskTarget
    if (!successorTaskId || !onCreateDependency) return
    const request: CreateDependencyRequest = { predecessorTaskId: link.sourceTaskId, successorTaskId, type: 'finish-to-start' }
    try {
      validateDependencyTasks(project.id, tasks, request)
      validateDependency(dependencies, request)
      await onCreateDependency(request)
      setMutationError(null)
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : 'Не удалось создать зависимость.')
    }
  }

  const cancelLinkDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const link = linkRef.current
    if (!link || link.pointerId !== event.pointerId) return
    linkRef.current = null
    setLinkPreview(null)
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const selectTaskFromBar = (task: ProjectTask) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    onTaskSelect(task)
  }
  return (
    <section className="overflow-hidden rounded-2xl border border-[#e5e3eb] bg-white shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#ebe9ef] px-5 py-4">
        <div>
          <h2 className="text-sm font-bold text-[#302d40]">План проекта</h2>
          <p className="mt-0.5 text-[11px] text-[#918d9b]">Критический путь и сдвиг зависимостей</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="rounded-xl border border-[#e8e5ed] bg-[#faf9fb] px-3 py-2 text-[10px] leading-4 text-[#777181]" data-project-dates="true"><span className="font-semibold text-[#4d4858]">Начало:</span> {formatMonthDay(project.startDate)}<br /><span className="font-semibold text-[#4d4858]">Окончание:</span> {formatMonthDay(project.targetEndDate)}</div>
          <div className="inline-flex rounded-xl border border-[#dedbe5] bg-white p-1" aria-label="Масштаб плана">{(['day', 'week', 'month'] as const).map((mode) => <button key={mode} type="button" onClick={() => setScaleMode(mode)} aria-pressed={scaleMode === mode} data-timeline-scale={mode} className={`rounded-lg px-2.5 py-1.5 text-[10px] font-bold transition ${scaleMode === mode ? 'bg-[#29263e] text-white' : 'text-[#777181] hover:bg-[#f5f3fa]'}`}>{mode === 'day' ? 'Дни' : mode === 'week' ? 'Недели' : 'Месяцы'}</button>)}</div>
          <p className="rounded-lg bg-[#f5f3fa] px-2.5 py-1.5 text-[10px] font-semibold text-[#777181]">Сегодня: {formatFullDate(today)}</p>
        </div>
      </div>
      {mutationError && <p className="mx-4 mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700" role="alert">{mutationError}</p>}
      {tasks.length === 0 ? <div className="grid min-h-48 place-items-center px-6 py-12 text-center"><div><p className="text-sm font-semibold text-[#4b4658]">В проекте пока нет задач</p><p className="mt-1 text-[11px] text-[#918d9b]">Добавьте задачу, чтобы сформировать план проекта.</p></div></div> : <>
      <div data-timeline-scroll-container="true" className="overflow-x-auto overscroll-x-contain outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#7768ed]" role="region" aria-label="Горизонтальная шкала плана проекта" tabIndex={0}>
        <div className="relative w-full" data-timeline-canvas-width={viewport.canvasWidthPx} data-timeline-content-width={viewport.totalWidthPx} style={{ minWidth: `${viewport.totalWidthPx}px` }}>
          {todayPosition !== null && <div className="pointer-events-none absolute inset-0 z-10 grid" style={{ gridTemplateColumns: `${taskColumnWidth}px minmax(0, 1fr)` }} aria-label={`Сегодня: ${formatFullDate(today)}`}><span /><span className="relative"><i className="absolute inset-y-0 border-l border-[#e46f42]" style={{ left: `${todayPosition}%` }}><b className="absolute left-0 top-1 -translate-x-1/2 rounded bg-[#fff0e8] px-1.5 py-0.5 text-[8px] font-bold not-italic text-[#b9542f]">Сегодня</b></i></span></div>}
          <div className="grid border-b border-[#eeecf1] bg-[#faf9fb]" style={{ gridTemplateColumns: `${taskColumnWidth}px minmax(0, 1fr)` }}>
            <div className="sticky left-0 z-30 border-r border-[#eeecf1] bg-[#faf9fb] px-5 py-2.5 text-[10px] font-bold uppercase tracking-[.1em] text-[#9a96a3]">Задача</div>
            <div className="relative min-h-9" data-timeline-column-count={timelineColumns.length}>
              {timelineColumns.map((column) => <div key={column.key} className="absolute inset-y-0 flex items-center justify-center overflow-hidden border-r border-[#eeecf1] px-1 text-center text-[10px] font-semibold text-[#8f8b99] last:border-r-0" style={{ left: `${column.leftPercent}%`, width: `${column.widthPercent}%` }} data-timeline-column-start={column.startDate}>{column.label}</div>)}
            </div>
          </div>
          <div ref={rowsRef} className="relative">
            <div className="pointer-events-none absolute inset-y-0 z-0" style={{ left: `${taskColumnWidth}px`, width: `calc(100% - ${taskColumnWidth}px)` }} aria-hidden="true">
              {timelineColumns.map((column) => <i key={column.key} className="absolute inset-y-0 border-r border-[#eeecf1]" style={{ left: `${column.leftPercent}%`, width: `${column.widthPercent}%` }} />)}
            </div>
            <svg className="pointer-events-none absolute inset-y-0 z-[1] h-full overflow-visible" style={{ left: `${taskColumnWidth}px`, width: `calc(100% - ${taskColumnWidth}px)` }} viewBox={`0 0 1000 ${visibleTasks.length * timelineRowHeight}`} preserveAspectRatio="none" aria-label="Зависимости задач">
              <defs>
                <marker id="timeline-dependency-arrow" viewBox="0 0 8 6" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M 0 0 L 8 3 L 0 6 z" fill="#625b72" /></marker>
                <marker id="timeline-conflict-arrow" viewBox="0 0 8 6" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M 0 0 L 8 3 L 0 6 z" fill="#d97706" /></marker>
              </defs>
              {dependencyConnectors.map((connector) => {
                const active = activeDependencyIds.has(connector.id)
                const dimmed = hasDependencyHighlight && !active
                const predecessor = visibleTasks.find((task) => task.id === connector.predecessorTaskId)
                const successor = visibleTasks.find((task) => task.id === connector.successorTaskId)
                return <g key={connector.id} opacity={dimmed ? 0.12 : active ? 1 : connector.conflict ? 0.82 : 0.45} className="transition-opacity">
                  <path d={connector.path} fill="none" stroke="white" strokeWidth={connector.conflict ? 6 : active ? 6 : 4} vectorEffect="non-scaling-stroke" pointerEvents="none" />
                  <path d={connector.path} fill="none" stroke={connector.conflict ? '#d97706' : active ? '#4f46b8' : '#625b72'} strokeWidth={connector.conflict ? 3 : active ? 3 : 1.75} strokeDasharray={connector.conflict ? '7 4' : undefined} vectorEffect="non-scaling-stroke" markerEnd={`url(#${connector.conflict ? 'timeline-conflict-arrow' : 'timeline-dependency-arrow'})`} pointerEvents="stroke" onMouseEnter={() => setHoveredDependencyId(connector.id)} onMouseLeave={() => setHoveredDependencyId(null)} data-dependency-connector="true" data-dependency-conflict={connector.conflict || undefined} data-dependency-highlighted={active || undefined}><title>{`${predecessor?.title ?? connector.predecessorTaskId} → ${successor?.title ?? connector.successorTaskId}`}</title></path>
                </g>
              })}
              {linkPreview && (() => {
                const sourceGeometry = geometryByTaskId.get(linkPreview.sourceTaskId)
                const sourceIndex = taskIndexById.get(linkPreview.sourceTaskId)
                if (!sourceGeometry || sourceIndex === undefined) return null
                const startX = (sourceGeometry.leftPercent + sourceGeometry.widthPercent) * 10
                const startY = sourceIndex * timelineRowHeight + timelineRowHeight / 2
                return <path d={`M ${startX} ${startY} L ${linkPreview.endX} ${linkPreview.endY}`} fill="none" stroke="#6d5dfb" strokeWidth="2.5" strokeDasharray="6 4" vectorEffect="non-scaling-stroke" markerEnd="url(#timeline-dependency-arrow)" data-dependency-preview="true" />
              })()}
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
              <div key={task.id} className={`grid h-14 border-b border-[#f0eef3] last:border-b-0 ${affected ? 'bg-[#fffdfb]' : ''}`} style={{ gridTemplateColumns: `${taskColumnWidth}px minmax(0, 1fr)` }}>
                <div role="button" tabIndex={0} onClick={(event) => { if (!(event.target as HTMLElement).closest('[data-tooltip-trigger]')) onTaskSelect(task) }} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onTaskSelect(task) } }} className="sticky left-0 z-30 flex min-w-0 cursor-pointer items-center gap-2.5 border-r border-[#eeecf1] bg-white px-5 py-2.5 text-left transition hover:bg-[#faf9fc]" aria-label={`Редактировать задачу «${task.title}»`}>
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
                <div className="relative h-14">
                  <button
                    type="button"
                    onClick={() => selectTaskFromBar(tasks.find((candidate) => candidate.id === task.id) ?? task)}
                    onPointerDown={(event) => startTaskDrag(event, tasks.find((candidate) => candidate.id === task.id) ?? task)}
                    onPointerMove={moveTaskDrag}
                    onPointerUp={finishTaskDrag}
                    onPointerCancel={cancelTaskDrag}
                    onMouseEnter={() => setHoveredTaskId(task.id)}
                    onMouseLeave={() => setHoveredTaskId(null)}
                    data-task-visual-state={visualState}
                    data-task-critical={critical || undefined}
                    data-task-schedule-conflict={hasScheduleConflict || undefined}
                    data-timeline-task-target={task.id}
                    data-task-start-date={task.startDate}
                    data-task-end-date={task.endDate}
                    data-dependency-highlighted={highlightedTaskIds.has(task.id) || undefined}
                    data-dependency-dimmed={hasDependencyHighlight && !highlightedTaskIds.has(task.id) || undefined}
                    className={`group absolute top-1/2 z-10 h-6 touch-none -translate-y-1/2 cursor-grab rounded-md text-left transition hover:brightness-95 active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-[#29263e] focus-visible:ring-offset-2 ${affected ? 'impact-pulse' : ''} ${overdue ? 'ring-1 ring-inset ring-rose-500' : ''} ${critical ? 'border-[3px] border-[#5548ba]' : 'border border-transparent'} ${highlightedTaskIds.has(task.id) ? 'drop-shadow-[0_0_5px_rgba(79,70,184,0.75)]' : hasDependencyHighlight ? 'opacity-45' : ''} ${taskVisualStateClasses[visualState]}`}
                    style={position}
                    title={`${formatFullDate(task.startDate)} — ${formatFullDate(task.endDate)}`}
                    aria-label={`Редактировать задачу «${task.title}», ${formatFullDate(task.startDate)} — ${formatFullDate(task.endDate)}`}
                  >
                    {onTaskDraft && <><span data-resize-handle="start" className="absolute inset-y-0 left-0 w-2 cursor-ew-resize rounded-l-md bg-white/0 transition group-hover:bg-white/35" aria-hidden="true" /><span data-resize-handle="end" className="absolute inset-y-0 right-0 w-2 cursor-ew-resize rounded-r-md bg-white/0 transition group-hover:bg-white/35" aria-hidden="true" /></>}
                    {taskPreview?.taskId === task.id && <span className="pointer-events-none absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#29263e] px-2 py-1 text-[9px] font-bold text-white shadow-lg">{formatFullDate(task.startDate)} — {formatFullDate(task.endDate)}</span>}
                  </button>
                  {onCreateDependency && <button type="button" data-dependency-handle={task.id} onPointerDown={(event) => startLinkDrag(event, task.id)} onPointerMove={moveLinkDrag} onPointerUp={(event) => { void finishLinkDrag(event) }} onPointerCancel={cancelLinkDrag} className="absolute top-1/2 z-20 grid h-4 w-4 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-[#6d5dfb] text-white shadow-sm transition hover:scale-110" style={{ left: `calc(${position.left} + ${position.width} - 5px)` }} aria-label={`Создать зависимость от задачи «${task.title}»`} title="Протяните к другой задаче"><Link2 size={9} aria-hidden="true" /></button>}
                  {hasScheduleConflict && <span className="absolute top-0 z-20 -translate-y-1/3" style={{ left: `calc(${position.left} + ${position.width} - 9px)` }}>
                    <TooltipTrigger ariaLabel={`Конфликт зависимости для задачи «${task.title}»`} trigger={<span className="grid h-5 w-5 place-items-center rounded-full border border-amber-300 bg-amber-50 text-amber-700 shadow-sm"><TriangleAlert size={12} aria-hidden="true" /></span>}>
                      <span className="block text-xs font-bold">Конфликт зависимости</span>
                      <span className="mt-1.5 block space-y-1 text-[#dedbe8]">{taskConflicts.map((conflict) => <span key={`${conflict.predecessor.id}-${conflict.successor.id}`} className="block"><span className="block">Зависимая задача: {conflict.successor.title}</span><span className="block">Предшественник: {conflict.predecessor.title}</span><span className="block">Текущее начало: {formatFullDate(conflict.successor.startDate)}</span><span className="block">Предшественник завершается: {formatFullDate(conflict.predecessor.endDate)}</span><span className="block">Можно начать не раньше: {formatFullDate(conflict.earliestStartDate)}</span></span>)}</span>
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
