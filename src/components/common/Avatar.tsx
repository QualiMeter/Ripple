import type { Assignee } from '../../types/task'

export function Avatar({ assignee, size = 'md' }: { assignee?: Assignee; size?: 'sm' | 'md' }) {
  if (!assignee) return null
  const initials = assignee.initials ?? assignee.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toLocaleUpperCase('ru-RU')
  return (
    <span
      className={`${size === 'sm' ? 'h-6 w-6 text-[9px]' : 'h-8 w-8 text-[10px]'} inline-grid shrink-0 place-items-center rounded-full font-bold text-white ring-2 ring-white`}
      style={{ backgroundColor: assignee.color ?? '#6D5DFB' }}
      title={assignee.role ? `${assignee.name} · ${assignee.role}` : assignee.name}
    >
      {initials}
    </span>
  )
}
