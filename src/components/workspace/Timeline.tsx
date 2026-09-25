import { ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react'
import type { Assignee, ProjectTask } from '../../types/task'

const rangeStart = Date.parse('2026-09-28')
const rangeEnd = Date.parse('2026-11-13')
const range = rangeEnd - rangeStart
const weekLabels = ['Sep 28', 'Oct 5', 'Oct 12', 'Oct 19', 'Oct 26', 'Nov 2', 'Nov 9']

function barPosition(task: ProjectTask) {
  const start = Math.max(0, ((Date.parse(task.startDate) - rangeStart) / range) * 100)
  const width = Math.max(2.5, ((Date.parse(task.endDate) - Date.parse(task.startDate) + 86_400_000) / range) * 100)
  return { left: `${start}%`, width: `${Math.min(width, 100 - start)}%` }
}

export function Timeline({ tasks, assignees }: { tasks: ProjectTask[]; assignees: Assignee[] }) {
  const visibleTasks = tasks.slice(0, 8)
  return (
    <section className="overflow-hidden rounded-2xl border border-[#e5e3eb] bg-white shadow-panel">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ebe9ef] px-5 py-4">
        <div>
          <h2 className="text-sm font-bold text-[#302d40]">Project timeline</h2>
          <p className="mt-0.5 text-[11px] text-[#918d9b]">Critical path and dependency shift</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="rounded-lg border border-[#e1dfe6] p-2 text-[#777382] hover:bg-[#f6f5f8]" aria-label="Timeline filters"><SlidersHorizontal size={14} /></button>
          <div className="flex rounded-lg border border-[#e1dfe6]">
            <button className="border-r border-[#e1dfe6] p-2 text-[#777382]" aria-label="Previous period"><ChevronLeft size={14} /></button>
            <button className="p-2 text-[#777382]" aria-label="Next period"><ChevronRight size={14} /></button>
          </div>
          <button className="rounded-lg border border-[#e1dfe6] px-2.5 py-2 text-[11px] font-semibold text-[#625e6f]">Today</button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[210px_1fr] border-b border-[#eeecf1] bg-[#faf9fb]">
            <div className="border-r border-[#eeecf1] px-5 py-2.5 text-[10px] font-bold uppercase tracking-[.1em] text-[#9a96a3]">Task</div>
            <div className="grid grid-cols-7">
              {weekLabels.map((week) => <div key={week} className="border-r border-[#eeecf1] px-2 py-2.5 text-center text-[10px] font-semibold text-[#8f8b99] last:border-r-0">{week}</div>)}
            </div>
          </div>
          {visibleTasks.map((task) => {
            const assignee = assignees.find((person) => person.id === task.assigneeId)
            const impacted = task.riskState === 'at-risk'
            return (
              <div key={task.id} className={`grid grid-cols-[210px_1fr] border-b border-[#f0eef3] last:border-b-0 ${impacted ? 'bg-[#fffdfb]' : ''}`}>
                <div className="flex min-w-0 items-center gap-2.5 border-r border-[#eeecf1] px-5 py-2.5">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${task.isCritical ? 'bg-[#e17149]' : task.status === 'completed' ? 'bg-[#4aaa83]' : 'bg-[#aaa5b6]'}`} />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-[#444051]">{task.title}</p>
                    <p className="mt-0.5 truncate text-[10px] text-[#9a96a3]">{assignee?.name}</p>
                  </div>
                </div>
                <div className="relative min-h-[48px] bg-[linear-gradient(to_right,#eeecf1_1px,transparent_1px)] bg-[size:14.285%_100%]">
                  <div className={`absolute top-1/2 h-6 -translate-y-1/2 overflow-hidden rounded-md ${impacted ? 'impact-pulse bg-[#e7774d]' : task.status === 'completed' ? 'bg-[#55ad89]' : 'bg-[#7768ed]'}`} style={barPosition(task)}>
                    <div className="h-full bg-white/20" style={{ width: `${task.progress}%` }} />
                  </div>
                  {task.id === 'api' && <span className="absolute right-[2%] top-1/2 -translate-y-1/2 rounded bg-[#fff0e8] px-1.5 py-0.5 text-[9px] font-bold text-[#b9542f]">+3d</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <div className="flex items-center gap-5 border-t border-[#ebe9ef] bg-[#faf9fb] px-5 py-2.5 text-[10px] text-[#85818f]">
        <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#e7774d]" /> Impacted</span>
        <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#7768ed]" /> In progress</span>
        <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#55ad89]" /> Complete</span>
      </div>
    </section>
  )
}
