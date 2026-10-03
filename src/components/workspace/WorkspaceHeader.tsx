import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Download, Menu, Pencil, Sparkles, Trash2 } from 'lucide-react'
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

export type WorkspaceView = 'overview' | 'dependencies' | 'employees' | 'history'

const projectViews: Array<{ id: WorkspaceView; label: string }> = [
  { id: 'overview', label: 'Обзор' },
  { id: 'dependencies', label: 'Зависимости' },
  { id: 'employees', label: 'Сотрудники' },
  { id: 'history', label: 'История' },
]

export function WorkspaceHeader({ project, activeView, onViewChange, onOpenNavigation, onEditProject, onDeleteProject, onDownloadDiagnostics, onExportProject, onAiEditProject }: { project: ProjectSummary; activeView: WorkspaceView; onViewChange: (view: WorkspaceView) => void; onOpenNavigation: () => void; onEditProject: () => void; onDeleteProject: () => void; onDownloadDiagnostics?: () => Promise<void>; onExportProject?: () => Promise<void>; onAiEditProject?: () => void }) {
  const healthStyle = healthStyles[project.health]
  const [menuOpen, setMenuOpen] = useState(false)
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false)
  const [diagnosticsError, setDiagnosticsError] = useState<string | null>(null)
  const [transferLoading, setTransferLoading] = useState(false)
  const [transferError, setTransferError] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const handleDiagnosticsDownload = async () => {
    if (!onDownloadDiagnostics || diagnosticsLoading) return
    setDiagnosticsLoading(true)
    setDiagnosticsError(null)
    try {
      await onDownloadDiagnostics()
      setMenuOpen(false)
    } catch (error) {
      setDiagnosticsError(error instanceof Error ? error.message : 'Не удалось скачать диагностику проекта.')
    } finally {
      setDiagnosticsLoading(false)
    }
  }

  const handleProjectExport = async () => {
    if (!onExportProject || transferLoading) return
    setTransferLoading(true)
    setTransferError(null)
    try {
      await onExportProject()
      setMenuOpen(false)
    } catch (error) {
      setTransferError(error instanceof Error ? error.message : 'Не удалось экспортировать проект.')
    } finally {
      setTransferLoading(false)
    }
  }

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
        <div className="relative ml-auto" ref={menuRef}>
          <button type="button" onClick={() => setMenuOpen((value) => !value)} className="flex items-center gap-2 rounded-xl bg-[#211f37] px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#302d4c]" aria-expanded={menuOpen} aria-haspopup="menu">Меню проекта <ChevronDown size={14} /></button>
          {menuOpen && <div className="absolute right-0 top-[calc(100%+8px)] z-40 w-56 rounded-xl border border-[#e4e1e9] bg-white p-1.5 shadow-[0_14px_36px_rgba(32,29,49,.16)]" role="menu"><button type="button" onClick={() => { setMenuOpen(false); onEditProject() }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-semibold text-[#4a4557] hover:bg-[#f5f3f8]" role="menuitem"><Pencil size={14} /> Редактировать проект</button>{onAiEditProject && <button type="button" onClick={() => { setMenuOpen(false); onAiEditProject() }} className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-semibold text-[#5f51c8] hover:bg-[#f5f3ff]" role="menuitem"><Sparkles size={14} /> Изменить с помощью ИИ</button>}{onExportProject && <button type="button" disabled={transferLoading} onClick={() => void handleProjectExport()} className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-medium text-[#6f6979] hover:bg-[#f5f3f8] disabled:opacity-60" role="menuitem"><Download size={14} /> {transferLoading ? 'Экспорт…' : 'Экспортировать проект'}</button>}{transferError && <p className="px-3 py-2 text-[10px] leading-4 text-rose-700" role="alert">{transferError}</p>}{onDownloadDiagnostics && <button type="button" disabled={diagnosticsLoading} onClick={() => void handleDiagnosticsDownload()} className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-medium text-[#6f6979] hover:bg-[#f5f3f8] disabled:opacity-60" role="menuitem"><Download size={14} /> {diagnosticsLoading ? 'Подготовка данных…' : 'Скачать диагностику'}</button>}{diagnosticsError && <p className="px-3 py-2 text-[10px] leading-4 text-rose-700" role="alert">{diagnosticsError}</p>}<button type="button" onClick={() => { setMenuOpen(false); onDeleteProject() }} className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-semibold text-rose-700 hover:bg-rose-50" role="menuitem"><Trash2 size={14} /> Удалить проект</button></div>}
        </div>
      </header>
      <div className="border-b border-[#e8e7ed] bg-white px-4 pb-0 pt-6 sm:px-7">
        <div>
          <div className="mb-2 flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-[-.035em] text-[#252238] sm:text-[28px]">{project.name}</h1>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${healthStyle.badge}`}><span className={`h-1.5 w-1.5 rounded-full ${healthStyle.dot}`} />{healthLabels[project.health]}</span>
          </div>
          <p className="text-sm text-[#837f8e]">{project.description}</p>
          <p className="mt-2 flex items-center gap-2 text-[11px] font-medium text-[#777181]"><span>План проекта</span><span className="text-[#c3bfca]">•</span><span>{new Date(`${project.startDate}T00:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</span><span className="text-[#b5b1bd]">→</span><span>{new Date(`${project.targetEndDate}T00:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</span></p>
        </div>
        <nav className="mt-6 flex gap-6 overflow-x-auto text-sm" aria-label="Разделы проекта">
          {projectViews.map((view) => (
            <button key={view.id} type="button" onClick={() => onViewChange(view.id)} className={`whitespace-nowrap border-b-2 pb-3 font-medium ${activeView === view.id ? 'border-[#6d5dfb] text-[#4f42c7]' : 'border-transparent text-[#7b7787] hover:text-[#3e3a4d]'}`}>{view.label}</button>
          ))}
        </nav>
      </div>
    </>
  )
}
