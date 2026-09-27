import { addCalendarDays, formatFullDate } from '../../utils/date'
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
  const formattedProjectEnd = formatFullDate(projectedProjectEndDate)
  const delayedProjectEnd = formatFullDate(addCalendarDays(projectedProjectEndDate, 1))
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
          ? `По текущему графику задача уже выходит за допустимый срок на ${formatDays(absoluteSlack)}. Чтобы сохранить завершение проекта ${formattedProjectEnd}, нужно сократить эту задержку или скорректировать связанные работы минимум на ${formatDays(absoluteSlack)}.`
          : `Между окончанием этой задачи и следующей ограничивающей работой или сроком проекта нет свободных дней. Если задача завершится на 1 день позже и связанные работы сохранят длительность, прогноз проекта сдвинется с ${formattedProjectEnd} на ${delayedProjectEnd}.`}
      </span>
    </TooltipTrigger>
  )
}
