import { ArrowUpRight, MoreHorizontal, Plus } from 'lucide-react'
import type { Assignee, ProjectTask } from '../../types/task'
import { Avatar } from '../common/Avatar'
import { StatusBadge } from '../common/StatusBadge'

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(`${value}T00:00:00`))
}

export function TaskList({ tasks, assignees }: { tasks: ProjectTask[]; assignees: Assignee[] }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#e5e3eb] bg-white shadow-panel">
      <div className="flex items-center justify-between border-b border-[#ebe9ef] px-5 py-4">
        <div><h2 className="text-sm font-bold text-[#302d40]">Priority tasks</h2><p className="mt-0.5 text-[11px] text-[#918d9b]">Critical and recently changed work</p></div>
        <button className="flex items-center gap-1.5 rounded-lg bg-[#25223b] px-3 py-2 text-[11px] font-semibold text-white"><Plus size={14} /> Add task</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] border-collapse text-left">
          <thead><tr className="bg-[#faf9fb] text-[10px] font-bold uppercase tracking-[.08em] text-[#9b97a4]"><th className="px-5 py-2.5">Task</th><th className="px-3 py-2.5">Owner</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5">Due</th><th className="px-3 py-2.5">Progress</th><th className="w-10 px-3 py-2.5" /></tr></thead>
          <tbody>
            {tasks.filter((task) => task.isCritical || task.riskState !== 'none').slice(0, 5).map((task) => {
              const assignee = assignees.find((person) => person.id === task.assigneeId)
              return (
                <tr key={task.id} className="group border-t border-[#efedf2] hover:bg-[#fcfbfd]">
                  <td className="px-5 py-3"><div className="flex items-center gap-2.5"><span className={`h-2 w-2 rounded-full ${task.riskState === 'at-risk' ? 'bg-[#e06c49]' : task.status === 'completed' ? 'bg-emerald-500' : 'bg-[#7062e3]'}`} /><div><p className="text-xs font-semibold text-[#464152]">{task.title}</p>{task.changeNote && <p className="mt-0.5 text-[10px] text-[#b26042]">{task.changeNote}</p>}</div></div></td>
                  <td className="px-3 py-3"><div className="flex items-center gap-2"><Avatar assignee={assignee} size="sm" /><span className="text-[11px] text-[#6f6a79]">{assignee?.name}</span></div></td>
                  <td className="px-3 py-3"><StatusBadge status={task.status} risk={task.riskState} /></td>
                  <td className={`px-3 py-3 text-[11px] font-semibold ${task.riskState === 'at-risk' ? 'text-[#c15a37]' : 'text-[#696474]'}`}>{formatDate(task.endDate)}</td>
                  <td className="px-3 py-3"><div className="flex items-center gap-2"><div className="h-1.5 w-16 overflow-hidden rounded-full bg-[#eceaf0]"><div className={`h-full rounded-full ${task.riskState === 'at-risk' ? 'bg-[#e47a52]' : 'bg-[#6e60e7]'}`} style={{ width: `${task.progress}%` }} /></div><span className="text-[10px] font-semibold text-[#8f8a98]">{task.progress}%</span></div></td>
                  <td className="px-3 py-3"><button className="rounded-lg p-1.5 text-[#aaa6b2] opacity-40 group-hover:opacity-100" aria-label={`Open ${task.title}`}><MoreHorizontal size={16} /></button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <button className="flex w-full items-center justify-center gap-1.5 border-t border-[#ebe9ef] py-3 text-[11px] font-semibold text-[#6658d7] hover:bg-[#faf9ff]">View all {tasks.length} tasks <ArrowUpRight size={13} /></button>
    </section>
  )
}
