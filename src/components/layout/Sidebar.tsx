import {
  Boxes,
  ChevronDown,
  CircleHelp,
  FolderKanban,
  LayoutDashboard,
  Plus,
  Settings,
  Sparkles,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'

const navItems = [
  { label: 'Overview', icon: LayoutDashboard, to: '/projects/aurora-launch' },
  { label: 'Projects', icon: FolderKanban, to: '/projects/aurora-launch' },
  { label: 'Portfolio', icon: Boxes, to: '/portfolio' },
]

export function Sidebar() {
  return (
    <aside className="hidden h-screen w-[244px] shrink-0 flex-col bg-[#17152b] text-white lg:fixed lg:flex">
      <div className="flex h-[72px] items-center gap-3 px-6">
        <div className="relative grid h-8 w-8 place-items-center rounded-xl bg-[#7667ff] shadow-[0_8px_24px_rgba(118,103,255,.35)]">
          <span className="h-3.5 w-3.5 rounded-full border-[3px] border-white" />
          <span className="absolute right-[5px] top-[5px] h-1.5 w-1.5 rounded-full bg-[#f6bb72]" />
        </div>
        <span className="text-xl font-semibold tracking-[-.04em]">Ripple</span>
      </div>

      <nav className="mt-5 px-3" aria-label="Primary navigation">
        <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[.14em] text-[#858198]">Workspace</p>
        <div className="space-y-1">
          {navItems.map(({ label, icon: Icon, to }, index) => (
            <NavLink
              key={label}
              to={to}
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
            My projects
          </div>
          <Plus size={15} className="text-[#8e8a9f]" />
        </div>
        <div className="rounded-xl bg-white/[.07] p-2.5">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[#8a79ff] to-[#5a49d6] text-[10px] font-bold">AU</div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-white">Aurora Platform</p>
              <p className="mt-0.5 text-[11px] text-[#9691a6]">10 tasks · At risk</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-auto px-3 pb-4">
        <div className="mb-3 rounded-2xl bg-gradient-to-br from-[#292545] to-[#211e39] p-4">
          <Sparkles size={17} className="mb-2.5 text-[#f1b971]" />
          <p className="text-xs font-semibold">Impact signals are live</p>
          <p className="mt-1 text-[11px] leading-4 text-[#9e99ae]">Ripple tracks 11 dependencies in this project.</p>
        </div>
        <a href="#help" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-[#aaa6ba] hover:text-white"><CircleHelp size={17} /> Help center</a>
        <a href="#settings" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-[#aaa6ba] hover:text-white"><Settings size={17} /> Settings</a>
        <div className="mt-3 flex items-center gap-3 border-t border-white/[.08] px-2 pt-4">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-[#e7b4a6] text-[10px] font-bold text-[#512e2a]">MC</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">Maya Chen</p>
            <p className="text-[10px] text-[#858198]">Product lead</p>
          </div>
          <ChevronDown size={15} className="text-[#858198]" />
        </div>
      </div>
    </aside>
  )
}
