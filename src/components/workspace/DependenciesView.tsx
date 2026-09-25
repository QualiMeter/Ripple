import { useMemo, useState, type FormEvent } from 'react'
import { ArrowRight, GitBranch, Link2, Plus, Trash2, TriangleAlert } from 'lucide-react'
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
}

const nodeWidth = 224
const nodeHeight = 112
const columnGap = 72
const rowGap = 28
const graphPadding = 24

function buildNodePositions(tasks: ProjectTask[], dependencies: Dependency[]) {
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

  const positions = new Map<string, { x: number; y: number }>()
  tasksByLevel.forEach((levelTasks, level) => {
    levelTasks.forEach((task, row) => {
      positions.set(task.id, {
        x: graphPadding + level * (nodeWidth + columnGap),
        y: graphPadding + row * (nodeHeight + rowGap),
      })
    })
  })

  const maxLevel = Math.max(0, ...levelByTaskId.values())
  const maxRows = Math.max(1, ...[...tasksByLevel.values()].map((levelTasks) => levelTasks.length))
  return {
    positions,
    width: graphPadding * 2 + (maxLevel + 1) * nodeWidth + maxLevel * columnGap,
    height: graphPadding * 2 + maxRows * nodeHeight + (maxRows - 1) * rowGap,
  }
}

export function DependenciesView({
  tasks,
  dependencies,
  assignees,
  impact,
  onTaskSelect,
  onCreateDependency,
  onDeleteDependency,
}: DependenciesViewProps) {
  const [predecessorTaskId, setPredecessorTaskId] = useState(tasks[0]?.id ?? '')
  const [successorTaskId, setSuccessorTaskId] = useState(tasks[1]?.id ?? tasks[0]?.id ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [deletingDependencyId, setDeletingDependencyId] = useState<string | null>(null)
  const graph = useMemo(() => buildNodePositions(tasks, dependencies), [tasks, dependencies])
  const taskById = new Map(tasks.map((task) => [task.id, task]))
  const affectedTaskIdSet = new Set(impact.affectedTaskIds)

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

  return (
    <div className="grid items-start gap-4 2xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="overflow-hidden rounded-2xl border border-[#e5e3eb] bg-white shadow-panel">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ebe9ef] px-5 py-4">
          <div><h2 className="text-sm font-bold text-[#302d40]">Граф зависимостей</h2><p className="mt-0.5 text-[11px] text-[#918d9b]">Направление стрелки: предшественник → зависимая задача</p></div>
          <div className="flex items-center gap-4 text-[10px] text-[#85818f]">
            <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#e7774d]" /> Затронуто</span>
            <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#df5e64]" /> Под риском</span>
          </div>
        </div>
        <div className="overflow-auto bg-[#faf9fb]">
          <div className="relative" style={{ width: graph.width, height: graph.height, minWidth: '100%' }}>
            <svg className="absolute inset-0 h-full w-full" width={graph.width} height={graph.height} aria-hidden="true">
              <defs>
                <marker id="dependency-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#aaa5b5" /></marker>
                <marker id="dependency-arrow-affected" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#e7774d" /></marker>
              </defs>
              {dependencies.map((dependency) => {
                const from = graph.positions.get(dependency.predecessorTaskId)
                const to = graph.positions.get(dependency.successorTaskId)
                if (!from || !to) return null
                const highlighted = affectedTaskIdSet.has(dependency.successorTaskId)
                const startX = from.x + nodeWidth
                const startY = from.y + nodeHeight / 2
                const endX = to.x - 10
                const endY = to.y + nodeHeight / 2
                const controlOffset = Math.max(28, (endX - startX) / 2)
                return <path key={dependency.id} d={`M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`} fill="none" stroke={highlighted ? '#e7774d' : '#c4c0cb'} strokeWidth={highlighted ? 2.5 : 1.5} markerEnd={`url(#${highlighted ? 'dependency-arrow-affected' : 'dependency-arrow'})`} />
              })}
            </svg>

            {tasks.map((task) => {
              const position = graph.positions.get(task.id)
              if (!position) return null
              const assignee = assignees.find((candidate) => candidate.id === task.assigneeId)
              const affected = affectedTaskIdSet.has(task.id)
              const atRisk = task.riskState === 'at-risk'
              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => onTaskSelect(task)}
                  className={`absolute rounded-2xl border bg-white p-3 text-left shadow-panel transition hover:-translate-y-0.5 hover:shadow-lg ${affected ? 'border-[#e7774d] ring-2 ring-[#e7774d]/10' : atRisk ? 'border-[#e7a9ac]' : 'border-[#e2e0e7]'}`}
                  style={{ left: position.x, top: position.y, width: nodeWidth, height: nodeHeight }}
                  aria-label={`Открыть задачу «${task.title}»`}
                >
                  <div className="flex items-start justify-between gap-2"><p className="line-clamp-2 text-xs font-bold leading-4 text-[#403b4d]">{task.title}</p>{affected && <span className="shrink-0 rounded-full bg-[#fff0e8] px-1.5 py-0.5 text-[8px] font-bold text-[#b9542f]">Затронуто</span>}</div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5"><Avatar assignee={assignee} size="sm" /><span className="truncate text-[10px] text-[#7f7a89]">{assignee?.name}</span></div>
                    <StatusBadge status={task.status} risk={task.riskState} />
                  </div>
                  <p className={`mt-2 text-[9px] font-bold ${atRisk ? 'text-[#c55359]' : task.riskState === 'watch' ? 'text-[#b0762d]' : 'text-[#8a8593]'}`}>{atRisk ? 'Под риском' : task.riskState === 'watch' ? 'Требует наблюдения' : 'Рисков нет'}</p>
                </button>
              )
            })}
          </div>
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
                  <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-semibold text-[#514c5d]">{predecessor?.title}</p><div className="my-1 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-[#9a95a3]"><ArrowRight size={11} /> finish-to-start</div><p className="truncate text-[11px] font-semibold text-[#514c5d]">{successor?.title}</p></div>
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
