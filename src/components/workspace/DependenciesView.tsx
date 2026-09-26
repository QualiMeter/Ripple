import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react'
import {
  ArrowRight,
  GitBranch,
  Link2,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import { isDependencyInImpactPath } from '../../services/impactPath'
import type { CreateDependencyRequest, Dependency } from '../../types/dependency'
import type { ImpactAnalysis } from '../../types/impact'
import type { Assignee, ProjectTask } from '../../types/task'
import { Avatar } from '../common/Avatar'
import { StatusBadge } from '../common/StatusBadge'

interface DependenciesViewProps {
  tasks: ProjectTask[]
  dependencies: Dependency[]
  assignees: Assignee[]
  impact: ImpactAnalysis
  onTaskSelect: (task: ProjectTask) => void
  onCreateDependency: (request: CreateDependencyRequest) => Promise<void>
  onDeleteDependency: (dependencyId: string) => Promise<void>
  onTaskCreate: () => void
}

interface Point {
  x: number
  y: number
}

interface Camera extends Point {
  scale: number
}

const nodeWidth = 224
const nodeHeight = 116
const columnGap = 92
const rowGap = 36
const graphPadding = 32
const minScale = 0.45
const maxScale = 1.6

function buildAutomaticPositions(tasks: ProjectTask[], dependencies: Dependency[]): Map<string, Point> {
  const levelByTaskId = new Map(tasks.map((task) => [task.id, 0]))

  for (let iteration = 0; iteration < tasks.length; iteration += 1) {
    let changed = false
    dependencies.forEach((dependency) => {
      const predecessorLevel = levelByTaskId.get(dependency.predecessorTaskId) ?? 0
      const successorLevel = levelByTaskId.get(dependency.successorTaskId) ?? 0
      if (successorLevel <= predecessorLevel) {
        levelByTaskId.set(dependency.successorTaskId, predecessorLevel + 1)
        changed = true
      }
    })
    if (!changed) break
  }

  const tasksByLevel = new Map<number, ProjectTask[]>()
  tasks.forEach((task) => {
    const level = levelByTaskId.get(task.id) ?? 0
    tasksByLevel.set(level, [...(tasksByLevel.get(level) ?? []), task])
  })

  const positions = new Map<string, Point>()
  tasksByLevel.forEach((levelTasks, level) => {
    levelTasks.forEach((task, row) => {
      positions.set(task.id, {
        x: graphPadding + level * (nodeWidth + columnGap),
        y: graphPadding + row * (nodeHeight + rowGap),
      })
    })
  })
  return positions
}

function readStoredPositions(storageKey: string, automaticPositions: Map<string, Point>): Map<string, Point> | null {
  try {
    const value = sessionStorage.getItem(storageKey)
    if (!value) return null
    const stored = JSON.parse(value) as Record<string, Point>
    return new Map([...automaticPositions].map(([taskId, automaticPosition]) => [
      taskId,
      stored[taskId] ?? automaticPosition,
    ]))
  } catch {
    return null
  }
}

function storePositions(storageKey: string, positions: Map<string, Point>) {
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(positions)))
  } catch {
    // Session storage is optional; graph interaction still works without it.
  }
}

function clampScale(scale: number) {
  return Math.min(maxScale, Math.max(minScale, scale))
}

function getConnectorPoints(from: Point, to: Point) {
  const fromCenter = { x: from.x + nodeWidth / 2, y: from.y + nodeHeight / 2 }
  const toCenter = { x: to.x + nodeWidth / 2, y: to.y + nodeHeight / 2 }
  const horizontal = Math.abs(toCenter.x - fromCenter.x) >= Math.abs(toCenter.y - fromCenter.y)

  if (horizontal) {
    const movingRight = toCenter.x >= fromCenter.x
    return {
      start: { x: movingRight ? from.x + nodeWidth : from.x, y: fromCenter.y },
      end: { x: movingRight ? to.x : to.x + nodeWidth, y: toCenter.y },
      horizontal: true,
    }
  }

  const movingDown = toCenter.y >= fromCenter.y
  return {
    start: { x: fromCenter.x, y: movingDown ? from.y + nodeHeight : from.y },
    end: { x: toCenter.x, y: movingDown ? to.y : to.y + nodeHeight },
    horizontal: false,
  }
}

