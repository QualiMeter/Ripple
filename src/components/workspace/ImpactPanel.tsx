import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, Calculator, GitBranch, Lightbulb, MoveRight, ShieldAlert, TriangleAlert, Users } from 'lucide-react'
import { describeImpactOutcome, describeLastChange } from '../../services/changeContext'
import { getSchedulePreviewSourceIds } from '../../services/schedulePreviewSource'
import type { ProjectTask } from '../../types/task'
import type { ProjectWorkspace } from '../../types/workspace'
import type { ScheduleShiftPreview } from '../../types/schedule'
import { formatAnalysisTime, formatFullDate, formatMonthDay, formatShortDate } from '../../utils/date'
import { getErrorMessage } from '../../utils/error'
import { describeScheduleConflict } from '../../services/scheduleConflictPresentation'
import { buildProjectRecommendations, type ProjectRecommendationAction } from '../../services/projectRecommendations'
import type { TimelineDraftApplyMode, TimelineDraftPreview } from '../../services/timelineDraft'
import { analyzeTeamWorkload, WORKLOAD_LEVEL_LABELS } from '../../services/teamWorkload'
import type { TaskReassignmentPreview } from '../../services/taskReassignment'
import { pluralizeRu } from '../../utils/plural'
import { buildRecoveryPlan } from '../../services/recoveryPlan'
import { RecoveryPlan } from './RecoveryPlan'

interface ImpactPanelProps {
  workspace: ProjectWorkspace
  timelineDraft?: TimelineDraftPreview | null
  onApplyTimelineDraft?: (mode: TimelineDraftApplyMode) => Promise<void>
  onCancelTimelineDraft?: () => void
  onViewWorkload?: () => void
  onApplyTaskReassignment?: (preview: TaskReassignmentPreview) => Promise<void>
  onShowCriticalChain?: (taskIds: string[]) => void
  onPreviewScheduleShift: (sourceTaskId: string) => Promise<ScheduleShiftPreview>
  onApplyScheduleShift: (preview: ScheduleShiftPreview, confirmProjectEndDate: boolean) => Promise<void>
  onTaskSelect: (taskId: string) => void
  requestedPreviewSourceId?: string | null
  onRequestedPreviewHandled?: () => void
}

