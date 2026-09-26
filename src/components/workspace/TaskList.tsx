import { ArrowUpRight, MoreHorizontal, Plus } from 'lucide-react'
import { selectTasksRequiringAttention } from '../../services/taskAttention'
import type { Assignee, ProjectTask } from '../../types/task'
import { formatShortDate } from '../../utils/date'
import { formatTaskCount } from '../../utils/plural'
import { Avatar } from '../common/Avatar'
import { StatusBadge } from '../common/StatusBadge'

interface TaskListProps {
  tasks: ProjectTask[]
  assignees: Assignee[]
  affectedTaskIds: string[]
  criticalTaskIds: string[]
  onTaskSelect: (task: ProjectTask) => void
  onTaskCreate: () => void
  showAll: boolean
  onShowAllChange: (showAll: boolean) => void
}

export function TaskList({ tasks, assignees, affectedTaskIds, criticalTaskIds, onTaskSelect, onTaskCreate, showAll, onShowAllChange }: TaskListProps) {
  const affectedTaskIdSet = new Set(affectedTaskIds)
  const attentionTasks = selectTasksRequiringAttention(tasks, affectedTaskIds, criticalTaskIds)
  const visibleTasks = showAll ? tasks : attentionTasks
  return (
    <section className="overflow-hidden rounded-2xl border border-[#e5e3eb] bg-white shadow-panel">
      <div className="flex items-center justify-between border-b border-[#ebe9ef] px-5 py-4">
        <div><h2 className="text-sm font-bold text-[#302d40]">{showAll ? 'Все задачи' : 'Требуют внимания'}</h2><p className="mt-0.5 text-[11px] text-[#918d9b]">{showAll ? 'Полный список задач проекта' : 'Незавершённые критические, рискованные и затронутые задачи'}</p></div>
        <button type="button" onClick={onTaskCreate} className="flex items-center gap-1.5 rounded-lg bg-[#25223b] px-3 py-2 text-[11px] font-semibold text-white"><Plus size={14} /> Добавить задачу</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] border-collapse text-left">
          <thead><tr className="bg-[#faf9fb] text-[10px] font-bold uppercase tracking-[.08em] text-[#9b97a4]"><th className="px-5 py-2.5">Задача</th><th className="px-3 py-2.5">Ответственный</th><th className="px-3 py-2.5">Статус</th><th className="px-3 py-2.5">Срок</th><th className="px-3 py-2.5">Прогресс</th><th className="w-10 px-3 py-2.5" /></tr></thead>
          <tbody>
            {visibleTasks.map((task) => {
              const assignee = assignees.find((person) => person.id === task.assigneeId)
              const affected = affectedTaskIdSet.has(task.id)
              return (
                <tr key={task.id} className="group cursor-pointer border-t border-[#efedf2] hover:bg-[#fcfbfd] focus-within:bg-[#fcfbfd]" onClick={() => onTaskSelect(task)}>
                  <td className="px-5 py-3"><div className="flex items-center gap-2.5"><span className={`h-2 w-2 rounded-full ${affected ? 'bg-[#e7774d]' : task.riskState === 'at-risk' ? 'bg-[#df5e64]' : task.status === 'completed' ? 'bg-emerald-500' : 'bg-[#7062e3]'}`} /><div><div className="flex items-center gap-2"><p className="text-xs font-semibold text-[#464152]">{task.title}</p>{affected && <span className="rounded-full bg-[#fff0e8] px-1.5 py-0.5 text-[9px] font-bold text-[#b9542f]">Затронуто</span>}</div>{task.changeNote && <p className="mt-0.5 text-[10px] text-[#b26042]">{task.changeNote}</p>}</div></div></td>
                  <td className="px-3 py-3"><div className="flex items-center gap-2"><Avatar assignee={assignee} size="sm" /><span className="text-[11px] text-[#6f6a79]">{assignee?.name}</span></div></td>
                  <td className="px-3 py-3"><StatusBadge status={task.status} risk={task.riskState} /></td>
                  <td className={`px-3 py-3 text-[11px] font-semibold ${task.riskState === 'at-risk' ? 'text-[#c15a37]' : 'text-[#696474]'}`}>{formatShortDate(task.endDate)}</td>
                  <td className="px-3 py-3"><div className="flex items-center gap-2"><div className="h-1.5 w-16 overflow-hidden rounded-full bg-[#eceaf0]"><div className={`h-full rounded-full ${task.riskState === 'at-risk' ? 'bg-[#e47a52]' : 'bg-[#6e60e7]'}`} style={{ width: `${task.progress}%` }} /></div><span className="text-[10px] font-semibold text-[#8f8a98]">{task.progress}%</span></div></td>
                  <td className="px-3 py-3"><button className="rounded-lg p-1.5 text-[#aaa6b2] opacity-40 group-hover:opacity-100 group-focus-within:opacity-100" aria-label={`Открыть задачу «${task.title}»`}><MoreHorizontal size={16} /></button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {visibleTasks.length === 0 && <p className="px-5 py-8 text-center text-xs text-[#8f8a98]">{tasks.length === 0 ? 'В проекте пока нет задач. Добавьте первую задачу.' : 'Нет незавершённых задач, требующих внимания.'}</p>}
      </div>
      {tasks.length > 0 && <button type="button" onClick={() => onShowAllChange(!showAll)} className="flex w-full items-center justify-center gap-1.5 border-t border-[#ebe9ef] py-3 text-[11px] font-semibold text-[#6658d7] hover:bg-[#faf9ff]">{showAll ? 'Показать только требующие внимания' : `Показать все ${formatTaskCount(tasks.length)}`} <ArrowUpRight size={13} className={showAll ? 'rotate-180' : ''} /></button>}
    </section>
  )
}