function getEdgePath(from: Point, to: Point) {
  const { start, end, horizontal } = getConnectorPoints(from, to)
  if (horizontal) {
    const controlX = Math.max(36, Math.abs(end.x - start.x) / 2)
    const direction = end.x >= start.x ? 1 : -1
    return `M ${start.x} ${start.y} C ${start.x + controlX * direction} ${start.y}, ${end.x - controlX * direction} ${end.y}, ${end.x} ${end.y}`
  }
  const controlY = Math.max(36, Math.abs(end.y - start.y) / 2)
  const direction = end.y >= start.y ? 1 : -1
  return `M ${start.x} ${start.y} C ${start.x} ${start.y + controlY * direction}, ${end.x} ${end.y - controlY * direction}, ${end.x} ${end.y}`
}

export function DependenciesView({
  tasks,
  dependencies,
  assignees,
  impact,
  onTaskSelect,
  onCreateDependency,
  onDeleteDependency,
  onTaskCreate,
}: DependenciesViewProps) {
  const projectId = tasks[0]?.projectId ?? 'empty-project'
  const storageKey = `ripple:dependency-layout:${projectId}`
  const automaticPositions = useMemo(
    () => buildAutomaticPositions(tasks, dependencies),
    [tasks, dependencies],
  )
  const [positions, setPositions] = useState<Map<string, Point>>(
    () => readStoredPositions(storageKey, automaticPositions) ?? automaticPositions,
  )
  const [camera, setCamera] = useState<Camera>({ x: 24, y: 24, scale: 1 })
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [predecessorTaskId, setPredecessorTaskId] = useState(tasks[0]?.id ?? '')
  const [successorTaskId, setSuccessorTaskId] = useState(tasks[1]?.id ?? tasks[0]?.id ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [deletingDependencyId, setDeletingDependencyId] = useState<string | null>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const positionsRef = useRef(positions)
  const dragRef = useRef<{
    taskId: string
    pointerId: number
    start: Point
    origin: Point
    moved: boolean
  } | null>(null)
  const panRef = useRef<{ pointerId: number; start: Point; origin: Point } | null>(null)
  const suppressClickRef = useRef(false)
  const taskById = new Map(tasks.map((task) => [task.id, task]))
  const affectedTaskIdSet = new Set(impact.affectedTaskIds)

  const fitToView = useCallback((nextPositions: Map<string, Point>) => {
    const viewport = viewportRef.current
    if (!viewport || nextPositions.size === 0) return
    const points = [...nextPositions.values()]
    const minX = Math.min(...points.map((point) => point.x))
    const minY = Math.min(...points.map((point) => point.y))
    const maxX = Math.max(...points.map((point) => point.x + nodeWidth))
    const maxY = Math.max(...points.map((point) => point.y + nodeHeight))
    const padding = 54
    const scale = clampScale(Math.min(
      (viewport.clientWidth - padding * 2) / Math.max(nodeWidth, maxX - minX),
      (viewport.clientHeight - padding * 2) / Math.max(nodeHeight, maxY - minY),
      1,
    ))
    setCamera({
      scale,
      x: (viewport.clientWidth - (minX + maxX) * scale) / 2,
      y: (viewport.clientHeight - (minY + maxY) * scale) / 2,
    })
  }, [])

  useEffect(() => {
    positionsRef.current = positions
  }, [positions])

  useEffect(() => {
    const nextPositions = readStoredPositions(storageKey, automaticPositions) ?? automaticPositions
    positionsRef.current = nextPositions
    setPositions(nextPositions)
    const frame = requestAnimationFrame(() => fitToView(nextPositions))
    return () => cancelAnimationFrame(frame)
  }, [automaticPositions, fitToView, storageKey])

  const updateScale = (nextScale: number, center?: Point) => {
    const scale = clampScale(nextScale)
    const viewport = viewportRef.current
    const zoomCenter = center ?? {
      x: (viewport?.clientWidth ?? 0) / 2,
      y: (viewport?.clientHeight ?? 0) / 2,
    }
    setCamera((current) => ({
      scale,
      x: zoomCenter.x - (zoomCenter.x - current.x) * (scale / current.scale),
      y: zoomCenter.y - (zoomCenter.y - current.y) * (scale / current.scale),
    }))
  }

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    const bounds = event.currentTarget.getBoundingClientRect()
    updateScale(camera.scale * (event.deltaY > 0 ? 0.9 : 1.1), {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    })
  }

  const handleCanvasPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    panRef.current = {
      pointerId: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      origin: { x: camera.x, y: camera.y },
    }
  }

  const handleCanvasPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (panRef.current?.pointerId !== event.pointerId) return
    setCamera((current) => ({
      ...current,
      x: panRef.current!.origin.x + event.clientX - panRef.current!.start.x,
      y: panRef.current!.origin.y + event.clientY - panRef.current!.start.y,
    }))
  }

  const stopPanning = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (panRef.current?.pointerId !== event.pointerId) return
    panRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handleNodePointerDown = (event: ReactPointerEvent<HTMLButtonElement>, taskId: string) => {
    if (event.button !== 0) return
    event.stopPropagation()
    const origin = positionsRef.current.get(taskId)
    if (!origin) return
    setSelectedTaskId(taskId)
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      taskId,
      pointerId: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      origin,
      moved: false,
    }
  }

  const handleNodePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const dx = (event.clientX - drag.start.x) / camera.scale
    const dy = (event.clientY - drag.start.y) / camera.scale
    drag.moved = drag.moved || Math.hypot(dx, dy) > 3
    if (!drag.moved) return
    setPositions((current) => {
      const next = new Map(current)
      next.set(drag.taskId, { x: drag.origin.x + dx, y: drag.origin.y + dy })
      positionsRef.current = next
      return next
    })
  }

  const handleNodePointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    if (drag.moved) {
      suppressClickRef.current = true
      storePositions(storageKey, positionsRef.current)
    }
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handleNodeClick = (task: ProjectTask) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    setSelectedTaskId(task.id)
    onTaskSelect(task)
  }

  const resetLayout = () => {
    try {
      sessionStorage.removeItem(storageKey)
    } catch {
      // Reset still applies in memory when session storage is unavailable.
    }
    positionsRef.current = automaticPositions
    setPositions(automaticPositions)
    fitToView(automaticPositions)
  }

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setIsSaving(true)
    try {
      await onCreateDependency({ predecessorTaskId, successorTaskId, type: 'finish-to-start' })
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Не удалось создать зависимость.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (dependencyId: string) => {
    setError(null)
    setDeletingDependencyId(dependencyId)
    try {
      await onDeleteDependency(dependencyId)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Не удалось удалить зависимость.')
    } finally {
      setDeletingDependencyId(null)
    }
  }

  if (tasks.length === 0) {
    return <section className="rounded-2xl border border-[#e5e3eb] bg-white px-6 py-16 text-center shadow-panel"><GitBranch size={24} className="mx-auto text-[#8378dd]" /><p className="mt-3 text-sm font-semibold text-[#4b4658]">Добавьте задачи, чтобы настроить зависимости</p><p className="mt-1 text-[11px] text-[#918d9b]">Граф появится после создания первой задачи.</p><button type="button" onClick={onTaskCreate} className="mt-4 rounded-xl bg-[#6d5dfb] px-4 py-2.5 text-xs font-bold text-white">Добавить задачу</button></section>
  }

  return (
    <div className="grid items-start gap-4 2xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="overflow-hidden rounded-2xl border border-[#e5e3eb] bg-white shadow-panel">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ebe9ef] px-5 py-4">
          <div>
            <h2 className="text-sm font-bold text-[#302d40]">Граф зависимостей</h2>
            <p className="mt-0.5 text-[11px] text-[#817c8c]">Перетаскивайте задачи · колесо изменяет масштаб · фон перемещает граф</p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-[11px] text-[#716c7a]">
            <span className="flex items-center gap-1.5"><i className="h-0.5 w-5 rounded-full bg-[#777282]" /> Зависимость</span>
            <span className="flex items-center gap-1.5"><i className="h-0.5 w-5 rounded-full bg-[#e46f42]" /> Цепочка изменения</span>
            <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded border border-[#e7774d] bg-[#fff0e8]" /> Затронутая задача</span>
            <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#df5e64]" /> Под риском</span>
          </div>
        </div>
        <div className="relative">
          <div
            ref={viewportRef}
            className="relative h-[620px] touch-none overflow-hidden bg-[#faf9fb] cursor-grab active:cursor-grabbing"
            style={{
              backgroundImage: 'radial-gradient(circle, #d9d6df 1px, transparent 1px)',
              backgroundSize: `${22 * camera.scale}px ${22 * camera.scale}px`,
              backgroundPosition: `${camera.x}px ${camera.y}px`,
            }}
            onWheel={handleWheel}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={stopPanning}
            onPointerCancel={stopPanning}
            aria-label="Интерактивный граф зависимостей"
          >
            <div
              className="absolute left-0 top-0"
              style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`, transformOrigin: '0 0' }}
            >
              <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width="1" height="1" aria-hidden="true">
                <defs>
                  <marker id="dependency-arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9 Z" fill="#777282" /></marker>
                  <marker id="dependency-arrow-affected" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9 Z" fill="#e46f42" /></marker>
                </defs>
                {dependencies.map((dependency) => {
                  const from = positions.get(dependency.predecessorTaskId)
                  const to = positions.get(dependency.successorTaskId)
                  if (!from || !to) return null
                  const highlighted = isDependencyInImpactPath(
                    dependency,
                    impact.sourceTaskId,
                    impact.affectedTaskIds,
                  )
                  return (
                    <path
                      key={dependency.id}
                      d={getEdgePath(from, to)}
                      fill="none"
                      stroke={highlighted ? '#e46f42' : '#777282'}
                      strokeWidth={highlighted ? 3 : 2}
                      strokeOpacity={highlighted ? 1 : 0.82}
                      markerEnd={`url(#${highlighted ? 'dependency-arrow-affected' : 'dependency-arrow'})`}
                    />
                  )
                })}
              </svg>

              {tasks.map((task) => {
                const position = positions.get(task.id)
                if (!position) return null
                const assignee = assignees.find((candidate) => candidate.id === task.assigneeId)
                const affected = affectedTaskIdSet.has(task.id)
                const atRisk = task.riskState === 'at-risk'
                const selected = selectedTaskId === task.id
                return (
                  <button
                    key={task.id}
                    type="button"
                    onPointerDown={(event) => handleNodePointerDown(event, task.id)}
                    onPointerMove={handleNodePointerMove}
                    onPointerUp={handleNodePointerUp}
                    onPointerCancel={handleNodePointerUp}
                    onClick={() => handleNodeClick(task)}
                    className={`absolute cursor-grab select-none rounded-2xl border bg-white p-3 text-left shadow-panel transition-[border-color,box-shadow,transform] hover:z-10 hover:-translate-y-0.5 hover:border-[#7568de] hover:shadow-lg active:cursor-grabbing ${affected ? 'border-[#e7774d]' : atRisk ? 'border-[#e7a9ac]' : 'border-[#d6d3dd]'} ${selected ? 'z-10 outline outline-2 outline-offset-2 outline-[#6d5dfb]' : ''}`}
                    style={{ left: position.x, top: position.y, width: nodeWidth, height: nodeHeight }}
                    aria-label={`Открыть задачу «${task.title}»`}
                  >
                    {affected && <span className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-[#e7774d]" aria-hidden="true" />}
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-2 text-xs font-bold leading-4 text-[#403b4d]">{task.title}</p>
                      {affected && <span className="shrink-0 rounded-full bg-[#fff0e8] px-1.5 py-0.5 text-[8px] font-bold text-[#b9542f]">Затронуто</span>}
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1.5"><Avatar assignee={assignee} size="sm" /><span className="truncate text-[10px] text-[#6f6a78]">{assignee?.name}</span></div>
                      <StatusBadge status={task.status} risk={task.riskState} />
                    </div>
                    <p className={`mt-2 flex items-center gap-1.5 text-[9px] font-bold ${atRisk ? 'text-[#c55359]' : task.riskState === 'watch' ? 'text-[#a56d28]' : 'text-[#777280]'}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${atRisk ? 'bg-[#df5e64]' : task.riskState === 'watch' ? 'bg-[#d99a45]' : 'bg-[#aaa5b2]'}`} />
                      {atRisk ? 'Под риском' : task.riskState === 'watch' ? 'Требует наблюдения' : 'Рисков нет'}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="absolute bottom-4 left-4 flex items-center gap-1 rounded-xl border border-[#dedbe5] bg-white/95 p-1 shadow-lg backdrop-blur">
            <button type="button" onClick={() => updateScale(camera.scale * 0.85)} className="grid h-8 w-8 place-items-center rounded-lg text-[#625d6c] transition hover:bg-[#f1eff5]" aria-label="Уменьшить масштаб"><Minus size={15} /></button>
            <span className="w-11 text-center text-[10px] font-semibold text-[#77717f]">{Math.round(camera.scale * 100)}%</span>
            <button type="button" onClick={() => updateScale(camera.scale * 1.15)} className="grid h-8 w-8 place-items-center rounded-lg text-[#625d6c] transition hover:bg-[#f1eff5]" aria-label="Увеличить масштаб"><Plus size={15} /></button>
            <span className="mx-1 h-5 w-px bg-[#e3e0e8]" />
            <button type="button" onClick={() => fitToView(positionsRef.current)} className="grid h-8 w-8 place-items-center rounded-lg text-[#625d6c] transition hover:bg-[#f1eff5]" aria-label="Показать весь граф"><Maximize2 size={15} /></button>
          </div>
          <button type="button" onClick={resetLayout} className="absolute bottom-4 right-4 flex h-10 items-center gap-2 rounded-xl border border-[#dedbe5] bg-white/95 px-3 text-[11px] font-semibold text-[#5e5968] shadow-lg backdrop-blur transition hover:border-[#c9c4d3] hover:bg-white" aria-label="Сбросить расположение задач"><RotateCcw size={14} /> Сбросить расположение</button>
        </div>
      </section>

      <aside className="space-y-4">
        <section className="rounded-2xl border border-[#e5e3eb] bg-white p-4 shadow-panel">
          <div className="flex items-center gap-2.5"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#eeeaff] text-[#6657dc]"><Link2 size={16} /></span><div><h2 className="text-sm font-bold text-[#343044]">Новая зависимость</h2><p className="text-[10px] text-[#938e9c]">Тип связи: finish-to-start</p></div></div>
          <form className="mt-4 space-y-3" onSubmit={handleCreate}>
            <label className="block text-[11px] font-semibold text-[#686374]">Предшественник<select value={predecessorTaskId} onChange={(event) => setPredecessorTaskId(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#dfdde5] bg-white px-3 py-2.5 text-xs text-[#413d4e] outline-none focus:border-[#7667ed]">{tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label>
            <div className="flex items-center gap-2 text-[10px] font-semibold text-[#9a95a3]"><span className="h-px flex-1 bg-[#ebe9ef]" /><ArrowRight size={13} /> зависит следующая задача<span className="h-px flex-1 bg-[#ebe9ef]" /></div>
            <label className="block text-[11px] font-semibold text-[#686374]">Зависимая задача<select value={successorTaskId} onChange={(event) => setSuccessorTaskId(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#dfdde5] bg-white px-3 py-2.5 text-xs text-[#413d4e] outline-none focus:border-[#7667ed]">{tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label>
            {error && <p className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[11px] leading-4 text-rose-700" role="alert"><TriangleAlert size={14} className="mt-0.5 shrink-0" />{error}</p>}
            <button type="submit" disabled={isSaving || !predecessorTaskId || !successorTaskId} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#6d5dfb] px-3 py-2.5 text-xs font-bold text-white transition hover:bg-[#5f4fe8] disabled:opacity-60"><Plus size={15} />{isSaving ? 'Добавление…' : 'Добавить зависимость'}</button>
          </form>
        </section>

        <section className="overflow-hidden rounded-2xl border border-[#e5e3eb] bg-white shadow-panel">
          <div className="border-b border-[#ebe9ef] px-4 py-3.5"><div className="flex items-center gap-2"><GitBranch size={15} className="text-[#6d5dfb]" /><h2 className="text-sm font-bold text-[#343044]">Текущие связи</h2><span className="ml-auto rounded-full bg-[#f1eff6] px-2 py-0.5 text-[10px] font-bold text-[#777181]">{dependencies.length}</span></div></div>
          <div className="max-h-[420px] divide-y divide-[#efedf2] overflow-y-auto">
            {dependencies.map((dependency) => {
              const predecessor = taskById.get(dependency.predecessorTaskId)
              const successor = taskById.get(dependency.successorTaskId)
              return (
                <div key={dependency.id} className="flex items-center gap-2 px-4 py-3">
                  <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-semibold text-[#514c5d]">{predecessor?.title}</p><div className="my-1 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-[#817c89]"><ArrowRight size={11} /> finish-to-start</div><p className="truncate text-[11px] font-semibold text-[#514c5d]">{successor?.title}</p></div>
                  <button type="button" disabled={deletingDependencyId === dependency.id} onClick={() => handleDelete(dependency.id)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#aaa5b1] transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40" aria-label={`Удалить зависимость «${predecessor?.title} → ${successor?.title}»`}><Trash2 size={15} /></button>
                </div>
              )
            })}
            {dependencies.length === 0 && <p className="px-4 py-8 text-center text-xs text-[#918c9a]">В проекте пока нет зависимостей.</p>}
          </div>
        </section>
      </aside>
    </div>
  )
}
