import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronRight, Loader2, Sparkles, X } from 'lucide-react'
import type { AiPlan, AiPlanChange } from '../../api/ai.api'
import { aiApi } from '../../api/ai.api'
import type { Employee } from '../../types/employee'
import { formatFullDate } from '../../utils/date'

interface AiPlanPanelProps {
  mode: 'create' | 'update'
  projectId?: string
  projectName?: string
  employees?: Employee[]
  onClose: () => void
  onConfirmed: (plan: AiPlan) => Promise<void>
}

const entityLabels: Record<string, string> = {
  project: 'Проект', employee: 'Сотрудник', task: 'Задача', task_dependency: 'Зависимость',
}
const fieldLabels: Record<string, string> = {
  name: 'Название', startDate: 'Дата начала', endDate: 'Дата окончания', status: 'Статус', assigneeId: 'Ответственный', phone: 'Телефон', email: 'Email',
}
const actionLabels: Record<string, string> = { create: 'Создание', update: 'Изменение', delete: 'Удаление' }
const statusLabels: Record<string, string> = { NotStarted: 'Не в работе', InProgress: 'В работе', Completed: 'Закончено', Delayed: 'Задерживается' }

function displayValue(value: string | null, field?: string | null): string {
  if (value === null || value === undefined || value === '') return '—'
  if (field === 'status') return statusLabels[value] ?? value
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatFullDate(value)
  const range = value.match(/^(\d{4}-\d{2}-\d{2}) — (\d{4}-\d{2}-\d{2})$/)
  if (range) return `${formatFullDate(range[1])} — ${formatFullDate(range[2])}`
  return value
}

function changeDescription(change: AiPlanChange, employees: Employee[]): { label: string; before: string; after: string } {
  const label = change.label || `${entityLabels[change.entityType] ?? change.entityType}`
  const field = fieldLabels[change.field ?? ''] ?? change.field ?? ''
  const fullLabel = field ? `${label} · ${field}` : label
  const resolveEmployee = (value: string | null) => employees.find((employee) => employee.id === value)?.name ?? value ?? '—'
  const before = change.field === 'assigneeId' ? resolveEmployee(change.before) : displayValue(change.before, change.field)
  const after = change.field === 'assigneeId' ? resolveEmployee(change.after) : displayValue(change.after, change.field)
  return { label: fullLabel, before, after }
}

