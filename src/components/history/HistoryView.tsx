import { useMemo, useState } from 'react'
import { Clock3, RotateCcw, X } from 'lucide-react'
import { buildHistoryRevertPlan } from '../../services/history/historyRevert'
import type { ProjectHistoryEntry, ProjectHistoryKind } from '../../services/history/historyTypes'
import type { ProjectWorkspace } from '../../types/workspace'
import { formatFullDate } from '../../utils/date'
import { TooltipTrigger } from '../common/TooltipTrigger'

const statusLabels: Record<string, string> = { 'not-started': 'Не в работе', 'in-progress': 'В работе', completed: 'Закончено', delayed: 'Задерживается' }
const fieldLabels: Record<string, string> = { title: 'Название', startDate: 'Начало', endDate: 'Завершение', assigneeId: 'Ответственный', status: 'Статус', name: 'Имя', targetEndDate: 'Плановый срок', projectEndDate: 'Срок проекта' }
const kindLabels: Record<ProjectHistoryKind, string> = { 'project-updated': 'Изменение проекта', 'task-created': 'Создание задачи', 'task-updated': 'Изменение задачи', 'task-deleted': 'Удаление задачи', 'dependency-created': 'Создание зависимости', 'dependency-deleted': 'Удаление зависимости', 'employee-created': 'Создание сотрудника', 'employee-updated': 'Изменение сотрудника', 'employee-deleted': 'Удаление сотрудника', 'schedule-shift-applied': 'Автоматический сдвиг', 'change-reverted': 'Откат изменения' }
const entityLabels = { project: 'Проект', task: 'Задача', dependency: 'Зависимость', employee: 'Сотрудник', schedule: 'Расписание' }

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function displayValue(key: string, value: unknown, workspace: ProjectWorkspace): string {
  if (value === undefined || value === null) return '—'
  if (key === 'status') return statusLabels[String(value)] ?? String(value)
  if (key === 'assigneeId') return workspace.assignees.find((employee) => employee.id === value)?.name ?? String(value)
  if (typeof value === 'string') {
    const range = value.match(/^(\d{4}-\d{2}-\d{2}) — (\d{4}-\d{2}-\d{2})$/)
    if (range) return `${formatFullDate(range[1])} — ${formatFullDate(range[2])}`
  }
  if (isIsoDate(value)) return formatFullDate(value)
  return String(value)
}

function groupLabel(value: string): string {
  const date = new Date(value)
  const today = new Date()
  if (date.toDateString() === today.toDateString()) return 'Сегодня'
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(date)
}

