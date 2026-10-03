import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowRight, GitBranch, ShieldCheck, TriangleAlert, Users, X } from 'lucide-react'
import type { ScheduleShiftPreview } from '../../types/schedule'
import type { ProjectWorkspace } from '../../types/workspace'
import { buildRecoveryPlan, buildScheduleRecoveryResult, type RecoveryOption } from '../../services/recoveryPlan'
import type { TaskReassignmentPreview } from '../../services/taskReassignment'
import { formatFullDate, formatMonthDay, formatShortDate } from '../../utils/date'
import { pluralizeRu } from '../../utils/plural'
import { getErrorMessage } from '../../utils/error'
import { getPanelMode } from '../../services/aiPanelPreferences'

interface RecoveryPlanProps {
  workspace: ProjectWorkspace
  onClose: () => void
  onPreviewScheduleShift: (sourceTaskId: string) => Promise<ScheduleShiftPreview>
  onApplyScheduleShift: (preview: ScheduleShiftPreview, confirmProjectEndDate: boolean) => Promise<void>
  onApplyTaskReassignment?: (preview: TaskReassignmentPreview) => Promise<void>
  onShowCriticalChain: (taskIds: string[]) => void
  onTaskSelect: (taskId: string) => void
}

type SuccessSummary =
  | { type: 'schedule'; conflictsBefore: number; conflictsAfter: number; delayDaysBefore: number; projectedEndDateAfter: string; changedTaskCount: number }
  | { type: 'workload'; taskTitle: string; sourceName: string; candidateName: string }

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <div className={`rounded-xl border px-3 py-2.5 ${accent ? 'border-rose-200 bg-rose-50' : 'border-[#e8e4ed] bg-white'}`}><p className="text-[9px] font-bold uppercase tracking-[.08em] text-[#96909e]">{label}</p><p className={`mt-1 text-sm font-bold ${accent ? 'text-rose-700' : 'text-[#393447]'}`}>{value}</p></div>
}

function OptionShell({ index, title, icon, children }: { index: number; title: string; icon: ReactNode; children: ReactNode }) {
  return <section className="rounded-2xl border border-[#e4e0e9] bg-white p-4" data-recovery-option="true">
    <div className="flex items-center gap-2.5"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#f0edff] text-[#6556d9]">{icon}</span><div><p className="text-[9px] font-bold uppercase tracking-[.1em] text-[#96909e]">Вариант {index}</p><h3 className="text-sm font-bold text-[#373244]">{title}</h3></div></div>
    {children}
  </section>
}

