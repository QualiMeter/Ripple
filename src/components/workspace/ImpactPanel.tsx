import { useState } from 'react'
import { ArrowRight, Calculator, GitBranch, Lightbulb, MoveRight, Sparkles, TriangleAlert } from 'lucide-react'
import { describeImpactOutcome, describeLastChange } from '../../services/changeContext'
import type { ProjectTask } from '../../types/task'
import type { ProjectWorkspace } from '../../types/workspace'
import type { ScheduleShiftPreview } from '../../types/schedule'
import { formatAnalysisTime, formatShortDate } from '../../utils/date'

interface ImpactPanelProps {
  workspace: ProjectWorkspace
  onPreviewScheduleShift: () => Promise<ScheduleShiftPreview>
  onApplyScheduleShift: (preview: ScheduleShiftPreview) => Promise<void>
  onTaskSelect: (taskId: string) => void
}

export function ImpactPanel({ workspace, onPreviewScheduleShift, onApplyScheduleShift, onTaskSelect }: ImpactPanelProps) {
  const [preview, setPreview] = useState<ScheduleShiftPreview | null>(null)
  const [previewMessage, setPreviewMessage] = useState<string | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const { impact, tasks, recoveryScenarios } = workspace
  const affected = impact.affectedTaskIds
    .map((id) => tasks.find((task) => task.id === id))
    .filter((task): task is ProjectTask => Boolean(task))
  const changeDescription = describeLastChange(impact.lastChange, tasks, workspace.assignees)
  const impactOutcome = describeImpactOutcome(impact)
  const best = recoveryScenarios[0]
  const calculatePreview = async () => {
    setIsCalculating(true)
    setPreviewMessage(null)
    try {
      const result = await onPreviewScheduleShift()
      setPreview(result.taskShifts.length > 0 ? result : null)
      if (result.taskShifts.length === 0) setPreviewMessage('Конфликтов, требующих автоматического сдвига, не найдено.')
    } catch {
      setPreviewMessage('Не удалось рассчитать сдвиг. Попробуйте ещё раз.')
    } finally {
      setIsCalculating(false)
    }
  }

  const applyPreview = async () => {
    if (!preview) return
    setIsApplying(true)
    setPreviewMessage(null)
    try {
      await onApplyScheduleShift(preview)
      setPreview(null)
    } catch {
      setPreviewMessage('Предпросмотр устарел или не удалось применить сдвиг. Выполните расчёт повторно.')
    } finally {
      setIsApplying(false)
    }
  }
  return (
    <aside className="space-y-3">
      <section className="overflow-hidden rounded-2xl border border-[#efc5b5] bg-white shadow-panel">
        <div className="border-b border-[#f1d8ce] bg-gradient-to-r from-[#fff4ee] to-[#fffaf7] px-4 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#f9dfd2] text-[#c45a34]"><TriangleAlert size={17} /></span><div><h2 className="text-sm font-bold text-[#412e2a]">Последствия изменения</h2><p className="text-[10px] text-[#a17769]">Расчёт: {formatAnalysisTime(impact.analyzedAt)}</p></div></div>
            <span className="rounded-full bg-white px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-[#bb5834] shadow-sm">{impact.requiresIntervention ? 'Проект требует вмешательства' : 'Вмешательство не требуется'}</span>
          </div>
        </div>
        <div className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[.08em] text-[#aaa5b1]">Исходное изменение</p>
          <div className="mt-2 rounded-xl border border-[#eeeaf0] bg-[#faf9fb] p-3">
            <div className="flex items-start gap-2.5">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#e37149]" />
              <div><p className="text-xs font-bold text-[#3b3748]">{changeDescription.title}</p><div className="mt-1 space-y-0.5 text-[11px] leading-4 text-[#827d8d]">{changeDescription.details.map((detail) => <p key={detail}>{detail}</p>)}</div></div>
            </div>
          </div>
          <div className="mt-3 rounded-xl border border-[#f0ded6] bg-[#fffaf7] px-3 py-2.5"><p className="text-[10px] font-bold uppercase tracking-[.08em] text-[#aa7867]">Последствия</p><p className="mt-1 text-[11px] leading-4 text-[#756f7d]">{impactOutcome}</p></div>
          {impact.reasons.length > 0 && <div className="mt-3 space-y-2">
            {impact.reasons.map((reason, index) => {
              const source = tasks.find((task) => task.id === reason.sourceTaskId)
              const affectedTitles = reason.affectedTaskIds.map((taskId) => tasks.find((task) => task.id === taskId)?.title ?? taskId)
              const tone = reason.severity === 'error'
                ? 'border-rose-200 bg-rose-50 text-rose-800'
                : reason.severity === 'warning'
                  ? 'border-amber-200 bg-amber-50 text-amber-900'
                  : 'border-sky-200 bg-sky-50 text-sky-900'
              return <div key={`${reason.sourceTaskId}-${index}`} className={`rounded-xl border p-3 ${tone}`}>
                <div className="flex items-center justify-between gap-2"><span className="text-[9px] font-bold uppercase tracking-[.08em]">{reason.severity === 'error' ? 'Ошибка' : reason.severity === 'warning' ? 'Предупреждение' : 'Информация'}</span><span className="truncate text-[9px] opacity-70">Источник: {source?.title ?? reason.sourceTaskId}</span></div>
                <p className="mt-1.5 text-[11px] font-semibold leading-4">{reason.reason}</p>
                <p className="mt-1 text-[10px] leading-4 opacity-80">{reason.consequence}</p>
                <p className="mt-1 text-[9px] opacity-65">Затронуто: {affectedTitles.join(', ')}</p>
                {reason.action && <button type="button" onClick={() => reason.action?.type === 'open-task' ? onTaskSelect(reason.action.taskId) : calculatePreview()} className="mt-2 rounded-lg bg-white/70 px-2.5 py-1.5 text-[10px] font-bold shadow-sm">{reason.action.type === 'open-task' ? 'Открыть задачу' : 'Рассчитать сдвиг'}</button>}
              </div>
            })}
          </div>}
          <div className="my-3 flex items-center gap-2 text-[10px] font-semibold text-[#a29daa]"><GitBranch size={13} /><span>Задач под влиянием: {affected.length}</span><span className="h-px flex-1 bg-[#ebe8ee]" /></div>
          <div className="space-y-2">
            {affected.map((task, index) => (
              <div key={task.id} className="flex items-center gap-2.5">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-[#fff0e8] text-[9px] font-bold text-[#c45b37]">{index + 1}</span>
                <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-semibold text-[#514c5e]">{task.title}</p><p className="text-[10px] text-[#9995a2]">{task.changeNote ?? 'Задача учтена в анализе последнего изменения'}</p></div>
                <MoveRight size={13} className="text-[#c6c2cc]" />
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between rounded-xl bg-[#29263e] p-3 text-white">
            <div><p className="text-[10px] text-[#b7b3c5]">Завершение проекта</p><p className="mt-0.5 text-sm font-bold">{formatShortDate(impact.previousProjectEndDate)} <ArrowRight size={12} className="mx-1 inline" /> {formatShortDate(impact.projectedProjectEndDate)}</p></div>
            <div className="rounded-lg bg-[#e36f49] px-2 py-1.5 text-xs font-bold">{impact.projectEndChangeDays > 0 ? `+${impact.projectEndChangeDays} дн.` : impact.projectEndChangeDays < 0 ? `${impact.projectEndChangeDays} дн.` : 'Без изменений'}</div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#e1ddec] bg-white p-4 shadow-panel">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#f0edff] text-[#6556d9]"><Calculator size={18} /></span>
          <div><h2 className="text-sm font-bold text-[#363247]">Автоматический сдвиг</h2><p className="mt-0.5 text-[10px] leading-4 text-[#8c8798]">Даты изменятся только после подтверждения предложенного плана.</p></div>
        </div>
        {!preview && <button type="button" onClick={calculatePreview} disabled={isCalculating} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#29263e] px-3 py-2.5 text-xs font-bold text-white transition hover:bg-[#37334f] disabled:opacity-60">{isCalculating ? 'Расчёт…' : 'Рассчитать автоматический сдвиг'}</button>}
        {preview && <div className="mt-3 rounded-xl border border-[#e7e2fb] bg-[#faf9ff] p-3">
          <p className="text-[10px] font-bold uppercase tracking-[.08em] text-[#7468bd]">Предпросмотр</p>
          <div className="mt-2 max-h-48 space-y-2 overflow-y-auto">
            {preview.taskShifts.map((shift) => {
              const task = tasks.find((candidate) => candidate.id === shift.taskId)
              return <div key={shift.taskId} className="rounded-lg bg-white p-2.5 text-[10px] text-[#777181]">
                <div className="flex items-center justify-between gap-2"><span className="truncate font-bold text-[#474252]">{task?.title ?? shift.taskId}</span><span className="shrink-0 font-bold text-[#c45b37]">+{shift.shiftDays} дн.</span></div>
                <p className="mt-1">{formatShortDate(shift.currentStartDate)}–{formatShortDate(shift.currentEndDate)} <ArrowRight size={10} className="mx-1 inline" /> {formatShortDate(shift.proposedStartDate)}–{formatShortDate(shift.proposedEndDate)}</p>
              </div>
            })}
          </div>
          <div className="mt-3 border-t border-[#e7e2fb] pt-2 text-[10px] text-[#777181]">Завершение проекта: <strong className="text-[#474252]">{formatShortDate(preview.currentProjectEndDate)} <ArrowRight size={10} className="mx-1 inline" /> {formatShortDate(preview.proposedProjectEndDate)}</strong> ({preview.projectEndShiftDays > 0 ? '+' : ''}{preview.projectEndShiftDays} дн.)</div>
          <div className="mt-3 flex gap-2"><button type="button" disabled={isApplying} onClick={() => setPreview(null)} className="flex-1 rounded-xl border border-[#dedbe4] px-3 py-2 text-xs font-semibold text-[#625d6c] disabled:opacity-50">Отмена</button><button type="button" disabled={isApplying} onClick={applyPreview} className="flex-1 rounded-xl bg-[#6d5dfb] px-3 py-2 text-xs font-bold text-white disabled:opacity-60">{isApplying ? 'Применение…' : 'Подтвердить'}</button></div>
        </div>}
        {previewMessage && <p className="mt-3 rounded-lg bg-[#f5f3fa] px-3 py-2 text-[10px] leading-4 text-[#716b7b]" role="status">{previewMessage}</p>}
      </section>

      <section className="rounded-2xl border border-[#ded8fb] bg-gradient-to-br from-white to-[#f8f6ff] p-4 shadow-panel">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#eae6ff] text-[#6556d9]"><Lightbulb size={18} /></span>
          <div><div className="flex items-center gap-1.5"><h2 className="text-sm font-bold text-[#363247]">Как сохранить срок</h2><Sparkles size={12} className="text-[#806fe5]" /></div><p className="mt-0.5 text-[10px] leading-4 text-[#8c8798]">{best ? 'Найден лучший сценарий восстановления' : impact.requiresIntervention ? 'Безопасный сценарий не найден' : 'Восстановление срока не требуется'}</p></div>
        </div>
        {best ? (
          <>
            <div className="mt-3 rounded-xl border border-[#e7e2fb] bg-white p-3">
              <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold text-[#433e54]">{best.title}</p><p className="mt-1 text-[10px] leading-4 text-[#878292]">{best.description}</p></div><span className="whitespace-nowrap rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-bold text-emerald-700">Вернуть {best.recoveredDays} дн.</span></div>
              <div className="mt-3 flex items-center justify-between border-t border-[#eeebf3] pt-3"><span className="text-[10px] text-[#918c9c]">Ожидаемое завершение</span><span className="text-xs font-bold text-[#494358]">{formatShortDate(impact.projectedProjectEndDate)} <ArrowRight size={11} className="mx-1 inline" /> {formatShortDate(best.expectedProjectEndDate)}</span></div>
            </div>
            <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#6d5dfb] px-3 py-2.5 text-xs font-bold text-white shadow-[0_8px_18px_rgba(109,93,251,.2)] transition hover:bg-[#5f4fe8]">Посмотреть план восстановления <ArrowRight size={14} /></button>
          </>
        ) : (
          <div className="mt-3 rounded-xl border border-[#e7e2fb] bg-white p-3">
            <p className="text-xs font-bold text-[#433e54]">{impact.requiresIntervention ? 'Нет доступного плана восстановления' : 'Проект укладывается в срок'}</p>
            <p className="mt-1 text-[10px] leading-4 text-[#878292]">{impact.requiresIntervention ? 'Ripple не удалось найти безопасный способ скорректировать план с учётом текущих последствий.' : 'Дополнительные действия для восстановления планового срока сейчас не нужны.'}</p>
          </div>
        )}
      </section>
    </aside>
  )
}
