import type { RiskState, TaskStatus } from '../../types/task'

const statusLabels: Record<TaskStatus, string> = {
  completed: 'Завершено',
  'in-progress': 'В работе',
  blocked: 'Заблокировано',
  'not-started': 'Не начато',
}

export function StatusBadge({ status, risk }: { status: TaskStatus; risk: RiskState }) {
  const styles = status === 'completed'
    ? 'bg-emerald-50 text-emerald-700'
    : status === 'blocked'
      ? 'bg-rose-50 text-rose-700'
      : status === 'in-progress'
        ? 'bg-violet-50 text-violet-700'
        : 'bg-slate-100 text-slate-600'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${styles}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${risk === 'at-risk' ? 'bg-rose-500' : status === 'completed' ? 'bg-emerald-500' : 'bg-current opacity-60'}`} />
      {statusLabels[status]}
    </span>
  )
}
