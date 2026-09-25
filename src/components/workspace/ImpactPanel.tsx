import { ArrowRight, GitBranch, Lightbulb, MoveRight, Sparkles, TriangleAlert } from 'lucide-react'
import type { ProjectTask } from '../../types/task'
import type { ProjectWorkspace } from '../../types/workspace'
import { formatAnalysisTime, formatShortDate } from '../../utils/date'

export function ImpactPanel({ workspace }: { workspace: ProjectWorkspace }) {
  const { impact, tasks, recoveryScenarios } = workspace
  const source = tasks.find((task) => task.id === impact.sourceTaskId)
  const affected = impact.affectedTaskIds
    .map((id) => tasks.find((task) => task.id === id))
    .filter((task): task is ProjectTask => Boolean(task))
  const sourceReason = impact.reasons.find((reason) => reason.taskId === impact.sourceTaskId)?.reason
  const best = recoveryScenarios[0]
  return (
    <aside className="space-y-3">
      <section className="overflow-hidden rounded-2xl border border-[#efc5b5] bg-white shadow-panel">
        <div className="border-b border-[#f1d8ce] bg-gradient-to-r from-[#fff4ee] to-[#fffaf7] px-4 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#f9dfd2] text-[#c45a34]"><TriangleAlert size={17} /></span><div><h2 className="text-sm font-bold text-[#412e2a]">Последствия изменения</h2><p className="text-[10px] text-[#a17769]">Расчёт: {formatAnalysisTime(impact.analyzedAt)}</p></div></div>
            <span className="rounded-full bg-white px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-[#bb5834] shadow-sm">{impact.requiresIntervention ? 'Требуется вмешательство' : 'Вмешательство не требуется'}</span>
          </div>
        </div>
        <div className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[.08em] text-[#aaa5b1]">Исходное изменение</p>
          <div className="mt-2 rounded-xl border border-[#eeeaf0] bg-[#faf9fb] p-3">
            <div className="flex items-start gap-2.5">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#e37149]" />
              <div><p className="text-xs font-bold text-[#3b3748]">{source?.title ?? 'Изменённая задача'}</p><p className="mt-1 text-[11px] leading-4 text-[#827d8d]">{source && <>Завершение сдвинулось: <strong className="font-bold text-[#c45b37]">{formatShortDate(source.plannedEndDate)} → {formatShortDate(source.endDate)}</strong>. </>}{sourceReason}</p></div>
            </div>
          </div>
          <div className="my-3 flex items-center gap-2 text-[10px] font-semibold text-[#a29daa]"><GitBranch size={13} /><span>Задач под влиянием: {affected.length}</span><span className="h-px flex-1 bg-[#ebe8ee]" /></div>
          <div className="space-y-2">
            {affected.map((task, index) => (
              <div key={task.id} className="flex items-center gap-2.5">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-[#fff0e8] text-[9px] font-bold text-[#c45b37]">{index + 1}</span>
                <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-semibold text-[#514c5e]">{task.title}</p><p className="text-[10px] text-[#9995a2]">{task.changeNote ?? 'Срок сдвинут из-за зависимости'}</p></div>
                <MoveRight size={13} className="text-[#c6c2cc]" />
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between rounded-xl bg-[#29263e] p-3 text-white">
            <div><p className="text-[10px] text-[#b7b3c5]">Завершение проекта</p><p className="mt-0.5 text-sm font-bold">{formatShortDate(impact.previousProjectEndDate)} <ArrowRight size={12} className="mx-1 inline" /> {formatShortDate(impact.projectedProjectEndDate)}</p></div>
            <div className="rounded-lg bg-[#e36f49] px-2 py-1.5 text-xs font-bold">{impact.deadlineShiftDays > 0 ? `+${impact.deadlineShiftDays} дн.` : impact.deadlineShiftDays < 0 ? `${impact.deadlineShiftDays} дн.` : 'По плану'}</div>
          </div>
        </div>
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