export function AiPlanPanel({ mode, projectId, projectName, employees = [], onClose, onConfirmed }: AiPlanPanelProps) {
  const [prompt, setPrompt] = useState('')
  const [plan, setPlan] = useState<AiPlan | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [busy, onClose])

  const changes = useMemo(() => plan?.changes ?? [], [plan])

  const generate = async () => {
    if (!prompt.trim() || busy) return
    setBusy(true)
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

  return (
    <div className="fixed inset-0 z-[90] flex justify-end bg-[#17152b]/35 backdrop-blur-[1px]" role="dialog" aria-modal="true" aria-labelledby="ai-plan-title">
      <button type="button" className="min-w-0 flex-1" onClick={() => !busy && onClose()} aria-label="Закрыть ИИ-панель по фону" />
      <aside className="flex h-full w-full max-w-[560px] flex-col bg-[#f8f7fa] shadow-[-24px_0_60px_rgba(23,21,43,.18)]">
        <div className="flex items-center gap-3 border-b border-[#e5e2ea] bg-white px-5 py-4">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#efedff] text-[#6757df]"><Sparkles size={18} /></span>
          <div className="min-w-0 flex-1">
            <h2 id="ai-plan-title" className="text-base font-bold text-[#302c40]">{mode === 'create' ? 'Создать проект с ИИ' : 'Изменить проект с ИИ'}</h2>
            <p className="mt-0.5 truncate text-[11px] text-[#8c8797]">{mode === 'create' ? 'Опишите проект обычным языком' : projectName}</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="grid h-9 w-9 place-items-center rounded-xl text-[#777281] hover:bg-[#f3f1f6] disabled:opacity-50" aria-label="Закрыть ИИ-панель"><X size={18} /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {!plan ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#e5e2ea] bg-white p-4 shadow-panel">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#f3f1ff] text-[#6757df]"><Sparkles size={15} /></div>
                  <div><p className="text-xs font-bold text-[#474253]">Опишите результат, а не форму</p><p className="mt-1 text-[11px] leading-5 text-[#85808f]">Например: «Создай проект запуска сайта с 1 по 30 ноября, добавь дизайн, разработку и тестирование, а тестирование начни после разработки».</p></div>
                </div>
              </div>
              <textarea
                autoFocus
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') void generate() }}
                rows={9}
                placeholder={mode === 'create' ? 'Например: Создай проект…' : 'Например: Перенеси тестирование на 10 ноября и назначь его Анне…'}
                className="w-full resize-none rounded-2xl border border-[#dedbe5] bg-white p-4 text-sm leading-6 text-[#363143] outline-none transition focus:border-[#7667ed] focus:ring-2 focus:ring-[#7667ed]/10"
              />
              <p className="text-[10px] leading-4 text-[#918c9b]">ИИ только подготовит план. Данные не изменятся, пока вы не подтвердите предложение.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#dcd7ff] bg-[#f4f2ff] p-4">
                <div className="flex items-start gap-3"><div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-[#6757df]"><Check size={16} /></div><div><p className="text-xs font-bold text-[#40376f]">Предложение готово</p><p className="mt-1 text-[11px] leading-5 text-[#655f7b]">{plan.summary}</p></div></div>
              </div>
              <div className="rounded-2xl border border-[#e5e2ea] bg-white p-4 shadow-panel">
                <div className="mb-3 flex items-center justify-between"><div><p className="text-xs font-bold text-[#494456]">Что изменится</p><p className="mt-0.5 text-[10px] text-[#918c9b]">{changes.length} {changes.length === 1 ? 'изменение' : 'изменений'}</p></div><span className="rounded-full bg-[#f5f3fa] px-2.5 py-1 text-[9px] font-bold text-[#716b7e]">Предпросмотр</span></div>
                <div className="space-y-2">
                  {changes.length === 0 && <p className="rounded-xl bg-[#f7f6f9] p-3 text-xs text-[#777181]">Изменений не обнаружено.</p>}
                  {changes.map((change, index) => {
                    const view = changeDescription(change, employees)
                    return <div key={`${change.entityType}-${change.entityId}-${change.field}-${index}`} className="rounded-xl border border-[#ebe8ef] bg-[#fbfafc] p-3"><div className="flex items-center gap-2"><span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${change.action === 'delete' ? 'bg-rose-50 text-rose-700' : change.action === 'create' ? 'bg-emerald-50 text-emerald-700' : 'bg-[#f0edff] text-[#5f51c8]'}`}>{actionLabels[change.action] ?? change.action}</span><p className="min-w-0 truncate text-[11px] font-semibold text-[#4b4658]">{entityLabels[change.entityType] ?? change.entityType}</p></div><p className="mt-2 text-xs font-semibold text-[#3e394a]">{view.label}</p>{change.action === 'update' && <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-[11px]"><span className="break-words text-[#777181]">{view.before}</span><ChevronRight size={13} className="text-[#b4afbd]" /><span className="break-words font-semibold text-[#4f46b5]">{view.after}</span></div>}{change.action !== 'update' && <p className="mt-1 text-[11px] text-[#777181]">{view.after !== '—' ? view.after : view.before}</p>}</div>
                  })}
                </div>
              </div>
              <div className="rounded-xl bg-[#f5f3f8] px-3 py-2.5 text-[10px] leading-4 text-[#777181]">После подтверждения изменения пройдут обычную серверную валидацию, попадут в историю и будут синхронизированы с другими открытыми клиентами.</div>
              {confirmed && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-700">Изменения применены.</div>}
            </div>
          )}
          {error && <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs leading-5 text-rose-700" role="alert">{error}</p>}
        </div>

        <div className="flex gap-2 border-t border-[#e5e2ea] bg-white p-5">
          <button type="button" onClick={plan ? resetPlan : onClose} disabled={busy} className="flex-1 rounded-xl border border-[#dedbe5] px-4 py-2.5 text-xs font-semibold text-[#625d6c] disabled:opacity-50">{plan ? 'Изменить запрос' : 'Отмена'}</button>
          {!plan ? <button type="button" onClick={() => void generate()} disabled={busy || !prompt.trim()} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#6d5dfb] px-4 py-2.5 text-xs font-bold text-white shadow-[0_8px_18px_rgba(109,93,251,.2)] disabled:opacity-55">{busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}{busy ? 'Анализ…' : 'Сформировать план'}</button>
            : <button type="button" onClick={() => void confirm()} disabled={busy || confirmed || changes.length === 0} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#6d5dfb] px-4 py-2.5 text-xs font-bold text-white shadow-[0_8px_18px_rgba(109,93,251,.2)] disabled:opacity-55">{busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}{busy ? 'Применение…' : confirmed ? 'Применено' : 'Подтвердить изменения'}</button>}
        </div>
      </aside>
    </div>
  )
}