export function ImpactPanel({ workspace, timelineDraft, onApplyTimelineDraft, onCancelTimelineDraft, onViewWorkload, onApplyTaskReassignment, onShowCriticalChain, onPreviewScheduleShift, onApplyScheduleShift, onTaskSelect, requestedPreviewSourceId, onRequestedPreviewHandled }: ImpactPanelProps) {
  const [preview, setPreview] = useState<ScheduleShiftPreview | null>(null)
  const [previewMessage, setPreviewMessage] = useState<string | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const applyInFlightRef = useRef(false)
  const [selectedPreviewSourceId, setSelectedPreviewSourceId] = useState('')
  const [showAllIssues, setShowAllIssues] = useState(false)
  const [isApplyingDraft, setIsApplyingDraft] = useState(false)
  const [applyingDraftMode, setApplyingDraftMode] = useState<TimelineDraftApplyMode | null>(null)
  const [draftMessage, setDraftMessage] = useState<string | null>(null)
  const [showAllWorkload, setShowAllWorkload] = useState(false)
  const [reassignmentPreview, setReassignmentPreview] = useState<TaskReassignmentPreview | null>(null)
  const [reassignmentError, setReassignmentError] = useState<string | null>(null)
  const [isApplyingReassignment, setIsApplyingReassignment] = useState(false)
  const [recoveryPlanOpen, setRecoveryPlanOpen] = useState(false)
  const reassignmentInFlightRef = useRef(false)
  const { impact, currentIssues, tasks } = workspace
  const affected = impact.affectedTaskIds
    .map((id) => tasks.find((task) => task.id === id))
    .filter((task): task is ProjectTask => Boolean(task))
  const changeDescription = describeLastChange(impact.lastChange, tasks, workspace.assignees)
  const impactOutcome = describeImpactOutcome(impact)
  const previewSourceIds = getSchedulePreviewSourceIds(currentIssues)
  const commonPreviewSourceId = previewSourceIds.length === 1
    ? previewSourceIds[0]
    : previewSourceIds.includes(selectedPreviewSourceId)
      ? selectedPreviewSourceId
      : ''
  const currentIssueGroups = [
    { id: 'schedule', title: 'Конфликты зависимостей и дат', items: currentIssues.scheduleConflicts },
    { id: 'status', title: 'Логические конфликты статусов', items: currentIssues.statusConflicts },
    { id: 'deadline', title: 'Просроченные сроки', items: currentIssues.deadlineIssues },
  ]
  const currentIssueCount = currentIssueGroups.reduce((count, group) => count + group.items.length, 0)
  const recommendations = buildProjectRecommendations(workspace, preview)
  const recoveryPlan = buildRecoveryPlan(workspace)
  const teamWorkload = analyzeTeamWorkload(workspace.assignees, tasks)
  const visibleTeamWorkload = showAllWorkload ? teamWorkload : teamWorkload.slice(0, 4)
  const attentionCount = recommendations[0]?.tone === 'success' ? 0 : recommendations.length
  const hasApplicablePreviewShifts = preview?.taskShifts.some((shift) => (
    !shift.completedRequiresManualResolution
    && (shift.currentStartDate !== shift.proposedStartDate || shift.currentEndDate !== shift.proposedEndDate)
  )) ?? false
  const hasRecommendedDraftCorrection = Boolean(timelineDraft && (
    timelineDraft.recommendedTaskChanges.some((recommended) => {
      const userChange = timelineDraft.userTaskChanges.find((change) => change.taskId === recommended.taskId)
      return !userChange || userChange.proposedStartDate !== recommended.proposedStartDate || userChange.proposedEndDate !== recommended.proposedEndDate
    })
  ))
  const calculatePreview = useCallback(async (sourceTaskId: string) => {
    setIsCalculating(true)
    setPreviewMessage(null)
    try {
      const result = await onPreviewScheduleShift(sourceTaskId)
      setPreview(result.taskShifts.length > 0 ? result : null)
      if (result.taskShifts.length === 0) setPreviewMessage('Конфликтов, требующих автоматического сдвига, не найдено.')
    } catch (error) {
      setPreviewMessage(getErrorMessage(error, 'Не удалось рассчитать сдвиг. Попробуйте ещё раз.'))
    } finally {
      setIsCalculating(false)
    }
  }, [onPreviewScheduleShift])

  useEffect(() => {
    if (!requestedPreviewSourceId) return
    onRequestedPreviewHandled?.()
    void calculatePreview(requestedPreviewSourceId)
  }, [calculatePreview, onRequestedPreviewHandled, requestedPreviewSourceId])

  const applyPreview = async (confirmProjectEndDate: boolean) => {
    if (!preview || applyInFlightRef.current) return
    applyInFlightRef.current = true
    setIsApplying(true)
    setPreviewMessage(null)
    try {
      await onApplyScheduleShift(preview, confirmProjectEndDate)
      setPreview(null)
    } catch (error) {
      setPreviewMessage(getErrorMessage(error, 'Предпросмотр устарел или не удалось применить сдвиг. Выполните расчёт повторно.'))
    } finally {
      applyInFlightRef.current = false
      setIsApplying(false)
    }
  }
  const confirmShiftWithoutDeadlineChange = () => applyPreview(false)
  const confirmShiftWithDeadlineChange = () => applyPreview(true)
  const applyTimelineDraft = async (mode: TimelineDraftApplyMode) => {
    if (!onApplyTimelineDraft || isApplyingDraft) return
    setIsApplyingDraft(true)
    setApplyingDraftMode(mode)
    setDraftMessage(null)
    try {
      await onApplyTimelineDraft(mode)
    } catch (draftError) {
      setDraftMessage(getErrorMessage(draftError, 'Не удалось применить изменения.'))
    } finally {
      setIsApplyingDraft(false)
      setApplyingDraftMode(null)
    }
  }
  const applyReassignment = async () => {
    if (!reassignmentPreview || !onApplyTaskReassignment || reassignmentInFlightRef.current) return
    reassignmentInFlightRef.current = true
    setIsApplyingReassignment(true)
    setReassignmentError(null)
    try {
      await onApplyTaskReassignment(reassignmentPreview)
      setReassignmentPreview(null)
    } catch (reassignmentFailure) {
      setReassignmentError(getErrorMessage(reassignmentFailure, 'Не удалось изменить ответственного.'))
    } finally {
      reassignmentInFlightRef.current = false
      setIsApplyingReassignment(false)
    }
  }
  const handleRecommendationAction = (action: ProjectRecommendationAction) => {
    if (action.type === 'preview-shift') {
      void calculatePreview(action.sourceTaskId)
      return
    }
    if (action.type === 'open-task') {
      onTaskSelect(action.taskId)
      return
    }
    if (action.type === 'preview-reassignment') {
      setReassignmentError(null)
      setReassignmentPreview(action.preview)
      return
    }
    onViewWorkload?.()
  }
  if (tasks.length === 0) {
    return <aside><section className="rounded-2xl border border-[#e5e2ea] bg-white px-5 py-12 text-center shadow-panel"><TriangleAlert size={22} className="mx-auto text-[#aaa4b5]" /><p className="mt-3 text-sm font-semibold text-[#4b4658]">Пока нечего анализировать</p><p className="mt-1 text-[11px] leading-4 text-[#918d9b]">Добавьте задачи и зависимости, чтобы Ripple показал риски и последствия изменений.</p></section></aside>
  }
  return (
    <aside className="space-y-3">
      {recoveryPlanOpen && <RecoveryPlan workspace={workspace} onClose={() => setRecoveryPlanOpen(false)} onPreviewScheduleShift={onPreviewScheduleShift} onApplyScheduleShift={onApplyScheduleShift} onApplyTaskReassignment={onApplyTaskReassignment} onShowCriticalChain={onShowCriticalChain ?? (() => undefined)} onTaskSelect={onTaskSelect} />}
      {reassignmentPreview && <section className="rounded-2xl border border-[#cfc8f7] bg-[#faf9ff] p-4 shadow-panel" data-reassignment-preview="true">
        <div><p className="text-[9px] font-bold uppercase tracking-[.1em] text-[#7768ed]">Предпросмотр</p><h2 className="mt-0.5 text-sm font-bold text-[#363247]">Перераспределение задачи</h2></div>
        <div className="mt-3 rounded-xl border border-[#e6e1fa] bg-white p-3"><p className="text-xs font-bold text-[#474252]">{reassignmentPreview.taskTitle}</p><p className="mt-1 text-[10px] font-semibold text-[#6f6879]" aria-label={`${reassignmentPreview.sourceEmployeeName} → ${reassignmentPreview.candidateEmployeeName}`}>{reassignmentPreview.sourceEmployeeName} <ArrowRight size={11} className="mx-1 inline" /> {reassignmentPreview.candidateEmployeeName}</p></div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] leading-4">
          <div className="rounded-xl bg-white p-2.5"><p className="font-bold uppercase tracking-[.08em] text-[#9993a4]">До</p><p className="mt-1 font-semibold text-[#554f60]">{reassignmentPreview.sourceEmployeeName} — {WORKLOAD_LEVEL_LABELS[reassignmentPreview.sourceBefore.level]}, пик {reassignmentPreview.sourceBefore.peakConcurrency}</p><p className="text-[#777181]">{reassignmentPreview.candidateEmployeeName} — {WORKLOAD_LEVEL_LABELS[reassignmentPreview.candidateBefore.level]}, пик {reassignmentPreview.candidateBefore.peakConcurrency}</p></div>
          <div className="rounded-xl bg-white p-2.5"><p className="font-bold uppercase tracking-[.08em] text-[#9993a4]">После</p><p className="mt-1 font-semibold text-[#554f60]">{reassignmentPreview.sourceEmployeeName} — {WORKLOAD_LEVEL_LABELS[reassignmentPreview.sourceAfter.level]}, пик {reassignmentPreview.sourceAfter.peakConcurrency}</p><p className="text-[#777181]">{reassignmentPreview.candidateEmployeeName} — {WORKLOAD_LEVEL_LABELS[reassignmentPreview.candidateAfter.level]}, пик {reassignmentPreview.candidateAfter.peakConcurrency}</p></div>
        </div>
        <div className="mt-3 space-y-0.5 rounded-xl bg-[#f1effa] px-3 py-2.5 text-[10px] text-[#686273]"><p>Даты: без изменений</p><p>Статус: без изменений</p><p>Зависимости: без изменений</p></div>
        <p className="mt-2 text-[9px] leading-4 text-[#8d8797]">Оценка основана на расписании и не учитывает компетенции и фактическую трудоёмкость.</p>
        {reassignmentError && <p className="mt-2 rounded-lg bg-rose-50 px-2.5 py-2 text-[10px] text-rose-700" role="alert">{reassignmentError}</p>}
        <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" disabled={isApplyingReassignment} onClick={() => { setReassignmentPreview(null); setReassignmentError(null) }} className="rounded-xl border border-[#dcd7ee] bg-white px-3 py-2 text-xs font-semibold text-[#625d6c] disabled:opacity-50">Отмена</button><button type="button" disabled={isApplyingReassignment || !onApplyTaskReassignment} onClick={() => { void applyReassignment() }} className="rounded-xl bg-[#6d5dfb] px-3 py-2 text-xs font-bold text-white disabled:opacity-60">{isApplyingReassignment ? 'Применение…' : 'Подтвердить перераспределение'}</button></div>
      </section>}
      {timelineDraft && <section className="rounded-2xl border border-[#cfc8f7] bg-[#faf9ff] p-4 shadow-panel" data-timeline-draft-preview="true">
        <div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[.1em] text-[#7768ed]">Предпросмотр</p><h2 className="mt-0.5 text-sm font-bold text-[#363247]">Предпросмотр изменений</h2></div><span className="rounded-full bg-[#eeeaff] px-2 py-1 text-[9px] font-bold text-[#6254c8]">Черновик · {timelineDraft.userTaskChanges.length} {pluralizeRu(timelineDraft.userTaskChanges.length, ['изменение', 'изменения', 'изменений'])}</span></div>
        <p className="mt-3 text-[9px] font-bold uppercase tracking-[.08em] text-[#7468bd]">Ваше изменение</p>
        <div className="mt-2 max-h-40 space-y-2 overflow-y-auto">{timelineDraft.userTaskChanges.map((change) => <div key={change.taskId} data-draft-task-id={change.taskId} className="rounded-xl border border-[#e6e1fa] bg-white p-2.5"><p className="truncate text-[10px] font-bold text-[#474252]">{workspace.tasks.find((task) => task.id === change.taskId)?.title ?? change.taskId}</p><p className="mt-1 text-[10px] text-[#777181]">{formatShortDate(change.currentStartDate)}–{formatShortDate(change.currentEndDate)} <ArrowRight size={10} className="mx-1 inline" /> {formatShortDate(change.proposedStartDate)}–{formatShortDate(change.proposedEndDate)}</p></div>)}</div>
        {timelineDraft.draftConflicts.filter((conflict) => !timelineDraft.completedManualTaskIds.includes(conflict.successorTaskId)).map((conflict) => {
          const predecessor = workspace.tasks.find((task) => task.id === conflict.predecessorTaskId)
          const successor = workspace.tasks.find((task) => task.id === conflict.successorTaskId)
          return <div key={conflict.key} className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[10px] leading-4 text-amber-800" data-draft-conflict={conflict.key}><p className="font-semibold">{successor?.title ?? conflict.successorTaskId} начинается раньше допустимой даты после «{predecessor?.title ?? conflict.predecessorTaskId}».</p><p>Можно начать не раньше: {formatFullDate(conflict.earliestStartDate)}</p></div>
        })}
        {timelineDraft.completedManualTaskIds.length > 0 && <p className="mt-2 text-[10px] font-semibold text-rose-700">Завершённые задачи требуют ручного решения: {timelineDraft.completedManualTaskIds.map((id) => workspace.tasks.find((task) => task.id === id)?.title ?? id).join(', ')}.</p>}
        {hasRecommendedDraftCorrection && <div className="mt-3 border-t border-[#ded9f3] pt-3" data-recommended-draft="true"><p className="text-[9px] font-bold uppercase tracking-[.08em] text-[#7468bd]">Рекомендуемое исправление</p><div className="mt-2 max-h-44 space-y-2 overflow-y-auto">{timelineDraft.recommendedTaskChanges.map((change) => <div key={change.taskId} data-recommended-task-id={change.taskId} className="rounded-xl bg-white p-2.5"><p className="truncate text-[10px] font-bold text-[#474252]">{workspace.tasks.find((task) => task.id === change.taskId)?.title ?? change.taskId}</p><p className="mt-1 text-[10px] text-[#777181]">{formatShortDate(change.currentStartDate)}–{formatShortDate(change.currentEndDate)} <ArrowRight size={10} className="mx-1 inline" /> {formatShortDate(change.proposedStartDate)}–{formatShortDate(change.proposedEndDate)}</p></div>)}</div><div className="mt-2 rounded-xl bg-[#29263e] p-3 text-white"><p className="text-[9px] text-[#bbb6ca]">Новый прогноз завершения проекта</p><p className="mt-1 text-xs font-bold">{formatShortDate(timelineDraft.currentProjectEndDate)} <ArrowRight size={11} className="mx-1 inline" /> {formatShortDate(timelineDraft.recommendedProjectEndDate)} <span className="ml-1 text-[#f2a27f]">{timelineDraft.recommendedProjectEndDeltaDays > 0 ? '+' : ''}{timelineDraft.recommendedProjectEndDeltaDays} дн.</span></p></div></div>}
        {draftMessage && <p className="mt-2 text-[10px] text-rose-700" role="alert">{draftMessage}</p>}
        <div className={`mt-3 grid gap-2 ${hasRecommendedDraftCorrection ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2'}`}><button type="button" disabled={isApplyingDraft} onClick={onCancelTimelineDraft} className="rounded-xl border border-[#dcd7ee] bg-white px-3 py-2 text-xs font-semibold text-[#625d6c] disabled:opacity-50">Отменить</button><button type="button" disabled={isApplyingDraft} onClick={() => { void applyTimelineDraft('as-is') }} className="rounded-xl bg-[#29263e] px-3 py-2 text-xs font-bold text-white disabled:opacity-60">{applyingDraftMode === 'as-is' ? 'Применение…' : 'Применить как есть'}</button>{hasRecommendedDraftCorrection && <button type="button" disabled={isApplyingDraft} onClick={() => { void applyTimelineDraft('with-dependency-fix') }} className="rounded-xl bg-[#6d5dfb] px-3 py-2 text-xs font-bold text-white disabled:opacity-60 sm:col-span-2">{applyingDraftMode === 'with-dependency-fix' ? 'Применение…' : 'Применить с исправлением зависимостей'}</button>}</div>
      </section>}
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

      <section className="rounded-2xl border border-[#e1ddec] bg-white p-4 shadow-panel" data-team-workload-summary="true">
        <div className="flex items-start justify-between gap-3"><div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#f0edff] text-[#6556d9]"><Users size={18} /></span><div><h2 className="text-sm font-bold text-[#363247]">Загрузка команды</h2><p className="mt-0.5 text-[10px] leading-4 text-[#8c8798]" title="Оценка основана только на расписании задач и не учитывает компетенции и фактическую трудоёмкость.">Плановая оценка по пересечениям и плотности задач.</p></div></div>{onViewWorkload && <button type="button" onClick={onViewWorkload} className="shrink-0 rounded-md border border-[#e2deeb] px-2 py-1 text-[9px] font-bold text-[#6556d9]">Посмотреть загрузку</button>}</div>
        {visibleTeamWorkload.length > 0 ? <div className="mt-3 divide-y divide-[#efedf2]">{visibleTeamWorkload.map((workload) => { const warning = workload.level === 'high' || workload.level === 'elevated'; return <div key={workload.employeeId} className="flex items-center gap-2 py-2 first:pt-0 last:pb-0" data-team-workload-employee={workload.employeeId}><span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-[#514c5e]">{workload.employeeName}</span><span className={`shrink-0 text-[10px] ${warning ? 'font-bold text-amber-700' : 'text-[#8c8798]'}`}>{workload.peakConcurrency > 0 ? `${WORKLOAD_LEVEL_LABELS[workload.level]} · пик ${workload.peakConcurrency}` : 'Нет активных задач'}</span>{warning && <TriangleAlert size={13} className="shrink-0 text-amber-600" aria-label="Повышенная плановая нагрузка" />}</div> })}</div> : <p className="mt-3 rounded-xl bg-[#f7f6f9] px-3 py-2.5 text-[10px] text-[#8c8798]">В проекте пока нет сотрудников.</p>}
        <p className="mt-2 text-[9px] leading-4 text-[#9a95a4]">Оценка основана только на расписании задач и не учитывает компетенции и фактическую трудоёмкость.</p>
        {teamWorkload.length > 4 && <button type="button" onClick={() => setShowAllWorkload((current) => !current)} className="mt-3 w-full rounded-lg bg-[#f7f6fb] px-3 py-2 text-[10px] font-bold text-[#655f70]">{showAllWorkload ? 'Скрыть' : `Показать всех (${teamWorkload.length})`}</button>}
      </section>

      <section className="rounded-2xl border border-[#e1ddec] bg-white p-4 shadow-panel">
        <div className="flex items-start justify-between gap-3"><div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#f0edff] text-[#6556d9]"><Lightbulb size={18} /></span><div><div className="flex items-center gap-2"><h2 className="text-sm font-bold text-[#363247]">Что требует внимания</h2>{timelineDraft && <span className="rounded-full bg-[#eeeaff] px-1.5 py-0.5 text-[8px] font-bold uppercase text-[#6556d9]">Предпросмотр</span>}</div><p className="mt-0.5 text-[10px] leading-4 text-[#8c8798]">До трёх наиболее значимых действий по текущему плану.</p></div></div><span className="rounded-full bg-[#f0edff] px-2 py-1 text-[10px] font-bold text-[#6556d9]" aria-label={`Требует внимания: ${attentionCount}`}>{attentionCount}</span></div>
        <div className="mt-3 space-y-2">
          {recoveryPlan.interventionRequired && <div data-recovery-entry="true" className="rounded-xl border border-rose-200 bg-gradient-to-br from-rose-50 to-white p-3.5 text-rose-950">
            <div className="flex items-start gap-2.5"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-rose-100 text-rose-600"><ShieldAlert size={16} /></span><div><p className="text-xs font-bold">Проект требует вмешательства</p><p className="mt-1 text-[10px] leading-4 text-rose-800">План: {formatMonthDay(recoveryPlan.plannedEndDate)}<br />Текущий прогноз: {formatMonthDay(recoveryPlan.projectedEndDate)}<br />Отклонение: {recoveryPlan.delayDays > 0 ? `+${recoveryPlan.delayDays} дн.` : 'срок не изменился'}</p></div></div>
            <p className="mt-2 text-[10px] leading-4 text-rose-800">Затронуто задач: {recoveryPlan.affectedTaskIds.length}. Ripple подготовил {recoveryPlan.options.length} {pluralizeRu(recoveryPlan.options.length, ['вариант', 'варианта', 'вариантов'])} восстановления плана.</p>
            <button type="button" onClick={() => setRecoveryPlanOpen(true)} className="mt-3 w-full rounded-lg bg-rose-600 px-3 py-2 text-[10px] font-bold text-white transition hover:bg-rose-700">Открыть план восстановления</button>
          </div>}
          {recommendations.map((recommendation) => {
          const action = recommendation.action
          const affectedTitles = recommendation.affectedTaskIds
            .map((taskId) => tasks.find((task) => task.id === taskId)?.title)
            .filter((title): title is string => Boolean(title))
          const toneClasses = recommendation.tone === 'danger'
            ? 'border-rose-200 bg-rose-50 text-rose-900'
            : recommendation.tone === 'warning'
              ? 'border-amber-200 bg-amber-50 text-amber-900'
              : 'border-emerald-200 bg-emerald-50 text-emerald-900'
          const markerClasses = recommendation.tone === 'danger'
            ? 'bg-rose-500'
            : recommendation.tone === 'warning'
              ? 'bg-amber-400'
              : 'bg-emerald-500'
          return <div key={recommendation.id} data-recommendation-tone={recommendation.tone} className={`rounded-xl border p-3 ${toneClasses}`}>
            <div className="flex items-start gap-2"><span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${markerClasses}`} /><div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-[.08em] opacity-65">Проблема</p><p className="mt-0.5 text-[11px] font-bold">{recommendation.problem}</p><p className="mt-1 text-[10px] leading-4 opacity-85">{recommendation.evidence}</p></div></div>
            {affectedTitles.length > 0 && <p className="mt-2 text-[9px] leading-4 opacity-75">Затронутые задачи: {affectedTitles.join(', ')}</p>}
            <div className="mt-2 rounded-lg bg-white/55 px-2.5 py-2"><p className="text-[9px] font-bold uppercase tracking-[.08em] opacity-65">Рекомендуемое решение</p><p className="mt-1 text-[10px] font-semibold leading-4">{recommendation.proposedAction}</p></div>
            <div className="mt-2"><p className="text-[9px] font-bold uppercase tracking-[.08em] opacity-65">Ожидаемый результат</p><p className="mt-1 text-[10px] leading-4 opacity-85">{recommendation.expectedEffect}</p></div>
            {recommendation.alternatives && recommendation.alternatives.length > 0 && <div className="mt-2"><p className="text-[9px] font-bold uppercase tracking-[.08em] opacity-65">Варианты</p><ol className="mt-1 space-y-1 text-[10px] leading-4 opacity-85">{recommendation.alternatives.map((alternative, index) => <li key={alternative}>{index + 1}. {alternative}</li>)}</ol></div>}
            {action && <button type="button" onClick={() => handleRecommendationAction(action)} className="mt-2 rounded-md bg-white px-2 py-1 text-[9px] font-bold text-[#5f51c8] shadow-sm">{action.label}</button>}
          </div>
        })}</div>
        {currentIssueCount > 0 && <button type="button" onClick={() => setShowAllIssues((current) => !current)} className="mt-3 w-full rounded-xl border border-[#e4e0eb] px-3 py-2 text-[10px] font-bold text-[#655f70]">{showAllIssues ? 'Скрыть подробности' : `Показать все проблемы (${currentIssueCount})`}</button>}
        {showAllIssues && <div className="mt-3 space-y-4" data-all-project-issues="true">
          {currentIssueGroups.filter((group) => group.items.length > 0).map((group) => <div key={group.id}>
            <p className="mb-2 text-[9px] font-bold uppercase tracking-[.08em] text-[#8c8798]">{group.title} · {group.items.length}</p>
            <div className="space-y-2">{group.items.map((reason, index) => {
              const source = tasks.find((task) => task.id === reason.sourceTaskId)
              const scheduleConflict = group.id === 'schedule'
                ? describeScheduleConflict(reason, tasks, workspace.dependencies)
                : null
              const tone = reason.severity === 'error'
                ? 'border-rose-200 bg-rose-50 text-rose-800'
                : reason.severity === 'warning'
                  ? 'border-amber-200 bg-amber-50 text-amber-900'
                  : 'border-sky-200 bg-sky-50 text-sky-900'
              return <div key={`${group.id}-${reason.sourceTaskId}-${index}`} className={`rounded-xl border p-3 ${tone}`}>
                {scheduleConflict
                  ? <p className="text-[9px] font-bold uppercase tracking-[.08em]">Задача: {scheduleConflict.successor.title}</p>
                  : source && <p className="text-[9px] font-bold uppercase tracking-[.08em]">Задача: {source.title}</p>}
                <p className="mt-1 text-[11px] font-semibold leading-4">{reason.reason}</p>
                {scheduleConflict && (scheduleConflict.completedSuccessor
                  ? <div className="mt-1.5 space-y-0.5 text-[10px] leading-4 opacity-85"><p>Задача: {scheduleConflict.successor.title}</p><p>Предшественник: {scheduleConflict.predecessor.title}</p></div>
                  : <div className="mt-1.5 space-y-0.5 text-[10px] leading-4 opacity-85"><p>Запланированное начало: {formatFullDate(scheduleConflict.successor.startDate)}</p><p>Предшественник «{scheduleConflict.predecessor.title}» завершается: {formatFullDate(scheduleConflict.predecessor.endDate)}</p><p>Можно начать не раньше: {formatFullDate(scheduleConflict.earliestStartDate)}</p></div>)}
                <p className="mt-1 text-[10px] leading-4 opacity-80">{reason.consequence}</p>
                {reason.action && <button type="button" onClick={() => reason.action?.type === 'open-task' ? onTaskSelect(reason.action.taskId) : calculatePreview(reason.sourceTaskId)} className="mt-2 rounded-md bg-white/70 px-2 py-1 text-[9px] font-bold shadow-sm">{reason.action.type === 'open-task' ? 'Открыть задачу' : 'Рассчитать сдвиг'}</button>}
              </div>
            })}</div>
          </div>)}
        </div>}
      </section>

      <section className="rounded-2xl border border-[#e1ddec] bg-white p-4 shadow-panel">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#f0edff] text-[#6556d9]"><Calculator size={18} /></span>
          <div><h2 className="text-sm font-bold text-[#363247]">Автоматический сдвиг</h2><p className="mt-0.5 text-[10px] leading-4 text-[#8c8798]">Даты изменятся только после подтверждения предложенного плана.</p></div>
        </div>
        {!preview && previewSourceIds.length === 0 && <p className="mt-3 rounded-xl bg-[#f5f3fa] px-3 py-2.5 text-[11px] leading-4 text-[#716b7b]">Нет текущих конфликтов, для которых требуется расчёт сдвига.</p>}
        {!preview && previewSourceIds.length > 1 && <label className="mt-3 block text-[11px] font-semibold text-[#625d6d]">Источник конфликта<select value={commonPreviewSourceId} onChange={(event) => setSelectedPreviewSourceId(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#dedce6] bg-white px-3 py-2.5 text-xs text-[#363244] outline-none focus:border-[#7667ed]"><option value="">Выберите задачу</option>{previewSourceIds.map((taskId) => <option key={taskId} value={taskId}>{tasks.find((task) => task.id === taskId)?.title ?? taskId}</option>)}</select></label>}
        {!preview && previewSourceIds.length > 0 && <button type="button" onClick={() => commonPreviewSourceId && calculatePreview(commonPreviewSourceId)} disabled={isCalculating || !commonPreviewSourceId} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#29263e] px-3 py-2.5 text-xs font-bold text-white transition hover:bg-[#37334f] disabled:opacity-60">{isCalculating ? 'Расчёт…' : 'Рассчитать автоматический сдвиг'}</button>}
        {preview && <div className="mt-3 rounded-xl border border-[#e7e2fb] bg-[#faf9ff] p-3">
          <p className="text-[10px] font-bold uppercase tracking-[.08em] text-[#7468bd]">Предпросмотр</p>
          <div className="mt-2 max-h-48 space-y-2 overflow-y-auto">
            {preview.taskShifts.map((shift) => {
              const task = tasks.find((candidate) => candidate.id === shift.taskId)
              return <div key={shift.taskId} className={`rounded-lg border p-2.5 text-[10px] text-[#777181] ${shift.completedRequiresManualResolution ? 'border-amber-300 bg-amber-50' : 'border-transparent bg-white'}`}>
                <div className="flex items-center justify-between gap-2"><span className="truncate font-bold text-[#474252]">{task?.title ?? shift.taskId}</span><span className="shrink-0 font-bold text-[#c45b37]">{shift.shiftDays > 0 ? '+' : ''}{shift.shiftDays} дн.</span></div>
                <p className="mt-1">{formatShortDate(shift.currentStartDate)}–{formatShortDate(shift.currentEndDate)} <ArrowRight size={10} className="mx-1 inline" /> {formatShortDate(shift.proposedStartDate)}–{formatShortDate(shift.proposedEndDate)}</p>
                {shift.completedRequiresManualResolution && <p className="mt-1.5 font-semibold text-amber-800">Законченная задача требует ручного решения. {shift.reason}</p>}
              </div>
            })}
          </div>
          <div className="mt-3 border-t border-[#e7e2fb] pt-2 text-[10px] text-[#777181]">Завершение проекта: <strong className="text-[#474252]">{formatShortDate(preview.currentProjectEndDate)} <ArrowRight size={10} className="mx-1 inline" /> {formatShortDate(preview.proposedProjectEndDate)}</strong> ({preview.projectEndShiftDays > 0 ? '+' : ''}{preview.projectEndShiftDays} дн.)</div>
          {preview.projectEndShiftDays > 0 && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] leading-4 text-amber-800">Предлагаемый сдвиг выходит за текущий срок проекта. Изменить плановый срок можно только отдельным явным подтверждением.</p>}
          {!hasApplicablePreviewShifts && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] leading-4 text-amber-800">Автоматически сдвинуть задачи нельзя. Завершённые работы требуют ручной проверки фактических дат.</p>}
          {hasApplicablePreviewShifts && <div data-shift-actions={preview.projectEndShiftDays > 0 ? 'with-deadline-change' : 'standard'} className={`mt-3 grid gap-2 ${preview.projectEndShiftDays > 0 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2'}`}><button type="button" disabled={isApplying} onClick={() => setPreview(null)} className="rounded-xl border border-[#dedbe4] px-3 py-2 text-xs font-semibold text-[#625d6c] disabled:opacity-50">Отмена</button><button type="button" disabled={isApplying} onClick={confirmShiftWithoutDeadlineChange} className="rounded-xl bg-[#6d5dfb] px-3 py-2 text-xs font-bold text-white disabled:opacity-60">{isApplying ? 'Применение…' : preview.projectEndShiftDays > 0 ? 'Сдвинуть без изменения срока' : 'Подтвердить'}</button>{preview.projectEndShiftDays > 0 && <button data-deadline-shift-action="true" type="button" disabled={isApplying} onClick={confirmShiftWithDeadlineChange} className="w-full rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs font-bold text-amber-800 disabled:opacity-60 sm:col-span-2">Сдвинуть и изменить срок проекта</button>}</div>}
        </div>}
        {previewMessage && <p className="mt-3 rounded-lg bg-[#f5f3fa] px-3 py-2 text-[10px] leading-4 text-[#716b7b]" role="status">{previewMessage}</p>}
      </section>

    </aside>
  )
}
