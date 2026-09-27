import { formatFullDate } from '../../utils/date'
import { pluralizeRu } from '../../utils/plural'
import { TooltipTrigger } from './TooltipTrigger'

interface CriticalTaskBadgeProps {
  slackDays: number
  projectedProjectEndDate: string
  className?: string
}

function formatDays(value: number): string {
  return `${value} ${pluralizeRu(value, ['день', 'дня', 'дней'])}`
}

export function CriticalTaskBadge({ slackDays, projectedProjectEndDate, className }: CriticalTaskBadgeProps) {
  const hasDeficit = slackDays < 0
  const absoluteSlack = Math.abs(slackDays)
  return (
    <TooltipTrigger
      ariaLabel="Почему задача критическая"
      className={className}
      trigger={<span className="rounded-full bg-[#efedff] px-1.5 py-0.5 text-[8px] font-bold text-[#5e50c5]">Критическая</span>}
    >
      <span className="block text-xs font-bold">Критическая задача</span>
      <span className="mt-1.5 block font-semibold text-[#d9d5ff]">
        {hasDeficit ? `Дефицит запаса: ${formatDays(absoluteSlack)}.` : `Запас по срокам: ${formatDays(absoluteSlack)}.`}
      </span>
      <span className="mt-1.5 block text-[#dedbe8]">
        {hasDeficit
          ? 'По текущему расписанию задача уже выходит за допустимый временной резерв.'
          : 'У этой задачи нет временного резерва. Её задержка может сдвинуть срок завершения проекта.'}
      </span>
      <span className="mt-1.5 block text-[#dedbe8]">Прогноз завершения проекта: {formatFullDate(projectedProjectEndDate)}</span>
    </TooltipTrigger>
  )
}
