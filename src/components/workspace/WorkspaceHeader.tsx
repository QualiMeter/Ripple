import { Bell, ChevronDown, Menu, Search, Share2 } from 'lucide-react'
import type { ProjectSummary } from '../../types/project'

export function WorkspaceHeader({ project }: { project: ProjectSummary }) {
  return (
    <>
      <header className="flex h-[72px] items-center gap-4 border-b border-[#e8e7ed] bg-white px-4 sm:px-7">
        <button className="rounded-lg p-2 text-slate-500 lg:hidden" aria-label="Open navigation"><Menu size={20} /></button>
        <div className="hidden items-center gap-2 text-sm text-[#817d8f] sm:flex">
          <span>Projects</span><span className="text-[#c2bfca]">/</span><span className="font-medium text-[#353244]">Aurora Platform</span>
        </div>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <button className="grid h-9 w-9 place-items-center rounded-xl text-[#706c7c] transition hover:bg-[#f4f3f7]" aria-label="Search"><Search size={18} /></button>
          <button className="relative grid h-9 w-9 place-items-center rounded-xl text-[#706c7c] transition hover:bg-[#f4f3f7]" aria-label="Notifications"><Bell size={18} /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#e46956] ring-2 ring-white" /></button>
          <div className="mx-1 hidden h-6 w-px bg-[#e5e3ea] sm:block" />
          <button className="hidden items-center gap-2 rounded-xl border border-[#dedce6] bg-white px-3.5 py-2 text-xs font-semibold text-[#494557] shadow-sm transition hover:border-[#c9c5d5] sm:flex"><Share2 size={15} /> Share</button>
          <button className="flex items-center gap-2 rounded-xl bg-[#211f37] px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#302d4c]">Project menu <ChevronDown size={14} /></button>
        </div>
      </header>
      <div className="border-b border-[#e8e7ed] bg-white px-4 pb-0 pt-6 sm:px-7">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <div className="mb-2 flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-[-.035em] text-[#252238] sm:text-[28px]">{project.name}</h1>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fff2e7] px-2.5 py-1 text-[11px] font-semibold text-[#a04f25]"><span className="h-1.5 w-1.5 rounded-full bg-[#e47d45]" />At risk</span>
            </div>
            <p className="text-sm text-[#837f8e]">{project.description}</p>
          </div>
          <div className="flex items-center gap-1 rounded-xl bg-[#f3f2f6] p-1 text-xs font-semibold">
            <button className="rounded-lg bg-white px-3.5 py-2 text-[#302d40] shadow-sm">Workspace</button>
            <button className="rounded-lg px-3.5 py-2 text-[#777383]">Activity</button>
          </div>
        </div>
        <nav className="mt-6 flex gap-6 overflow-x-auto text-sm" aria-label="Project views">
          {['Overview', 'Timeline', 'Dependencies', 'Risks & impact'].map((item, index) => (
            <button key={item} className={`whitespace-nowrap border-b-2 pb-3 font-medium ${index === 0 ? 'border-[#6d5dfb] text-[#4f42c7]' : 'border-transparent text-[#7b7787] hover:text-[#3e3a4d]'}`}>{item}{item === 'Risks & impact' && <span className="ml-1.5 rounded-full bg-[#fff0e6] px-1.5 py-0.5 text-[10px] text-[#bc5e2d]">4</span>}</button>
          ))}
        </nav>
      </div>
    </>
  )
}
