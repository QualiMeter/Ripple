import { useCallback, useEffect, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { ProjectFormPanel } from '../projects/ProjectFormPanel'
import { projectService } from '../../services/projectService'
import type { CreateProjectRequest, ProjectNavigationItem } from '../../types/project'
import { Sidebar } from './Sidebar'

export interface AppShellContext {
  openMobileSidebar: () => void
  refreshProjects: () => Promise<void>
  syncProjectNavigation: (project: ProjectNavigationItem) => void
  removeProjectNavigation: (projectId: string) => void
  projects: ProjectNavigationItem[]
  projectsLoading: boolean
  projectsError: string | null
}

export function AppShell() {
  const navigate = useNavigate()
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [createProjectOpen, setCreateProjectOpen] = useState(false)
  const [projects, setProjects] = useState<ProjectNavigationItem[]>([])
  const [projectsLoading, setProjectsLoading] = useState(true)
  const [projectsError, setProjectsError] = useState<string | null>(null)

  const refreshProjects = async () => {
    try {
      setProjectsError(null)
      const nextProjects = await projectService.listProjects()
      setProjects(nextProjects)
    } catch (error) {
      setProjectsError(error instanceof Error ? error.message : 'Не удалось загрузить проекты.')
      throw error
    } finally {
      setProjectsLoading(false)
    }
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

  const syncProjectNavigation = useCallback((project: ProjectNavigationItem) => {
    setProjects((current) => {
      const previous = current.find((candidate) => candidate.id === project.id)
      if (previous && previous.name === project.name && previous.startDate === project.startDate
        && previous.targetEndDate === project.targetEndDate && previous.taskCount === project.taskCount
        && previous.employeeCount === project.employeeCount) return current
      return current.map((candidate) => candidate.id === project.id ? project : candidate)
    })
  }, [])

  const removeProjectNavigation = useCallback((projectId: string) => {
    setProjects((current) => current.filter((project) => project.id !== projectId))
  }, [])

  return (
    <div className="min-h-screen bg-[#f5f5f8] lg:flex">
      <Sidebar projects={projects} loading={projectsLoading} error={projectsError} onCreateProject={openCreateProject} />
      {mobileSidebarOpen && <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Навигация">
        <Sidebar projects={projects} loading={projectsLoading} error={projectsError} mobile onClose={() => setMobileSidebarOpen(false)} onCreateProject={openCreateProject} />
        <button type="button" className="min-w-0 flex-1 bg-[#17152b]/55 backdrop-blur-[1px]" onClick={() => setMobileSidebarOpen(false)} aria-label="Закрыть навигацию по фону" />
      </div>}
      <main className="min-w-0 flex-1 lg:ml-[244px]">
        <Outlet context={{ openMobileSidebar: () => setMobileSidebarOpen(true), refreshProjects, syncProjectNavigation, removeProjectNavigation, projects, projectsLoading, projectsError } satisfies AppShellContext} />
      </main>
      {createProjectOpen && <ProjectFormPanel title="Новый проект" submitLabel="Создать проект" initialValues={{ name: '', startDate: '', targetEndDate: '' }} onClose={() => setCreateProjectOpen(false)} onSubmit={handleCreateProject} />}
    </div>
  )
}
