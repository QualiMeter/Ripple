import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Check, CirclePlus, Clock3, Loader2, Pencil, Sparkles, Trash2, UserRound, X, Minimize2, Maximize2 } from 'lucide-react'
import type { AiPlan, AiPlanChange } from '../../api/ai.api'
import { aiApi } from '../../api/ai.api'
import type { Employee } from '../../types/employee'
import { formatFullDate } from '../../utils/date'
import { getPanelMode, type PanelMode } from '../../services/aiPanelPreferences'

interface AiPlanPanelProps {
  mode: 'create' | 'update'
  projectId?: string
  projectName?: string
  employees?: Employee[]
  onClose: () => void
  onConfirmed: (plan: AiPlan) => Promise<void>
}

const entityLabels: Record<string, string> = { project: 'Проект', employee: 'Сотрудник', task: 'Задача', task_dependency: 'Зависимость' }
const fieldLabels: Record<string, string> = { name: 'Название', startDate: 'Дата начала', endDate: 'Дата окончания', status: 'Статус', assigneeId: 'Ответственный', phone: 'Телефон', email: 'Email' }
const actionLabels: Record<string, string> = { create: 'Добавлено', update: 'Изменено', delete: 'Удалено' }
const statusLabels: Record<string, string> = { NotStarted: 'Не в работе', InProgress: 'В работе', Completed: 'Закончено', Delayed: 'Задерживается' }

function displayValue(value: string | null, field?: string | null): string {
  if (value === null || value === undefined || value === '') return '—'
  if (field === 'status') return statusLabels[value] ?? value
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatFullDate(value)
  const range = value.match(/^(\d{4}-\d{2}-\d{2}) — (\d{4}-\d{2}-\d{2})$/)
  if (range) return `${formatFullDate(range[1])} — ${formatFullDate(range[2])}`
  return value
}

function changeDescription(change: AiPlanChange, employees: Employee[]) {
  const field = fieldLabels[change.field ?? ''] ?? change.field ?? ''
  const label = change.label || `${entityLabels[change.entityType] ?? change.entityType}`
  const resolveEmployee = (value: string | null) => employees.find((employee) => employee.id === value)?.name ?? value ?? '—'
  return {
    title: label,
    field,
    before: change.field === 'assigneeId' ? resolveEmployee(change.before) : displayValue(change.before, change.field),
    after: change.field === 'assigneeId' ? resolveEmployee(change.after) : displayValue(change.after, change.field),
  }
}

function changeIcon(action: string) {
  if (action === 'create') return CirclePlus
  if (action === 'delete') return Trash2
  return Pencil
}

