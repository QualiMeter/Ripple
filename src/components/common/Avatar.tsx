import type { Assignee } from '../../types/task'

export function Avatar({ assignee, size = 'md' }: { assignee?: Assignee; size?: 'sm' | 'md' }) {
  if (!assignee) return null
  return (
    <span
      className={`${size === 'sm' ? 'h-6 w-6 text-[9px]' : 'h-8 w-8 text-[10px]'} inline-grid shrink-0 place-items-center rounded-full font-bold text-white ring-2 ring-white`}
      style={{ backgroundColor: assignee.color }}
      title={`${assignee.name} · ${assignee.role}`}
    >
      {assignee.initials}
    </span>
  )
}
