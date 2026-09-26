import { ArrowRight, CalendarDays, CheckCircle2, CircleAlert, Route } from 'lucide-react'
import type { ProjectWorkspace } from '../../types/workspace'
import { calendarDaysBetween, formatShortDate } from '../../utils/date'
import { formatTaskCount } from '../../utils/plural'

export function MetricCards({ workspace }: { workspace: ProjectWorkspace }) {
  const { project, impact } = workspace
  if (workspace.tasks.length === 0) {
    return <section className="rounded-2xl border border-[#e5e3eb] bg-white px-6 py-10 text-center shadow-panel"><p className="text-sm font-semibold text-[#4b4658]">Метрики появятся после добавления задач</p><p className="mt-1 text-[11px] text-[#918d9b]">Пока у проекта нет прогресса, критических задач или рисков.</p></section>
  }
  const plannedDays = calendarDaysBetween(project.startDate, project.targetEndDate) + 1
  const cards = [
    { icon: CheckCircle2, label: 'Общий прогресс', value: `${project.progress}%`, detail: `${project.completedTaskCount} из ${formatTaskCount(project.taskCount)} завершено`, accent: 'text-emerald-600', bar: true },
    { icon: CalendarDays, label: 'Плановый срок', value: formatShortDate(project.targetEndDate), detail: `${plannedDays} календарных дней по плану`, accent: 'text-[#6d5dfb]' },
    { icon: CircleAlert, label: 'Прогноз завершения', value: formatShortDate(impact.projectedProjectEndDate), detail: impact.deadlineShiftDays > 0 ? `На ${impact.deadlineShiftDays} дн. позже плана` : impact.deadlineShiftDays < 0 ? `На ${Math.abs(impact.deadlineShiftDays)} дн. раньше плана` : 'В пределах плана', accent: 'text-[#d9653f]', danger: impact.requiresIntervention },
    { icon: Route, label: 'Критический путь', value: formatTaskCount(impact.criticalTaskIds.length), detail: 'Критические задачи проекта', accent: 'text-[#4e46b5]' },
  ]
  return (
    <div className="space-y-2">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ icon: Icon, label, value, detail, accent, danger, bar }) => (
          <section key={label} className={`rounded-2xl border bg-white p-4 shadow-panel ${danger ? 'border-[#f2c8b9]' : 'border-[#e7e5ec]'}`}>
          <div className="mb-3 flex items-center justify-between">
            <span className={`grid h-8 w-8 place-items-center rounded-lg bg-[#f4f3f8] ${accent}`}><Icon size={17} strokeWidth={2} /></span>
            {danger && <span className="rounded-full bg-[#fff0e8] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#bf5934]">Требует внимания</span>}
          </div>
          <p className="text-xs font-medium text-[#858190]">{label}</p>
          <div className="mt-1 flex items-end justify-between gap-2">
            <p className="text-[22px] font-bold tracking-[-.035em] text-[#29263b]">{value}</p>
            {label === 'Прогноз завершения' && <ArrowRight size={15} className="mb-1 text-[#d9653f]" />}
          </div>
          <p className={`mt-1 text-[11px] ${danger ? 'font-medium text-[#c55b37]' : 'text-[#9692a0]'}`}>{detail}</p>
          {bar && <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#ecebf1]"><div className="h-full rounded-full bg-[#42a782]" style={{ width: `${project.progress}%` }} /></div>}
          </section>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 text-[11px]">
        <span className="rounded-full border border-[#e4e1ea] bg-white px-3 py-1.5 text-[#716c7b]">Затронуто последним изменением: <strong className="text-[#403a50]">{impact.affectedTaskIds.length}</strong></span>
        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-800">Текущие конфликты расписания: <strong>{workspace.currentIssues.scheduleConflicts.length}</strong></span>
      </div>
    </div>
  )
}
