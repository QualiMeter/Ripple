import {
  Boxes,
  ChevronDown,
  CircleHelp,
  FolderKanban,
  LayoutDashboard,
  Plus,
  Settings,
  Sparkles,
  X,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import type { ProjectSummary } from '../../types/project'
import { formatTaskCount } from '../../utils/plural'

interface SidebarProps {
  projects: ProjectSummary[]
  loading: boolean
  onCreateProject: () => void
  mobile?: boolean
  onClose?: () => void
}

const healthLabels: Record<ProjectSummary['health'], string> = {
  'on-track': 'По плану',
  'at-risk': 'Под угрозой',
  'off-track': 'Срок сорван',
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toLocaleUpperCase('ru-RU')
}

export function Sidebar({ projects, loading, onCreateProject, mobile = false, onClose }: SidebarProps) {
  const defaultProjectPath = `/projects/${projects[0]?.id ?? 'aurora-launch'}`
  const navItems = [
    { label: 'Обзор', icon: LayoutDashboard, to: defaultProjectPath },
    { label: 'Проекты', icon: FolderKanban, to: defaultProjectPath },
    { label: 'Портфель', icon: Boxes, to: '/portfolio' },
  ]
  return (
    <aside className={mobile ? 'flex h-full w-[280px] max-w-[86vw] shrink-0 flex-col bg-[#17152b] text-white shadow-[24px_0_60px_rgba(23,21,43,.28)]' : 'hidden h-screen w-[244px] shrink-0 flex-col bg-[#17152b] text-white lg:fixed lg:flex'} aria-label={mobile ? 'Мобильная навигация' : undefined}>
      <div className="flex h-[72px] items-center gap-3 px-6">
        <div className="relative grid h-8 w-8 place-items-center rounded-xl bg-[#7667ff] shadow-[0_8px_24px_rgba(118,103,255,.35)]">
          <span className="h-3.5 w-3.5 rounded-full border-[3px] border-white" />
          <span className="absolute right-[5px] top-[5px] h-1.5 w-1.5 rounded-full bg-[#f6bb72]" />
        </div>
        <span className="text-xl font-semibold tracking-[-.04em]">Ripple</span>
        {mobile && <button type="button" onClick={onClose} className="ml-auto grid h-9 w-9 place-items-center rounded-xl text-[#aaa6ba] transition hover:bg-white/[.08] hover:text-white" aria-label="Закрыть навигацию"><X size={19} /></button>}
      </div>

      <nav className="mt-5 px-3" aria-label="Основная навигация">
        <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[.14em] text-[#858198]">Рабочая область</p>
        <div className="space-y-1">
          {navItems.map(({ label, icon: Icon, to }, index) => (
            <NavLink
              key={label}
              to={to}
              onClick={onClose}
              className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive && index === 1 ? 'bg-white/[.09] text-white' : 'text-[#aaa6ba] hover:bg-white/[.06] hover:text-white'}`}
            >
              <Icon size={18} strokeWidth={1.8} />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>

      <div className="mx-3 mt-7 rounded-2xl border border-white/[.08] bg-white/[.045] p-3">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="h-2 w-2 rounded-full bg-[#8b7fff]" />
            Мои проекты
          </div>
          <button type="button" onClick={onCreateProject} className="grid h-7 w-7 place-items-center rounded-lg text-[#aaa6ba] transition hover:bg-white/[.08] hover:text-white" aria-label="Создать проект"><Plus size={15} /></button>
        </div>
        <div className="max-h-[260px] space-y-1 overflow-y-auto">
          {loading && <div className="h-14 animate-pulse rounded-xl bg-white/[.06]" aria-label="Загрузка проектов" />}
          {!loading && projects.length === 0 && <p className="rounded-xl bg-white/[.04] p-3 text-[11px] leading-4 text-[#9691a6]">Проектов пока нет. Создайте первый проект.</p>}
          {projects.map((project) => <NavLink key={project.id} to={`/projects/${project.id}`} onClick={onClose} className={({ isActive }) => `block rounded-xl p-2.5 transition ${isActive ? 'bg-white/[.1]' : 'hover:bg-white/[.06]'}`}>
            <div className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[#8a79ff] to-[#5a49d6] text-[10px] font-bold">{initials(project.name)}</div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-white">{project.name}</p>
                <p className="mt-0.5 text-[11px] text-[#9691a6]">{formatTaskCount(project.taskCount)} · {healthLabels[project.health]}</p>
              </div>
            </div>
          </NavLink>)}
        </div>
      </div>

      <div className="mt-auto px-3 pb-4">
        <div className="mb-3 rounded-2xl bg-gradient-to-br from-[#292545] to-[#211e39] p-4">
          <Sparkles size={17} className="mb-2.5 text-[#f1b971]" />
          <p className="text-xs font-semibold">Анализ влияния активен</p>
          <p className="mt-1 text-[11px] leading-4 text-[#9e99ae]">Ripple анализирует изменения и зависимости в ваших проектах.</p>
        </div>
        <a href="#help" onClick={onClose} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-[#aaa6ba] hover:text-white"><CircleHelp size={17} /> Центр помощи</a>
        <a href="#settings" onClick={onClose} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-[#aaa6ba] hover:text-white"><Settings size={17} /> Настройки</a>
        <div className="mt-3 flex items-center gap-3 border-t border-white/[.08] px-2 pt-4">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-[#e7b4a6] text-[10px] font-bold text-[#512e2a]">МЧ</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">Майя Чен</p>
            <p className="text-[10px] text-[#858198]">Руководитель продукта</p>
          </div>
          <ChevronDown size={15} className="text-[#858198]" />
        </div>
      </div>
    </aside>
  )
}
