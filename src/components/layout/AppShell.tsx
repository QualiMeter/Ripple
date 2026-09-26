import { useEffect, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { ProjectFormPanel } from '../projects/ProjectFormPanel'
import { projectService } from '../../services/projectService'
import type { CreateProjectRequest, ProjectSummary } from '../../types/project'
import { Sidebar } from './Sidebar'

export interface AppShellContext {
  openMobileSidebar: () => void
  refreshProjects: () => Promise<void>
}

export function AppShell() {
  const navigate = useNavigate()
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [createProjectOpen, setCreateProjectOpen] = useState(false)
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [projectsLoading, setProjectsLoading] = useState(true)

  const refreshProjects = async () => {
    const nextProjects = await projectService.listProjects()
    setProjects(nextProjects)
    setProjectsLoading(false)
  }

  useEffect(() => {
    refreshProjects().catch(() => setProjectsLoading(false))
  }, [])

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

  const openCreateProject = () => {
    setMobileSidebarOpen(false)
    setCreateProjectOpen(true)
  }

  const handleCreateProject = async (request: CreateProjectRequest) => {
    const project = await projectService.createProject(request)
    await refreshProjects()
    setCreateProjectOpen(false)
    navigate(`/projects/${project.id}`)
  }

  return (
    <div className="min-h-screen bg-[#f5f5f8] lg:flex">
      <Sidebar projects={projects} loading={projectsLoading} onCreateProject={openCreateProject} />
      {mobileSidebarOpen && <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Навигация">
        <Sidebar projects={projects} loading={projectsLoading} mobile onClose={() => setMobileSidebarOpen(false)} onCreateProject={openCreateProject} />
        <button type="button" className="min-w-0 flex-1 bg-[#17152b]/55 backdrop-blur-[1px]" onClick={() => setMobileSidebarOpen(false)} aria-label="Закрыть навигацию по фону" />
      </div>}
      <main className="min-w-0 flex-1 lg:ml-[244px]">
        <Outlet context={{ openMobileSidebar: () => setMobileSidebarOpen(true), refreshProjects } satisfies AppShellContext} />
      </main>
      {createProjectOpen && <ProjectFormPanel title="Новый проект" submitLabel="Создать проект" initialValues={{ name: '', startDate: '', targetEndDate: '' }} onClose={() => setCreateProjectOpen(false)} onSubmit={handleCreateProject} />}
    </div>
  )
}
