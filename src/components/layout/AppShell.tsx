import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'

export function AppShell() {
  return (
    <div className="min-h-screen bg-[#f5f5f8] lg:flex">
      <Sidebar />
      <main className="min-w-0 flex-1 lg:ml-[244px]">
        <Outlet />
      </main>
    </div>
  )
}
