import { useEffect, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import type { AppShellContext } from '../components/layout/AppShell'
import { ImpactPanel } from '../components/workspace/ImpactPanel'
import { DependenciesView } from '../components/workspace/DependenciesView'
import { TaskEditPanel } from '../components/workspace/TaskEditPanel'
import { TaskCreatePanel } from '../components/workspace/TaskCreatePanel'
import { WorkspaceHeader, type WorkspaceView } from '../components/workspace/WorkspaceHeader'
import { OverviewDashboard } from '../components/workspace/OverviewDashboard'
import { PlanWorkspaceView } from '../components/workspace/PlanWorkspaceView'
import { ProjectFormPanel } from '../components/projects/ProjectFormPanel'
import { ProjectBoundaryWarnings } from '../components/projects/ProjectBoundaryWarnings'
import { projectService } from '../services/projectService'
import type { ProjectWorkspace } from '../types/workspace'
import type { TaskCreateRequest, TaskUpdateRequest } from '../types/task'
import type { CreateDependencyRequest } from '../types/dependency'
import type { ScheduleShiftPreview } from '../types/schedule'
import type { CreateProjectRequest } from '../types/project'
import type { Employee } from '../types/employee'
import { EmployeesView } from '../components/employees/EmployeesView'
import { ProjectDeleteDialog } from '../components/projects/ProjectDeleteDialog'
import { getCurrentIssueCount } from '../services/currentProjectAnalysis'
import { deleteProjectAndLeave } from '../services/projectDeletion'

function WorkspaceSkeleton() {
  return <div className="p-7" role="status" aria-label="Загрузка проекта"><span className="sr-only">Загрузка проекта…</span><div className="h-8 w-64 animate-pulse rounded-lg bg-[#e5e3ea]" /><div className="mt-8 grid grid-cols-4 gap-3">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-32 animate-pulse rounded-2xl bg-white" />)}</div></div>
}

export function ProjectWorkspacePage() {
  const { openMobileSidebar, refreshProjects } = useOutletContext<AppShellContext>()
  const navigate = useNavigate()
  const { projectId = '' } = useParams()
  const [workspace, setWorkspace] = useState<ProjectWorkspace | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [isCreatingTask, setIsCreatingTask] = useState(false)
  const [activeView, setActiveView] = useState<WorkspaceView>('overview')
  const [isEditingProject, setIsEditingProject] = useState(false)
  const [isDeletingProject, setIsDeletingProject] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)

  useEffect(() => {
    let active = true
    setWorkspace(null)
    setError(null)
    setSelectedTaskId(null)
    setIsCreatingTask(false)
    setIsEditingProject(false)
    setIsDeletingProject(false)
    setActiveView('overview')
    projectService.getWorkspace(projectId)
      .then((result) => active && setWorkspace(result))
      .catch((loadError: unknown) => active && setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить проект.'))
    return () => { active = false }
  }, [projectId, loadAttempt])

  if (error) return <div className="grid min-h-screen place-items-center p-8"><div className="text-center text-sm text-rose-700"><p>{error}</p><button type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)} className="mt-4 rounded-xl bg-[#29263e] px-4 py-2 font-bold text-white">Повторить</button></div></div>
  if (!workspace) return <WorkspaceSkeleton />

  const selectedTask = workspace.tasks.find((task) => task.id === selectedTaskId)
  const handleTaskSave = async (update: TaskUpdateRequest) => {
    const updatedWorkspace = await projectService.updateTask(projectId, selectedTaskId!, update)
    setWorkspace(updatedWorkspace)
    setSelectedTaskId(null)
  }
  const handleDependencyCreate = async (request: CreateDependencyRequest) => {
    setWorkspace(await projectService.createDependency(projectId, request))
  }
  const handleDependencyDelete = async (dependencyId: string) => {
    setWorkspace(await projectService.deleteDependency(projectId, dependencyId))
  }
  const handleTaskCreate = async (request: TaskCreateRequest) => {
    setWorkspace(await projectService.createTask(projectId, request))
    setIsCreatingTask(false)
  }
  const handleTaskDelete = async () => {
    if (!selectedTaskId) return
    setWorkspace(await projectService.deleteTask(projectId, selectedTaskId))
    setSelectedTaskId(null)
  }
  const handleSchedulePreview = (sourceTaskId: string) => projectService.previewScheduleShift(projectId, sourceTaskId)
  const handleScheduleApply = async (preview: ScheduleShiftPreview, confirmProjectEndDate: boolean) => {
    setWorkspace(await projectService.applyScheduleShift(projectId, preview, confirmProjectEndDate))
  }
  const handleEmployeeCreate = async (name: string): Promise<Employee> => {
    const employee = await projectService.createEmployee(projectId, { name })
    setWorkspace(await projectService.getWorkspace(projectId))
    return employee
  }
  const handleEmployeeUpdate = async (employeeId: string, name: string): Promise<Employee> => {
    const employee = await projectService.updateEmployee(projectId, employeeId, { name })
    setWorkspace(await projectService.getWorkspace(projectId))
    return employee
  }
  const handleProjectUpdate = async (request: CreateProjectRequest) => {
    const updatedWorkspace = await projectService.updateProject(projectId, request)
    setWorkspace(updatedWorkspace)
    await refreshProjects()
    setIsEditingProject(false)
  }
  const handleProjectDelete = async () => {
    await deleteProjectAndLeave(projectId, {
      deleteProject: projectService.deleteProject,
      closeDialog: () => setIsDeletingProject(false),
      refreshProjects,
      navigateHome: () => navigate('/', { replace: true }),
    })
  }

  return (
    <div className="min-h-screen">
      <WorkspaceHeader project={workspace.project} currentIssueCount={getCurrentIssueCount(workspace.currentIssues)} activeView={activeView} onViewChange={setActiveView} onOpenNavigation={openMobileSidebar} onEditProject={() => setIsEditingProject(true)} onDeleteProject={() => setIsDeletingProject(true)} />
      <div className="space-y-4 p-4 sm:p-7">
        <ProjectBoundaryWarnings issues={workspace.projectBoundaryIssues} />
        {activeView === 'overview' && <OverviewDashboard workspace={workspace} onTaskSelect={setSelectedTaskId} onOpenRisks={() => setActiveView('risks')} />}
        {activeView === 'timeline' && <PlanWorkspaceView workspace={workspace} onTaskSelect={setSelectedTaskId} onTaskCreate={() => setIsCreatingTask(true)} onOpenRisks={() => setActiveView('risks')} />}
        {activeView === 'dependencies' && <DependenciesView tasks={workspace.tasks} dependencies={workspace.dependencies} assignees={workspace.assignees} impact={workspace.impact} currentIssues={workspace.currentIssues} onTaskSelect={(task) => setSelectedTaskId(task.id)} onCreateDependency={handleDependencyCreate} onDeleteDependency={handleDependencyDelete} onTaskCreate={() => setIsCreatingTask(true)} />}
        {activeView === 'employees' && <EmployeesView employees={workspace.assignees} tasks={workspace.tasks} onCreateEmployee={handleEmployeeCreate} onUpdateEmployee={handleEmployeeUpdate} onTaskSelect={(task) => setSelectedTaskId(task.id)} />}
        {activeView === 'risks' && <div data-workspace-view="risks"><ImpactPanel workspace={workspace} onPreviewScheduleShift={handleSchedulePreview} onApplyScheduleShift={handleScheduleApply} onTaskSelect={setSelectedTaskId} /></div>}
      </div>
      {selectedTask && <TaskEditPanel task={selectedTask} assignees={workspace.assignees} tasks={workspace.tasks} dependencies={workspace.dependencies} onClose={() => setSelectedTaskId(null)} onSave={handleTaskSave} onDelete={handleTaskDelete} onCreateDependency={handleDependencyCreate} onDeleteDependency={handleDependencyDelete} onCreateEmployee={handleEmployeeCreate} />}
      {isCreatingTask && <TaskCreatePanel assignees={workspace.assignees} initialStartDate={workspace.project.startDate} onClose={() => setIsCreatingTask(false)} onCreate={handleTaskCreate} onCreateEmployee={handleEmployeeCreate} />}
      {isEditingProject && <ProjectFormPanel title="Редактирование проекта" submitLabel="Сохранить" initialValues={{ name: workspace.project.name, startDate: workspace.project.startDate, targetEndDate: workspace.project.targetEndDate }} onClose={() => setIsEditingProject(false)} onSubmit={handleProjectUpdate} />}
      {isDeletingProject && <ProjectDeleteDialog projectName={workspace.project.name} onClose={() => setIsDeletingProject(false)} onConfirm={handleProjectDelete} />}
    </div>
  )
}