export function AiPlanPanel({ mode, projectId, projectName, employees = [], onClose, onConfirmed }: AiPlanPanelProps) {
  const [prompt, setPrompt] = useState('')
  const [plan, setPlan] = useState<AiPlan | null>(null)
  const [busy, setBusy] = useState(false)
  const [background, setBackground] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [panelMode] = useState<PanelMode>(getPanelMode)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [busy, onClose])

  const changes = useMemo(() => plan?.changes ?? [], [plan])
  const groupedChanges = useMemo(() => {
    const groups = new Map<string, AiPlanChange[]>()
    changes.forEach((change) => {
      const key = `${change.action}:${change.entityType}`
      const current = groups.get(key) ?? []
      current.push(change)
      groups.set(key, current)
    })
    return [...groups.entries()].map(([key, items]) => {
      const [action, entityType] = key.split(':')
      return { key, action, entityType, items }
    })
  }, [changes])

  const generate = async () => {
    if (!prompt.trim() || busy) return
    setBusy(true)
    setBackground(false)
    setError(null)
    try {
      const next = mode === 'create'
        ? await aiApi.createProjectPlan(prompt.trim())
        : await aiApi.createProjectUpdatePlan(projectId!, prompt.trim())
      setPlan(next)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Не удалось получить предложение от ИИ.')
    } finally {
      setBusy(false)
      setBackground(false)
    }
  }

  const confirm = async () => {
    if (!plan || busy) return
    setBusy(true)
    setError(null)
    try {
      const result = await aiApi.confirmPlan(plan.planId, projectId)
      setPlan(result)
      setConfirmed(true)
      await onConfirmed(result)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Не удалось применить изменения.')
    } finally {
      setBusy(false)
    }
  }

  const resetPlan = () => {
    if (busy) return
    setPlan(null)
    setConfirmed(false)
    setError(null)
  }

  const isDialog = panelMode === 'dialog'
  const shellClass = isDialog
    ? 'fixed inset-0 z-[90] grid place-items-center bg-[#17152b]/35 p-4 backdrop-blur-[1px]'
    : 'fixed inset-0 z-[90] flex justify-end bg-[#17152b]/35 backdrop-blur-[1px]'
  const contentClass = isDialog
    ? 'flex max-h-[min(860px,calc(100vh-32px))] h-full w-full max-w-[760px] flex-col overflow-hidden rounded-3xl bg-[#f8f7fa] shadow-[0_28px_80px_rgba(23,21,43,.24)]'
    : 'flex h-full w-full max-w-[620px] flex-col bg-[#f8f7fa] shadow-[-24px_0_60px_rgba(23,21,43,.18)]'

  if (background && busy) {
    return <div className="fixed bottom-5 right-5 z-[95] w-[min(380px,calc(100vw-32px))] rounded-2xl border border-[#ddd8ff] bg-white p-4 shadow-[0_18px_50px_rgba(32,28,58,.18)]" role="status">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#efedff] text-[#6757df]"><Loader2 size={18} className="animate-spin" /></span>
        <div className="min-w-0 flex-1"><p className="text-xs font-bold text-[#373145]">Генерация проекта…</p><p className="mt-1 truncate text-[10px] text-[#8a8594]">ИИ работает в фоне, можно продолжать пользоваться Ripple.</p></div>
        <button type="button" onClick={() => setBackground(false)} className="grid h-8 w-8 place-items-center rounded-lg text-[#777181] hover:bg-[#f3f1f6]" aria-label="Развернуть генерацию"><Maximize2 size={15} /></button>
      </div>
    </div>
  }

  return (
    <div className={shellClass} role="dialog" aria-modal="true" aria-labelledby="ai-plan-title">
      {!isDialog && <button type="button" className="min-w-0 flex-1" onClick={() => !busy && onClose()} aria-label="Закрыть ИИ-панель по фону" />}
      {isDialog && <button type="button" className="absolute inset-0 cursor-default" onClick={() => !busy && onClose()} aria-label="Закрыть окно ИИ по фону" />}
      <section className={`relative z-10 ${contentClass}`}>
        <header className="flex items-center gap-3 border-b border-[#e5e2ea] bg-white px-5 py-4 sm:px-6">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#efedff] text-[#6757df]"><Sparkles size={18} /></span>
          <div className="min-w-0 flex-1"><h2 id="ai-plan-title" className="text-base font-bold text-[#302c40]">{mode === 'create' ? 'Создать проект с ИИ' : 'Изменить проект с ИИ'}</h2><p className="mt-0.5 truncate text-[11px] text-[#8c8797]">{mode === 'create' ? 'Опишите результат обычным языком' : projectName}</p></div>
          {busy && <button type="button" onClick={() => setBackground(true)} className="hidden items-center gap-1.5 rounded-lg px-2.5 py-2 text-[10px] font-bold text-[#6259a8] hover:bg-[#f3f1ff] sm:inline-flex"><Minimize2 size={14} /> В фон</button>}
          <button type="button" onClick={onClose} disabled={busy} className="grid h-9 w-9 place-items-center rounded-xl text-[#777281] hover:bg-[#f3f1f6] disabled:opacity-50" aria-label="Закрыть ИИ-панель"><X size={18} /></button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          {!plan ? <div className="space-y-4">
            <div className="rounded-2xl border border-[#ddd8ff] bg-gradient-to-br from-[#f7f5ff] to-white p-4 shadow-panel">
              <div className="flex items-start gap-3"><div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#ebe8ff] text-[#6757df]"><Sparkles size={16} /></div><div><p className="text-xs font-bold text-[#433a70]">Опишите цель проекта</p><p className="mt-1 text-[11px] leading-5 text-[#77718b]">ИИ сам разложит запрос на проект, задачи, сотрудников и зависимости, а Ripple проверит план перед применением.</p></div></div>
            </div>
            <textarea autoFocus value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') void generate() }} rows={9} placeholder={mode === 'create' ? 'Например: Создай проект запуска сайта…' : 'Например: Перенеси тестирование на 10 ноября и назначь его Анне…'} className="w-full resize-none rounded-2xl border border-[#dedbe5] bg-white p-4 text-sm leading-6 text-[#363143] outline-none transition focus:border-[#7667ed] focus:ring-2 focus:ring-[#7667ed]/10" />
            <div className="flex items-center gap-2 rounded-xl bg-[#f5f3f8] px-3 py-2.5 text-[10px] leading-4 text-[#777181]"><Clock3 size={14} className="shrink-0 text-[#7167c9]" /> Пока вы не подтвердите предложение, данные проекта не изменятся.</div>
          </div> : <div className="space-y-4">
            <div className="rounded-2xl border border-[#dcd7ff] bg-gradient-to-br from-[#f4f2ff] to-white p-5">
              <div className="flex items-start gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-[#6757df] shadow-sm"><Check size={17} /></div><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[.08em] text-[#6259a8]">Предложение готово</p><p className="mt-2 text-sm font-semibold leading-6 text-[#38314e]">{plan.summary}</p></div></div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-xl border border-[#e7e3ef] bg-white px-3 py-2.5"><p className="text-[10px] text-[#8a8593]">Всего изменений</p><p className="mt-1 text-lg font-bold text-[#312c40]">{changes.length}</p></div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2.5"><p className="text-[10px] text-emerald-700">Добавлено</p><p className="mt-1 text-lg font-bold text-emerald-800">{changes.filter((change) => change.action === 'create').length}</p></div>
              <div className="rounded-xl border border-[#ddd8ff] bg-[#f5f3ff] px-3 py-2.5"><p className="text-[10px] text-[#6259a8]">Изменено</p><p className="mt-1 text-lg font-bold text-[#5147aa]">{changes.filter((change) => change.action === 'update').length}</p></div>
              <div className="rounded-xl border border-rose-100 bg-rose-50/60 px-3 py-2.5"><p className="text-[10px] text-rose-700">Удалено</p><p className="mt-1 text-lg font-bold text-rose-800">{changes.filter((change) => change.action === 'delete').length}</p></div>
            </div>
            <div className="rounded-2xl border border-[#e5e2ea] bg-white p-4 shadow-panel sm:p-5">
              <div className="mb-4 flex items-end justify-between gap-3"><div><p className="text-xs font-bold text-[#494456]">Структура предложения</p><p className="mt-1 text-[10px] text-[#918c9b]">Изменения сгруппированы по типу, чтобы план было проще проверить.</p></div><span className="rounded-full bg-[#f5f3fa] px-2.5 py-1 text-[9px] font-bold text-[#716b7e]">Предпросмотр</span></div>
              {changes.length === 0 ? <p className="rounded-xl bg-[#f7f6f9] p-4 text-xs text-[#777181]">Изменений не обнаружено.</p> : <div className="space-y-4">{groupedChanges.map((group) => { const Icon = changeIcon(group.action); return <section key={group.key} className="overflow-hidden rounded-2xl border border-[#e8e5ed] bg-[#fbfafc]">
                <div className="flex items-center gap-3 border-b border-[#e8e5ed] bg-white px-4 py-3"><span className={`grid h-8 w-8 place-items-center rounded-lg ${group.action === 'delete' ? 'bg-rose-50 text-rose-600' : group.action === 'create' ? 'bg-emerald-50 text-emerald-600' : 'bg-[#efedff] text-[#6757df]'}`}><Icon size={15} /></span><div className="min-w-0 flex-1"><p className="text-xs font-bold text-[#403b4d]">{actionLabels[group.action] ?? group.action} {entityLabels[group.entityType] ?? group.entityType}</p><p className="text-[10px] text-[#918c9b]">{group.items.length} {group.items.length === 1 ? 'изменение' : 'изменений'}</p></div></div>
                <div className="grid gap-2 p-3 sm:grid-cols-2">{group.items.map((change, index) => { const view = changeDescription(change, employees); return <article key={`${change.entityType}-${change.entityId}-${change.field}-${index}`} className="rounded-xl border border-[#e8e5ed] bg-white p-3"><div className="flex items-center gap-2"><span className="min-w-0 truncate text-xs font-bold text-[#3f3a4b]">{view.title}</span>{view.field && <span className="shrink-0 rounded-full bg-[#f5f3f8] px-2 py-0.5 text-[9px] font-semibold text-[#777181]">{view.field}</span>}</div>{change.action === 'update' ? <div className="mt-3 flex items-center gap-2"><span className="min-w-0 flex-1 break-words rounded-lg bg-[#f7f6f9] px-2.5 py-2 text-[10px] text-[#777181]">{view.before}</span><ArrowRight size={13} className="shrink-0 text-[#b4afbd]" /><span className="min-w-0 flex-1 break-words rounded-lg bg-[#f2f0ff] px-2.5 py-2 text-[10px] font-bold text-[#5147aa]">{view.after}</span></div> : <p className="mt-2 rounded-lg bg-[#f7f6f9] px-2.5 py-2 text-[10px] leading-4 text-[#777181]">{view.after !== '—' ? view.after : view.before}</p>}</article> })}</div>
              </section> })}</div>}
            </div>
            <div className="flex items-start gap-2 rounded-xl bg-[#f5f3f8] px-3 py-2.5 text-[10px] leading-4 text-[#777181]"><UserRound size={14} className="mt-0.5 shrink-0 text-[#756bc9]" /> После подтверждения изменения пройдут обычную серверную валидацию, попадут в историю и синхронизируются с другими открытыми клиентами.</div>
            {confirmed && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-700">Изменения применены.</div>}
          </div>}
          {error && <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs leading-5 text-rose-700" role="alert">{error}</p>}
        </div>

        <footer className="flex gap-2 border-t border-[#e5e2ea] bg-white p-5 sm:px-6">
          <button type="button" onClick={plan ? resetPlan : onClose} disabled={busy} className="flex-1 rounded-xl border border-[#dedbe5] px-4 py-2.5 text-xs font-semibold text-[#625d6c] disabled:opacity-50">{plan ? 'Изменить запрос' : 'Отмена'}</button>
          {!plan ? <button type="button" onClick={() => void generate()} disabled={busy || !prompt.trim()} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#6d5dfb] px-4 py-2.5 text-xs font-bold text-white shadow-[0_8px_18px_rgba(109,93,251,.2)] disabled:opacity-55">{busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}{busy ? 'Генерация…' : 'Сформировать план'}</button>
            : <button type="button" onClick={() => void confirm()} disabled={busy || confirmed || changes.length === 0} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#6d5dfb] px-4 py-2.5 text-xs font-bold text-white shadow-[0_8px_18px_rgba(109,93,251,.2)] disabled:opacity-55">{busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}{busy ? 'Применение…' : confirmed ? 'Применено' : 'Подтвердить изменения'}</button>}
        </footer>
      </section>
    </div>
  )
}
