import { AlertTriangle } from 'lucide-react'
import type { TaskOverdueInfo } from '../../services/deadlineAnalysis'
import { getTaskStatusLabel } from '../../services/statusAnalysis'
import type { TaskStatus } from '../../types/task'
import { formatFullDate } from '../../utils/date'
import { pluralizeRu } from '../../utils/plural'
import { TooltipTrigger } from './TooltipTrigger'

function formatBadgeDays(days: number): string {
  return days === 1 ? '1 день' : `${days} дн.`
}

export function OverdueTaskBadge({ overdue, status, compact = false }: {
  overdue: TaskOverdueInfo
  status: TaskStatus
  compact?: boolean
}) {
  const dayLabel = pluralizeRu(overdue.overdueDays, ['календарный день', 'календарных дня', 'календарных дней'])
  return (
    <TooltipTrigger
      ariaLabel={`Просрочка задачи: ${overdue.overdueDays} ${dayLabel}`}
      trigger={<span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-1 text-[9px] font-bold text-rose-700 ring-1 ring-inset ring-rose-200"><AlertTriangle size={10} aria-hidden="true" />{compact ? 'Просрочено' : `Просрочено · ${formatBadgeDays(overdue.overdueDays)}`}</span>}
    >
      <span className="block text-xs font-bold">Плановый срок истёк</span>
      <span className="mt-1.5 block text-[#dedbe8]">Задача должна была завершиться {formatFullDate(overdue.deadline)}.</span>
      <span className="mt-1 block text-[#dedbe8]">Просрочка: {overdue.overdueDays} {dayLabel}.</span>
      <span className="mt-1 block text-[#dedbe8]">Текущий статус: «{getTaskStatusLabel(status)}».</span>
      {overdue.downstreamTaskCount > 0 && <span className="mt-1 block text-[#dedbe8]">Может повлиять на последующие задачи: {overdue.downstreamTaskCount}.</span>}
    </TooltipTrigger>
  )
}
