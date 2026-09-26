import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'

export interface AppShellContext {
  openMobileSidebar: () => void
}

export function AppShell() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  useEffect(() => {
    if (!mobileSidebarOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileSidebarOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [mobileSidebarOpen])

  return (
    <div className="min-h-screen bg-[#f5f5f8] lg:flex">
      <Sidebar />
      {mobileSidebarOpen && <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Навигация">
        <Sidebar mobile onClose={() => setMobileSidebarOpen(false)} />
        <button type="button" className="min-w-0 flex-1 bg-[#17152b]/55 backdrop-blur-[1px]" onClick={() => setMobileSidebarOpen(false)} aria-label="Закрыть навигацию по фону" />
      </div>}
      <main className="min-w-0 flex-1 lg:ml-[244px]">
        <Outlet context={{ openMobileSidebar: () => setMobileSidebarOpen(true) } satisfies AppShellContext} />
      </main>
    </div>
  )
}
