import { ArrowRight, CalendarDays, CheckCircle2, CircleAlert, Route } from 'lucide-react'
import type { ProjectWorkspace } from '../../types/workspace'

export function MetricCards({ workspace }: { workspace: ProjectWorkspace }) {
  const { project, impact } = workspace
  const cards = [
    { icon: CheckCircle2, label: 'Overall progress', value: `${project.progress}%`, detail: `${project.completedTaskCount} of ${project.taskCount} tasks complete`, accent: 'text-emerald-600', bar: true },
    { icon: CalendarDays, label: 'Target date', value: 'Nov 6', detail: '32 working days planned', accent: 'text-[#6d5dfb]' },
    { icon: CircleAlert, label: 'Projected finish', value: 'Nov 11', detail: `+${impact.deadlineShiftDays} days from target`, accent: 'text-[#d9653f]', danger: true },
    { icon: Route, label: 'Critical path', value: `${impact.criticalTaskIds.length} tasks`, detail: '4 downstream impacted', accent: 'text-[#4e46b5]' },
  ]
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ icon: Icon, label, value, detail, accent, danger, bar }) => (
        <section key={label} className={`rounded-2xl border bg-white p-4 shadow-panel ${danger ? 'border-[#f2c8b9]' : 'border-[#e7e5ec]'}`}>
          <div className="mb-3 flex items-center justify-between">
            <span className={`grid h-8 w-8 place-items-center rounded-lg bg-[#f4f3f8] ${accent}`}><Icon size={17} strokeWidth={2} /></span>
            {danger && <span className="rounded-full bg-[#fff0e8] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#bf5934]">Needs attention</span>}
          </div>
          <p className="text-xs font-medium text-[#858190]">{label}</p>
          <div className="mt-1 flex items-end justify-between gap-2">
            <p className="text-[22px] font-bold tracking-[-.035em] text-[#29263b]">{value}</p>
            {label === 'Projected finish' && <ArrowRight size={15} className="mb-1 text-[#d9653f]" />}
          </div>
          <p className={`mt-1 text-[11px] ${danger ? 'font-medium text-[#c55b37]' : 'text-[#9692a0]'}`}>{detail}</p>
          {bar && <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#ecebf1]"><div className="h-full rounded-full bg-[#42a782]" style={{ width: `${project.progress}%` }} /></div>}
        </section>
      ))}
    </div>
  )
}
