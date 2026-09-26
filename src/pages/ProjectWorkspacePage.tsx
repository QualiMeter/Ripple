import { useEffect, useState } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
import type { AppShellContext } from '../components/layout/AppShell'
import { ImpactPanel } from '../components/workspace/ImpactPanel'
import { DependenciesView } from '../components/workspace/DependenciesView'
import { MetricCards } from '../components/workspace/MetricCards'
import { TaskList } from '../components/workspace/TaskList'
import { TaskEditPanel } from '../components/workspace/TaskEditPanel'
import { TaskCreatePanel } from '../components/workspace/TaskCreatePanel'
import { Timeline } from '../components/workspace/Timeline'
import { WorkspaceHeader, type WorkspaceView } from '../components/workspace/WorkspaceHeader'
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

function WorkspaceSkeleton() {
  return <div className="p-7" role="status" aria-label="Загрузка проекта"><span className="sr-only">Загрузка проекта…</span><div className="h-8 w-64 animate-pulse rounded-lg bg-[#e5e3ea]" /><div className="mt-8 grid grid-cols-4 gap-3">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-32 animate-pulse rounded-2xl bg-white" />)}</div></div>
}

export function ProjectWorkspacePage() {
  const { openMobileSidebar, refreshProjects } = useOutletContext<AppShellContext>()
  const { projectId = '' } = useParams()
  const [workspace, setWorkspace] = useState<ProjectWorkspace | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [isCreatingTask, setIsCreatingTask] = useState(false)
  const [showAllTasks, setShowAllTasks] = useState(false)
  const [activeView, setActiveView] = useState<WorkspaceView>('overview')
  const [isEditingProject, setIsEditingProject] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)

  useEffect(() => {
    let active = true
    setWorkspace(null)
    setError(null)
    setSelectedTaskId(null)
    setIsCreatingTask(false)
    setIsEditingProject(false)
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
    setShowAllTasks(true)
    setIsCreatingTask(false)
  }
  const handleTaskDelete = async () => {
    if (!selectedTaskId) return
    setWorkspace(await projectService.deleteTask(projectId, selectedTaskId))
    setSelectedTaskId(null)
  }
  const handleSchedulePreview = (sourceTaskId: string) => projectService.previewScheduleShift(projectId, sourceTaskId)
  const handleScheduleApply = async (preview: ScheduleShiftPreview) => {
    setWorkspace(await projectService.applyScheduleShift(projectId, preview))
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

  const impactPanel = <ImpactPanel workspace={workspace} onPreviewScheduleShift={handleSchedulePreview} onApplyScheduleShift={handleScheduleApply} onTaskSelect={(taskId) => setSelectedTaskId(taskId)} />

  const taskList = <TaskList tasks={workspace.tasks} assignees={workspace.assignees} affectedTaskIds={workspace.impact.affectedTaskIds} criticalTaskIds={workspace.impact.criticalTaskIds} onTaskSelect={(task) => setSelectedTaskId(task.id)} onTaskCreate={() => setIsCreatingTask(true)} showAll={showAllTasks} onShowAllChange={setShowAllTasks} />
  const timeline = <Timeline project={workspace.project} tasks={workspace.tasks} assignees={workspace.assignees} impact={workspace.impact} onTaskSelect={(task) => setSelectedTaskId(task.id)} />

  return (
    <div className="min-h-screen">
      <WorkspaceHeader project={workspace.project} impact={workspace.impact} activeView={activeView} onViewChange={setActiveView} onOpenNavigation={openMobileSidebar} onEditProject={() => setIsEditingProject(true)} />
      <div className="space-y-4 p-4 sm:p-7">
        <ProjectBoundaryWarnings issues={workspace.projectBoundaryIssues} />
        {activeView === 'overview' && <>
          <MetricCards workspace={workspace} />
          <div className="grid items-start gap-4 2xl:grid-cols-[minmax(0,1fr)_330px]">
            <div className="min-w-0 space-y-4">{timeline}{taskList}</div>
            {impactPanel}
          </div>
        </>}
        {activeView === 'timeline' && <div className="space-y-4">{timeline}{taskList}</div>}
        {activeView === 'dependencies' && <DependenciesView tasks={workspace.tasks} dependencies={workspace.dependencies} assignees={workspace.assignees} impact={workspace.impact} onTaskSelect={(task) => setSelectedTaskId(task.id)} onCreateDependency={handleDependencyCreate} onDeleteDependency={handleDependencyDelete} onTaskCreate={() => setIsCreatingTask(true)} />}
        {activeView === 'employees' && <EmployeesView employees={workspace.assignees} tasks={workspace.tasks} onCreateEmployee={handleEmployeeCreate} onUpdateEmployee={handleEmployeeUpdate} onTaskSelect={(task) => setSelectedTaskId(task.id)} />}
        {activeView === 'risks' && <><MetricCards workspace={workspace} /><div className="grid items-start gap-4 2xl:grid-cols-[minmax(0,1fr)_330px]">{taskList}{impactPanel}</div></>}
      </div>
      {selectedTask && <TaskEditPanel task={selectedTask} assignees={workspace.assignees} tasks={workspace.tasks} dependencies={workspace.dependencies} onClose={() => setSelectedTaskId(null)} onSave={handleTaskSave} onDelete={handleTaskDelete} onCreateDependency={handleDependencyCreate} onDeleteDependency={handleDependencyDelete} onCreateEmployee={handleEmployeeCreate} />}
      {isCreatingTask && <TaskCreatePanel assignees={workspace.assignees} initialStartDate={workspace.project.startDate} onClose={() => setIsCreatingTask(false)} onCreate={handleTaskCreate} onCreateEmployee={handleEmployeeCreate} />}
      {isEditingProject && <ProjectFormPanel title="Редактирование проекта" submitLabel="Сохранить" initialValues={{ name: workspace.project.name, startDate: workspace.project.startDate, targetEndDate: workspace.project.targetEndDate }} onClose={() => setIsEditingProject(false)} onSubmit={handleProjectUpdate} />}
    </div>
  )
}
