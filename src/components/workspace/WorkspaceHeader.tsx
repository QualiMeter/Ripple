import { useEffect, useRef, useState } from 'react'
import { Bell, ChevronDown, Menu, Pencil, Search, Share2 } from 'lucide-react'
import type { ImpactAnalysis } from '../../types/impact'
import type { ProjectSummary } from '../../types/project'

const healthLabels: Record<ProjectSummary['health'], string> = {
  'on-track': 'По плану',
  'at-risk': 'Под угрозой',
  'off-track': 'Срок сорван',
}

const healthStyles: Record<ProjectSummary['health'], { badge: string; dot: string }> = {
  'on-track': { badge: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  'at-risk': { badge: 'bg-[#fff2e7] text-[#a04f25]', dot: 'bg-[#e47d45]' },
  'off-track': { badge: 'bg-rose-50 text-rose-700', dot: 'bg-rose-500' },
}

export type WorkspaceView = 'overview' | 'timeline' | 'dependencies' | 'employees' | 'risks'

const projectViews: Array<{ id: WorkspaceView; label: string }> = [
  { id: 'overview', label: 'Обзор' },
  { id: 'timeline', label: 'План' },
  { id: 'dependencies', label: 'Зависимости' },
  { id: 'employees', label: 'Сотрудники' },
  { id: 'risks', label: 'Риски и последствия' },
]

export function WorkspaceHeader({ project, impact, activeView, onViewChange, onOpenNavigation, onEditProject }: { project: ProjectSummary; impact: ImpactAnalysis; activeView: WorkspaceView; onViewChange: (view: WorkspaceView) => void; onOpenNavigation: () => void; onEditProject: () => void }) {
  const healthStyle = healthStyles[project.health]
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const closeMenu = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key !== 'Escape') return
      if (event instanceof MouseEvent && menuRef.current?.contains(event.target as Node)) return
      setMenuOpen(false)
    }
    document.addEventListener('mousedown', closeMenu)
    document.addEventListener('keydown', closeMenu)
    return () => {
      document.removeEventListener('mousedown', closeMenu)
      document.removeEventListener('keydown', closeMenu)
    }
  }, [menuOpen])
  return (
    <>
      <header className="flex h-[72px] items-center gap-4 border-b border-[#e8e7ed] bg-white px-4 sm:px-7">
        <button type="button" onClick={onOpenNavigation} className="rounded-lg p-2 text-slate-500 lg:hidden" aria-label="Открыть навигацию"><Menu size={20} /></button>
        <div className="hidden items-center gap-2 text-sm text-[#817d8f] sm:flex">
          <span>Проекты</span><span className="text-[#c2bfca]">/</span><span className="font-medium text-[#353244]">{project.name}</span>
        </div>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <button className="grid h-9 w-9 place-items-center rounded-xl text-[#706c7c] transition hover:bg-[#f4f3f7]" aria-label="Поиск"><Search size={18} /></button>
          <button className="relative grid h-9 w-9 place-items-center rounded-xl text-[#706c7c] transition hover:bg-[#f4f3f7]" aria-label="Уведомления"><Bell size={18} /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#e46956] ring-2 ring-white" /></button>
          <div className="mx-1 hidden h-6 w-px bg-[#e5e3ea] sm:block" />
          <button className="hidden items-center gap-2 rounded-xl border border-[#dedce6] bg-white px-3.5 py-2 text-xs font-semibold text-[#494557] shadow-sm transition hover:border-[#c9c5d5] sm:flex"><Share2 size={15} /> Поделиться</button>
          <div className="relative" ref={menuRef}>
            <button type="button" onClick={() => setMenuOpen((value) => !value)} className="flex items-center gap-2 rounded-xl bg-[#211f37] px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#302d4c]" aria-expanded={menuOpen} aria-haspopup="menu">Меню проекта <ChevronDown size={14} /></button>
            {menuOpen && <div className="absolute right-0 top-[calc(100%+8px)] z-40 w-52 rounded-xl border border-[#e4e1e9] bg-white p-1.5 shadow-[0_14px_36px_rgba(32,29,49,.16)]" role="menu"><button type="button" onClick={() => { setMenuOpen(false); onEditProject() }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-semibold text-[#4a4557] hover:bg-[#f5f3f8]" role="menuitem"><Pencil size={14} /> Редактировать проект</button></div>}
          </div>
        </div>
      </header>
      <div className="border-b border-[#e8e7ed] bg-white px-4 pb-0 pt-6 sm:px-7">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <div className="mb-2 flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-[-.035em] text-[#252238] sm:text-[28px]">{project.name}</h1>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${healthStyle.badge}`}><span className={`h-1.5 w-1.5 rounded-full ${healthStyle.dot}`} />{healthLabels[project.health]}</span>
            </div>
            <p className="text-sm text-[#837f8e]">{project.description}</p>
          </div>
          <div className="flex items-center gap-1 rounded-xl bg-[#f3f2f6] p-1 text-xs font-semibold">
            <button className="rounded-lg bg-white px-3.5 py-2 text-[#302d40] shadow-sm">Рабочая область</button>
            <button className="rounded-lg px-3.5 py-2 text-[#777383]">История</button>
          </div>
        </div>
        <nav className="mt-6 flex gap-6 overflow-x-auto text-sm" aria-label="Разделы проекта">
          {projectViews.map((view) => (
            <button key={view.id} type="button" onClick={() => onViewChange(view.id)} className={`whitespace-nowrap border-b-2 pb-3 font-medium ${activeView === view.id ? 'border-[#6d5dfb] text-[#4f42c7]' : 'border-transparent text-[#7b7787] hover:text-[#3e3a4d]'}`}>{view.label}{view.id === 'risks' && <span className="ml-1.5 rounded-full bg-[#fff0e6] px-1.5 py-0.5 text-[10px] text-[#bc5e2d]">{impact.atRiskTaskIds.length}</span>}</button>
          ))}
        </nav>
      </div>
    </>
  )
}
