import { CalendarDays, CheckCircle2, CircleAlert, Info, Route } from 'lucide-react'
import type { ProjectWorkspace } from '../../types/workspace'
import { calendarDaysBetween, formatShortDate } from '../../utils/date'
import { formatTaskCount } from '../../utils/plural'
import { getCurrentIssueCount } from '../../services/currentProjectAnalysis'
import { TooltipTrigger } from '../common/TooltipTrigger'

export function MetricCards({ workspace }: { workspace: ProjectWorkspace }) {
  const { project, impact } = workspace
  if (workspace.tasks.length === 0) {
    return <section className="rounded-2xl border border-[#e5e3eb] bg-white px-6 py-10 text-center shadow-panel"><p className="text-sm font-semibold text-[#4b4658]">Метрики появятся после добавления задач</p><p className="mt-1 text-[11px] text-[#918d9b]">Пока у проекта нет задач, критических сроков или рисков.</p></section>
  }
  const plannedDays = calendarDaysBetween(project.startDate, project.targetEndDate) + 1
  const currentIssueCount = getCurrentIssueCount(workspace.currentIssues)
  const cards = [
    { icon: CheckCircle2, label: 'Общий прогресс', value: `${project.progress}%`, detail: `${project.completedTaskCount} из ${formatTaskCount(project.taskCount)} завершено`, accent: 'text-emerald-600', progress: project.progress },
    { icon: CalendarDays, label: 'Плановый срок', value: formatShortDate(project.targetEndDate), detail: `${plannedDays} календарных дней по плану`, accent: 'text-[#6d5dfb]' },
    { icon: CircleAlert, label: 'Прогноз завершения', value: formatShortDate(impact.projectedProjectEndDate), detail: impact.deadlineShiftDays > 0 ? `На ${impact.deadlineShiftDays} дн. позже плана` : impact.deadlineShiftDays < 0 ? `На ${Math.abs(impact.deadlineShiftDays)} дн. раньше плана` : 'В пределах плана', accent: 'text-[#d9653f]', danger: impact.requiresIntervention },
    { icon: Route, label: 'Критические задачи', value: formatTaskCount(impact.criticalTaskIds.length), detail: 'Задачи без временного запаса — их задержка может сдвинуть срок проекта.', accent: 'text-[#4e46b5]', criticalInfo: true },
  ]
  return (
    <div className="space-y-2">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ icon: Icon, label, value, detail, accent, danger, progress, criticalInfo }) => (
          <section key={label} className={`rounded-2xl border bg-white p-4 shadow-panel ${danger ? 'border-[#f2c8b9]' : 'border-[#e7e5ec]'}`}>
          <div className="mb-3 flex items-center justify-between">
            <span className={`grid h-8 w-8 place-items-center rounded-lg bg-[#f4f3f8] ${accent}`}><Icon size={17} strokeWidth={2} /></span>
            {danger && <span className="rounded-full bg-[#fff0e8] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#bf5934]">Требует внимания</span>}
          </div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-[#858190]">
            <span>{label}</span>
            {criticalInfo && <TooltipTrigger
              ariaLabel="Что означает критическая задача"
              trigger={<span className="grid h-4 w-4 place-items-center text-[#777181]"><Info size={13} /></span>}
            >
              <span className="block text-xs font-bold">Что означает критическая задача</span>
              <span className="mt-1.5 block text-[#dedbe8]">Критическая задача — задача без временного запаса. Если она задержится, это может повлиять на дату завершения проекта.</span>
              <span className="mt-1.5 block text-[#dedbe8]">В проекте может быть несколько критических ветвей одновременно.</span>
            </TooltipTrigger>}
          </div>
          <div className="mt-1 flex items-end justify-between gap-2">
            <p className="text-[22px] font-bold tracking-[-.035em] text-[#29263b]">{value}</p>
          </div>
          <p className={`mt-1 text-[11px] ${danger ? 'font-medium text-[#c55b37]' : 'text-[#9692a0]'}`}>{detail}</p>
          {progress !== undefined && <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#ecebf1]" aria-label={`Прогресс проекта: ${progress}%`}><div className="h-full rounded-full bg-[#42a782]" style={{ width: `${progress}%` }} /></div>}
          </section>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 text-[11px]">
        <span className="rounded-full border border-[#e4e1ea] bg-white px-3 py-1.5 text-[#716c7b]">Затронуто последним изменением: <strong className="text-[#403a50]">{impact.affectedTaskIds.length}</strong></span>
        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-800">Текущие проблемы: <strong>{currentIssueCount}</strong></span>
      </div>
    </div>
  )
}