function timeLabel(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function DetailRows({ entry, workspace }: { entry: ProjectHistoryEntry; workspace: ProjectWorkspace }) {
  const before = entry.before ?? {}
  const after = entry.after ?? {}
  if (entry.kind === 'schedule-shift-applied') {
    const beforeTasks = Array.isArray(before.tasks) ? before.tasks as Array<Record<string, unknown>> : []
    const afterTasks = Array.isArray(after.tasks) ? after.tasks as Array<Record<string, unknown>> : []
    return <div><div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-[11px]"><thead><tr className="text-[#918b99]"><th className="pb-2">Задача</th><th className="pb-2">Было</th><th className="pb-2">Стало</th></tr></thead><tbody>{afterTasks.map((item) => { const previous = beforeTasks.find((candidate) => candidate.taskId === item.taskId); const task = workspace.tasks.find((candidate) => candidate.id === item.taskId); return <tr key={String(item.taskId)} className="border-t border-[#ebe8ef]"><td className="py-2 font-semibold">{task?.title ?? String(item.taskId)}</td><td className="py-2">{displayValue('startDate', previous?.startDate, workspace)} — {displayValue('endDate', previous?.endDate, workspace)}</td><td className="py-2">{displayValue('startDate', item.startDate, workspace)} — {displayValue('endDate', item.endDate, workspace)}</td></tr> })}</tbody></table></div>{before.projectEndDate !== after.projectEndDate && <p className="mt-3 rounded-xl bg-[#f0edff] p-3 text-xs text-[#50469a]">Срок проекта: <strong>{displayValue('projectEndDate', before.projectEndDate, workspace)} → {displayValue('projectEndDate', after.projectEndDate, workspace)}</strong></p>}</div>
  }
  if (entry.kind === 'dependency-created' || entry.kind === 'dependency-deleted') {
    const snapshot = entry.after ?? entry.before ?? {}
    const predecessor = workspace.tasks.find((task) => task.id === snapshot.predecessorTaskId)?.title ?? String(snapshot.predecessorTaskId)
    const successor = workspace.tasks.find((task) => task.id === snapshot.successorTaskId)?.title ?? String(snapshot.successorTaskId)
    return <div className="rounded-xl border border-[#e5e2ea] bg-white p-3"><p className="text-[10px] font-bold uppercase tracking-[.08em] text-[#918b99]">Зависимость</p><p className="mt-2 text-xs font-semibold text-[#3f394b]">{predecessor} → {successor}</p><p className="mt-1 text-[11px] text-[#777181]">{entry.kind === 'dependency-created' ? 'Не было → создана' : 'Существовала → удалена'}</p></div>
  }
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((key) => key !== 'id')
  if (keys.length === 0) return <p className="text-xs text-[#777181]">{entry.description}</p>
  return <div className="space-y-3">{keys.map((key) => <div key={key} className="rounded-xl border border-[#e5e2ea] bg-white p-3"><p className="text-[10px] font-bold uppercase tracking-[.08em] text-[#918b99]">{fieldLabels[key] ?? key}</p><div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs"><span className="break-words text-[#756f7d]">{displayValue(key, before[key], workspace)}</span><span className="text-[#b8b3c0]">→</span><span className="break-words font-semibold text-[#3f394b]">{displayValue(key, after[key], workspace)}</span></div></div>)}</div>
}

export function HistoryView({ entries, workspace, onRevert }: { entries: ProjectHistoryEntry[]; workspace: ProjectWorkspace; onRevert: (entry: ProjectHistoryEntry) => Promise<void> }) {
  const [selected, setSelected] = useState<ProjectHistoryEntry | null>(null)
  const [reverting, setReverting] = useState<ProjectHistoryEntry | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const groups = useMemo(() => entries.reduce<Array<{ label: string; entries: ProjectHistoryEntry[] }>>((result, entry) => {
    const label = groupLabel(entry.createdAt)
    const group = result.find((item) => item.label === label)
    if (group) group.entries.push(entry)
    else result.push({ label, entries: [entry] })
    return result
  }, []), [entries])
  const revertPlan = reverting ? buildHistoryRevertPlan(reverting, workspace) : null

  const confirmRevert = async () => {
    if (!reverting || !revertPlan?.allowed) return
    setIsSubmitting(true)
    setError(null)
    try {
      await onRevert(reverting)
      setReverting(null)
    } catch (revertError) {
      setError(revertError instanceof Error ? revertError.message : 'Не удалось откатить изменение.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return <>
    <section className="overflow-hidden rounded-2xl border border-[#e5e3eb] bg-white shadow-panel">
      <div className="border-b border-[#ebe9ef] px-5 py-4"><h2 className="text-sm font-bold text-[#302d40]">История изменений</h2><p className="mt-0.5 text-[11px] text-[#918d9b]">Изменения, выполненные в этом браузере</p></div>
      {entries.length === 0 ? <div className="grid min-h-64 place-items-center px-6 py-14 text-center"><div><Clock3 size={26} className="mx-auto text-[#887de2]" /><p className="mt-3 text-sm font-semibold text-[#4b4658]">История пока пуста</p><p className="mt-1 max-w-sm text-[11px] leading-4 text-[#918d9b]">Здесь появятся изменения, выполненные с этого браузера после включения истории.</p></div></div> : <div className="space-y-5 p-4 sm:p-5">{groups.map((group) => <div key={group.label}><p className="mb-2 text-[10px] font-bold uppercase tracking-[.09em] text-[#918b99]">{group.label}</p><div className="space-y-2">{group.entries.map((entry) => <article key={entry.id} className="rounded-xl border border-[#e5e2ea] p-3.5"><div className="flex items-start gap-3"><time className="w-11 shrink-0 text-[10px] font-semibold text-[#928d9a]">{timeLabel(entry.createdAt)}</time><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-xs font-bold text-[#433e4e]">{entry.title}</h3>{entry.revertStatus === 'reverted' && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-600">Отменено</span>}</div><p className="mt-1 break-words text-[11px] text-[#777181]">{entry.description}</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => setSelected(entry)} className="rounded-lg border border-[#dedbe4] px-2.5 py-1.5 text-[10px] font-bold text-[#625d6c]">Подробнее</button>{entry.revertStatus === 'available' ? <button type="button" onClick={() => { setError(null); setReverting(entry) }} className="inline-flex items-center gap-1 rounded-lg bg-[#f0edff] px-2.5 py-1.5 text-[10px] font-bold text-[#5f51c8]"><RotateCcw size={11} /> Откатить</button> : <TooltipTrigger ariaLabel="Почему откат недоступен" trigger={<span aria-disabled="true" className="inline-flex cursor-not-allowed items-center gap-1 rounded-lg bg-[#f0edff] px-2.5 py-1.5 text-[10px] font-bold text-[#5f51c8] opacity-45"><RotateCcw size={11} /> Откатить</span>}><span className="block text-xs font-bold">Откат недоступен</span><span className="mt-1.5 block text-[#dedbe8]">{entry.revertStatus === 'reverted' ? 'Это изменение уже отменено.' : 'Для точного восстановления этого изменения потребуется серверная история.'}</span></TooltipTrigger>}</div></div></div></article>)}</div></div>)}</div>}
    </section>
    {selected && <div className="fixed inset-0 z-[80] flex justify-end bg-[#17152b]/35" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}><aside className="h-full w-full max-w-[520px] overflow-y-auto bg-[#f8f7fa] p-5 shadow-[-24px_0_60px_rgba(23,21,43,.16)]" role="dialog" aria-modal="true" aria-labelledby="history-details-title"><div className="flex items-start gap-3"><div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-[.1em] text-[#918b99]">Подробности изменения</p><h2 id="history-details-title" className="mt-1 text-lg font-bold text-[#302c40]">{selected.title}</h2><p className="mt-1 text-xs text-[#777181]">{new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(selected.createdAt))} · {selected.description}</p><p className="mt-2 text-[10px] text-[#918b99]">Тип: {kindLabels[selected.kind]} · Сущность: {entityLabels[selected.entityType]}</p>{selected.revertEventId && <p className="mt-1 break-all text-[10px] font-semibold text-[#6557cc]">Событие отката: {selected.revertEventId}</p>}</div><button type="button" onClick={() => setSelected(null)} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl hover:bg-white" aria-label="Закрыть подробности"><X size={18} /></button></div><div className="mt-5"><DetailRows entry={selected} workspace={workspace} /></div></aside></div>}
    {reverting && revertPlan && <div className="fixed inset-0 z-[85] grid place-items-end bg-[#17152b]/40 p-0 sm:place-items-center sm:p-4" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !isSubmitting && setReverting(null)}><section className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-2xl" role="dialog" aria-modal="true" aria-labelledby="history-revert-title"><div className="flex items-start gap-3"><div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-[.1em] text-[#918b99]">Откат изменения</p><h2 id="history-revert-title" className="mt-1 text-base font-bold text-[#302c40]">{reverting.description}</h2></div><button type="button" onClick={() => setReverting(null)} disabled={isSubmitting} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl hover:bg-[#f5f3f8]" aria-label="Закрыть"><X size={18} /></button></div>{revertPlan.reason && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">⚠ {revertPlan.reason}</p>}<div className="mt-4 space-y-2">{revertPlan.changes.map((change) => <div key={`${change.label}-${change.next}`} className="rounded-xl bg-[#f7f5f9] p-3 text-[11px]"><p className="font-bold text-[#4b4658]">{change.label}</p><p className="mt-1 text-[#777181]">сейчас: {displayValue(change.label, change.current, workspace)}</p>{change.expected !== undefined && change.expected !== change.current && <p className="mt-0.5 text-amber-700">после выбранного события: {displayValue(change.label, change.expected, workspace)}</p>}<p className="mt-0.5 font-semibold text-[#4f46b5]">после отката: {displayValue(change.label, change.next, workspace)}</p></div>)}</div>{error && <p className="mt-3 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}<div className="mt-5 grid grid-cols-2 gap-2"><button type="button" disabled={isSubmitting} onClick={() => setReverting(null)} className="rounded-xl border border-[#dedbe4] px-3 py-2.5 text-xs font-semibold">Отмена</button><button type="button" disabled={isSubmitting || !revertPlan.allowed} onClick={confirmRevert} className="rounded-xl bg-[#6d5dfb] px-3 py-2.5 text-xs font-bold text-white disabled:opacity-45">{isSubmitting ? 'Откат…' : 'Откатить'}</button></div></section></div>}
  </>
}
