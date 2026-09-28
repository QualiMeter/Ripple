import { useEffect, useState } from 'react'
import { Activity, ArrowUpRight, CircleCheck, RefreshCw } from 'lucide-react'
import { isScheduleShiftActionCode } from '../../services/taskAnalysis'
import type { TaskAnalysisMessage, TaskAnalysisSeverity } from '../../types/taskAnalysis'
import type { ProjectTask } from '../../types/task'

interface TaskAnalysisSectionProps {
  taskId: string
  tasks: ProjectTask[]
  refreshKey: string | number
  loadAnalysis: (taskId: string) => Promise<TaskAnalysisMessage[]>
  onOpenTask: (taskId: string) => void
  onRequestScheduleShift: (sourceTaskId: string) => void
}

const severityPresentation: Record<TaskAnalysisSeverity, { label: string; className: string }> = {
  error: { label: 'Ошибка', className: 'border-rose-200 bg-rose-50 text-rose-800' },
  warning: { label: 'Предупреждение', className: 'border-amber-200 bg-amber-50 text-amber-900' },
  info: { label: 'Информация', className: 'border-sky-200 bg-sky-50 text-sky-900' },
}

export function TaskAnalysisSection({ taskId, tasks, refreshKey, loadAnalysis, onOpenTask, onRequestScheduleShift }: TaskAnalysisSectionProps) {
  const [messages, setMessages] = useState<TaskAnalysisMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retryAttempt, setRetryAttempt] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(false)
    loadAnalysis(taskId)
      .then((result) => {
        if (!active) return
        setMessages(result)
      })
      .catch(() => {
        if (!active) return
        setMessages([])
        setError(true)
      })
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [taskId, refreshKey, retryAttempt, loadAnalysis])

  const taskById = new Map(tasks.map((task) => [task.id, task]))

  return (
    <section className="rounded-2xl border border-[#e5e2ea] bg-white p-4 shadow-panel" aria-labelledby="task-analysis-title">
      <div className="flex items-start gap-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#f0edff] text-[#6556d9]"><Activity size={16} /></span>
        <div>
          <h3 id="task-analysis-title" className="text-xs font-bold text-[#494456]">Анализ задачи</h3>
          <p className="mt-0.5 text-[10px] leading-4 text-[#8c8798]">Риски, последствия и рекомендации backend для текущего состояния.</p>
        </div>
      </div>

      {loading && <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#f7f6f9] px-3 py-3 text-[11px] text-[#716b7b]" role="status"><RefreshCw size={14} className="animate-spin text-[#6d5dfb]" />Анализируем задачу…</div>}

      {!loading && error && <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-[11px] text-rose-800" role="alert"><p className="font-semibold">Не удалось получить анализ задачи.</p><button type="button" onClick={() => setRetryAttempt((value) => value + 1)} className="mt-2 rounded-lg bg-white px-2.5 py-1.5 text-[10px] font-bold shadow-sm">Повторить</button></div>}

      {!loading && !error && messages.length === 0 && <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-3 text-[11px] font-medium text-emerald-700"><CircleCheck size={15} />Для этой задачи проблем не обнаружено.</div>}

      {!loading && !error && messages.length > 0 && <div className="mt-3 space-y-2.5">
        {messages.map((message, messageIndex) => {
          const presentation = severityPresentation[message.severity]
          return <article key={`${message.triggerTaskId}-${messageIndex}`} className={`rounded-xl border p-3 ${presentation.className}`}>
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <span className="text-[9px] font-bold uppercase tracking-[.08em]">{presentation.label}</span>
              <span className="text-[9px] opacity-70">Источник: {message.triggerTaskName}</span>
            </div>
            <p className="mt-1.5 text-[11px] font-semibold leading-4">{message.description}</p>

            {message.affectedTaskNames.length > 0 && <div className="mt-3">
              <p className="text-[9px] font-bold uppercase tracking-[.08em] opacity-70">Затронутые задачи</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {message.affectedTaskNames.map((name, index) => {
                  const affectedTaskId = message.affectedTaskIds[index]
                  const affectedTask = affectedTaskId ? taskById.get(affectedTaskId) : undefined
                  return affectedTask
                    ? <button key={`${affectedTaskId}-${index}`} type="button" onClick={() => onOpenTask(affectedTaskId)} className="inline-flex max-w-full items-center gap-1 rounded-lg bg-white/75 px-2 py-1 text-left text-[10px] font-semibold shadow-sm"><span className="truncate">{name}</span><ArrowUpRight size={11} className="shrink-0" /></button>
                    : <span key={`${name}-${index}`} className="max-w-full truncate rounded-lg bg-white/55 px-2 py-1 text-[10px] font-semibold">{name}</span>
                })}
              </div>
            </div>}

            {message.actions.length > 0 && <div className="mt-3">
              <p className="text-[9px] font-bold uppercase tracking-[.08em] opacity-70">Рекомендуемые действия</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {message.actions.map((action, actionIndex) => {
                  const isShiftAction = isScheduleShiftActionCode(action.code)
                  const targetExists = action.targetTaskId ? taskById.has(action.targetTaskId) : false
                  if (isShiftAction) return <button key={`${action.code}-${actionIndex}`} type="button" onClick={() => onRequestScheduleShift(message.triggerTaskId)} className="rounded-lg bg-white/80 px-2.5 py-1.5 text-[10px] font-bold shadow-sm">{action.label}</button>
                  if (action.targetTaskId && targetExists) return <button key={`${action.code}-${actionIndex}`} type="button" onClick={() => onOpenTask(action.targetTaskId!)} className="rounded-lg bg-white/80 px-2.5 py-1.5 text-[10px] font-bold shadow-sm">{action.label}</button>
                  return <span key={`${action.code}-${actionIndex}`} className="rounded-lg border border-current/10 bg-white/45 px-2.5 py-1.5 text-[10px] font-semibold">{action.label}</span>
                })}
              </div>
            </div>}
          </article>
        })}
      </div>}
    </section>
  )
}