export function RecoveryPlan({
 workspace, onClose, onPreviewScheduleShift, onApplyScheduleShift, onApplyTaskReassignment, onShowCriticalChain, onTaskSelect }: RecoveryPlanProps) {
	const panelMode = getPanelMode()
	const isDialog = panelMode === 'dialog'
  const basePlan = useMemo(() => buildRecoveryPlan(workspace), [workspace])
  const localScheduleOption = basePlan.options.find((option): option is Extract<RecoveryOption, { type: 'schedule-shift' }> => option.type === 'schedule-shift')
  const [confirmedSchedulePreview, setConfirmedSchedulePreview] = useState<ScheduleShiftPreview | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [isCalculating, setIsCalculating] = useState(Boolean(localScheduleOption))
  const [applyingType, setApplyingType] = useState<RecoveryOption['type'] | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [success, setSuccess] = useState<SuccessSummary | null>(null)
  const actionInFlightRef = useRef(false)
  const plan = useMemo(() => buildRecoveryPlan(workspace, confirmedSchedulePreview), [workspace, confirmedSchedulePreview])

  useEffect(() => {
    const sourceTaskId = localScheduleOption?.sourceTaskId
    if (!sourceTaskId) {
      setConfirmedSchedulePreview(null)
      setIsCalculating(false)
      return
    }
    let active = true
    setIsCalculating(true)
    setPreviewError(null)
    setConfirmedSchedulePreview(null)
    void onPreviewScheduleShift(sourceTaskId).then((preview) => {
      if (active) setConfirmedSchedulePreview(preview)
    }).catch((error) => {
      if (active) setPreviewError(getErrorMessage(error, 'Не удалось получить актуальный расчёт сдвига.'))
    }).finally(() => {
      if (active) setIsCalculating(false)
    })
    return () => { active = false }
  }, [localScheduleOption?.sourceTaskId, onPreviewScheduleShift, workspace.project.id])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !actionInFlightRef.current) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const applySchedule = async () => {
    const option = plan.options.find((candidate): candidate is Extract<RecoveryOption, { type: 'schedule-shift' }> => candidate.type === 'schedule-shift')
    if (!option || !confirmedSchedulePreview || actionInFlightRef.current) return
    actionInFlightRef.current = true
    setApplyingType('schedule-shift')
    setActionError(null)
    const result = buildScheduleRecoveryResult(workspace, confirmedSchedulePreview)
    try {
      await onApplyScheduleShift(confirmedSchedulePreview, false)
      setSuccess({
        type: 'schedule', conflictsBefore: result.conflictsBefore, conflictsAfter: result.conflictsAfter,
        delayDaysBefore: result.delayDaysBefore, projectedEndDateAfter: result.projectedEndDateAfter,
        changedTaskCount: result.changedTaskCount,
      })
      setConfirmedSchedulePreview(null)
    } catch (error) {
      setActionError(getErrorMessage(error, 'Не удалось применить безопасный сдвиг.'))
    } finally {
      actionInFlightRef.current = false
      setApplyingType(null)
    }
  }

  const applyReassignment = async (option: Extract<RecoveryOption, { type: 'workload-reassignment' }>) => {
    if (!onApplyTaskReassignment || actionInFlightRef.current) return
    actionInFlightRef.current = true
    setApplyingType('workload-reassignment')
    setActionError(null)
    try {
      await onApplyTaskReassignment(option.preview)
      setSuccess({ type: 'workload', taskTitle: option.preview.taskTitle, sourceName: option.preview.sourceEmployeeName, candidateName: option.preview.candidateEmployeeName })
    } catch (error) {
      setActionError(getErrorMessage(error, 'Не удалось перераспределить задачу.'))
    } finally {
      actionInFlightRef.current = false
      setApplyingType(null)
    }
  }

  const taskTitle = (taskId: string) => workspace.tasks.find((task) => task.id === taskId)?.title ?? taskId
  const chainTitles = plan.criticalChainTaskIds.map(taskTitle)

  return <div className={isDialog ? "fixed inset-0 z-[90] grid place-items-center bg-[#17152b]/45 p-4 backdrop-blur-[1px]" : "fixed inset-0 z-[90] flex justify-end bg-[#17152b]/45 backdrop-blur-[1px]"} role="dialog" aria-modal="true" aria-labelledby="recovery-plan-title">
    <button type="button" className="min-w-0 flex-1" onClick={onClose} aria-label="Закрыть план восстановления по фону" />
    <aside className="flex h-full w-full max-w-[680px] flex-col bg-[#f7f6f9] shadow-[-24px_0_64px_rgba(23,21,43,.24)]">
      <header className="flex items-start gap-3 border-b border-[#e3dfe8] bg-white px-5 py-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-600"><ShieldCheck size={20} /></span>
        <div><h2 id="recovery-plan-title" className="text-lg font-bold text-[#302b3e]">План восстановления</h2><p className="mt-0.5 text-[11px] text-[#888291]">Рассчитанные варианты действий по текущему состоянию проекта</p></div>
        <button type="button" onClick={onClose} disabled={applyingType !== null} className="ml-auto grid h-9 w-9 place-items-center rounded-xl text-[#777181] hover:bg-[#f4f2f6] disabled:opacity-50" aria-label="Закрыть план восстановления"><X size={18} /></button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {success && <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4" role="status" data-recovery-success="true"><p className="text-sm font-bold text-emerald-800">План обновлён</p>{success.type === 'schedule' ? <div className="mt-2 grid grid-cols-2 gap-3 text-[10px] leading-4 text-emerald-900"><div><p className="font-bold uppercase opacity-60">Было</p><p>{success.conflictsBefore} {pluralizeRu(success.conflictsBefore, ['конфликт', 'конфликта', 'конфликтов'])}</p><p>Прогноз: +{success.delayDaysBefore} дн.</p></div><div><p className="font-bold uppercase opacity-60">Стало</p><p>{success.conflictsAfter} {pluralizeRu(success.conflictsAfter, ['конфликт', 'конфликта', 'конфликтов'])}</p><p>Прогноз: {formatMonthDay(success.projectedEndDateAfter)}</p></div><p className="col-span-2 font-semibold">Изменено задач: {success.changedTaskCount}</p></div> : <p className="mt-2 text-[11px] text-emerald-900">«{success.taskTitle}»: {success.sourceName} <ArrowRight size={11} className="mx-1 inline" /> {success.candidateName}. Даты, статус и зависимости не изменялись.</p>}</div>}

        <div className="grid grid-cols-3 gap-2">
          <Stat label="Плановый срок" value={formatMonthDay(plan.plannedEndDate)} />
          <Stat label="Текущий прогноз" value={formatMonthDay(plan.projectedEndDate)} />
          <Stat label="Отклонение" value={plan.delayDays > 0 ? `+${plan.delayDays} дн.` : 'Нет'} accent={plan.delayDays > 0} />
        </div>
        <section className="mt-4 rounded-2xl border border-[#e4e0e9] bg-white p-4">
          <p className="text-[9px] font-bold uppercase tracking-[.1em] text-[#96909e]">Что произошло</p>
          <p className="mt-1.5 text-sm font-bold text-[#3b3648]">{plan.cause.title}</p>
          <p className="mt-1 text-[11px] leading-5 text-[#777181]">{plan.cause.detail}</p>
          {plan.affectedTaskIds.length > 0 && <p className="mt-2 text-[10px] text-[#8d8796]">Изменение затрагивает: {plan.affectedTaskIds.map(taskTitle).join(', ')}.</p>}
          {chainTitles.length > 0 && <div className="mt-3 flex items-start gap-2 rounded-xl bg-[#f6f4fa] px-3 py-2.5"><GitBranch size={14} className="mt-0.5 shrink-0 text-[#695bcf]" /><div><p className="text-[9px] font-bold uppercase tracking-[.08em] text-[#8d8796]">Критическая цепочка</p><p className="mt-1 text-[11px] font-semibold text-[#514b5d]">{chainTitles.join(' → ')}</p></div></div>}
        </section>

        <div className="mb-2 mt-5"><h3 className="text-sm font-bold text-[#363143]">Варианты действий</h3><p className="mt-0.5 text-[10px] text-[#8d8796]">Каждый вариант рассчитан независимо. Изменения применяются только после подтверждения.</p></div>
        <div className="space-y-3">{plan.options.map((option, index) => {
          if (option.type === 'schedule-shift') return <OptionShell key={option.type} index={index + 1} title="Принять изменение и перестроить график" icon={<GitBranch size={16} />}>
            <div className="mt-3 space-y-2">{option.taskShifts.map((shift) => <div key={shift.taskId} className="rounded-xl bg-[#f8f7fa] px-3 py-2 text-[10px]"><p className="font-bold text-[#4b4657]">{taskTitle(shift.taskId)}</p><p className="mt-0.5 text-[#7d7787]">{formatShortDate(shift.currentStartDate)}–{formatShortDate(shift.currentEndDate)} <ArrowRight size={10} className="mx-1 inline" /> {formatShortDate(shift.proposedStartDate)}–{formatShortDate(shift.proposedEndDate)}</p></div>)}</div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]"><div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-900"><p className="font-bold">Что изменится</p><p className="mt-1">{option.taskShifts.length} {pluralizeRu(option.taskShifts.length, ['задача изменится', 'задачи изменятся', 'задач изменятся'])}; конфликтов: {option.conflictsBefore} → {option.conflictsAfter}; завершение: {formatShortDate(option.preview.currentProjectEndDate)} → {formatShortDate(option.preview.proposedProjectEndDate)}.</p></div><div className="rounded-xl bg-amber-50 p-2.5 text-amber-900"><p className="font-bold">Что останется</p><p className="mt-1">{option.remainingProblem}</p></div></div>
            {previewError && <p className="mt-2 rounded-lg bg-rose-50 px-2.5 py-2 text-[10px] text-rose-700" role="alert">{previewError}</p>}
            <button type="button" disabled={isCalculating || !confirmedSchedulePreview || applyingType !== null} onClick={() => { void applySchedule() }} className="mt-3 w-full rounded-xl bg-[#6d5dfb] px-3 py-2.5 text-xs font-bold text-white disabled:opacity-55">{applyingType === 'schedule-shift' ? 'Применение…' : isCalculating ? 'Проверка расчёта…' : 'Применить безопасный сдвиг'}</button>
          </OptionShell>
          if (option.type === 'preserve-deadline') return <OptionShell key={option.type} index={index + 1} title="Сохранить плановый срок" icon={<TriangleAlert size={16} />}>
            <p className="mt-3 text-[11px] leading-5 text-[#635d6d]">Чтобы сохранить {formatFullDate(plan.plannedEndDate)}, руководителю необходимо вернуть <strong>{option.daysToRecover} {pluralizeRu(option.daysToRecover, ['календарный день', 'календарных дня', 'календарных дней'])}</strong> на критической цепочке.</p>
            <div className="mt-2 rounded-xl bg-[#f8f7fa] px-3 py-2.5"><p className="text-[9px] font-bold uppercase tracking-[.08em] text-[#96909e]">Задачи без резерва</p><p className="mt-1 text-[11px] font-semibold text-[#4f4959]">{option.criticalTaskIds.map(taskTitle).join(', ')}</p></div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]"><div className="rounded-xl bg-sky-50 p-2.5 text-sky-900"><p className="font-bold">Что изменится</p><p className="mt-1">Ripple подсветит работы, где изменение может повлиять на окончание проекта. Некритические задачи срок не сократят.</p></div><div className="rounded-xl bg-amber-50 p-2.5 text-amber-900"><p className="font-bold">Что останется</p><p className="mt-1">{option.remainingProblem}</p></div></div>
            <button type="button" onClick={() => { onShowCriticalChain(option.criticalTaskIds); onClose() }} className="mt-3 w-full rounded-xl border border-[#cfc8f7] bg-[#f4f1ff] px-3 py-2.5 text-xs font-bold text-[#5f51c8]">Показать критическую цепочку</button>
          </OptionShell>
          if (option.type === 'workload-reassignment') return <OptionShell key={option.type} index={index + 1} title="Перераспределить работу" icon={<Users size={16} />}>
            <div className="mt-3 rounded-xl bg-[#f8f7fa] p-3"><p className="text-xs font-bold text-[#474252]">{option.preview.taskTitle}</p><p className="mt-1 text-[10px] font-semibold text-[#6f6879]">{option.preview.sourceEmployeeName} <ArrowRight size={10} className="mx-1 inline" /> {option.preview.candidateEmployeeName}</p></div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]"><div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-900"><p className="font-bold">Что изменится</p><p className="mt-1">{option.preview.sourceEmployeeName}: пик {option.preview.sourceBefore.peakConcurrency} → {option.preview.sourceAfter.peakConcurrency}. {option.preview.candidateEmployeeName}: пик {option.preview.candidateBefore.peakConcurrency} → {option.preview.candidateAfter.peakConcurrency}.</p></div><div className="rounded-xl bg-amber-50 p-2.5 text-amber-900"><p className="font-bold">Что останется</p><p className="mt-1">Даты, статус и зависимости не изменятся. {option.remainingProblem}</p></div></div>
            <button type="button" disabled={!onApplyTaskReassignment || applyingType !== null} onClick={() => { void applyReassignment(option) }} className="mt-3 w-full rounded-xl bg-[#6d5dfb] px-3 py-2.5 text-xs font-bold text-white disabled:opacity-55">{applyingType === 'workload-reassignment' ? 'Применение…' : 'Подтвердить перераспределение'}</button>
          </OptionShell>
          return <OptionShell key={option.type} index={index + 1} title="Проверить фактические даты" icon={<TriangleAlert size={16} />}><p className="mt-3 text-[11px] leading-5 text-[#635d6d]">{option.reason}</p><div className="mt-2 rounded-xl bg-amber-50 p-2.5 text-[10px] text-amber-900"><p className="font-bold">Что останется</p><p className="mt-1">{option.remainingProblem}</p></div><button type="button" onClick={() => { onTaskSelect(option.taskId); onClose() }} className="mt-3 w-full rounded-xl bg-[#29263e] px-3 py-2.5 text-xs font-bold text-white">Открыть «{option.taskTitle}»</button></OptionShell>
        })}</div>
        {actionError && <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-700" role="alert">{actionError}</p>}
      </div>
    </aside>
  </div>
}
