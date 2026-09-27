import { useEffect, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import type { AppShellContext } from '../components/layout/AppShell'
import { DependenciesView } from '../components/workspace/DependenciesView'
import { TaskEditPanel } from '../components/workspace/TaskEditPanel'
import { TaskCreatePanel } from '../components/workspace/TaskCreatePanel'
import { WorkspaceHeader, type WorkspaceView } from '../components/workspace/WorkspaceHeader'
import { OverviewWorkspaceView } from '../components/workspace/OverviewWorkspaceView'
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
import { deleteProjectAndLeave } from '../services/projectDeletion'
import { HistoryView } from '../components/history/HistoryView'
import { projectHistory } from '../services/history/projectHistory'
import type { NewProjectHistoryEntry, ProjectHistoryEntry } from '../services/history/historyTypes'
import { dependencySnapshot, employeeSnapshot, projectUpdatedEvent, scheduleShiftEvent, taskSnapshot, taskUpdatedEvent } from '../services/history/historyEvents'
import { executeHistoryRevert } from '../services/history/historyRevert'
import { deleteEmployeeWithHistory } from '../services/history/employeeHistory'

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
  const [historyEntries, setHistoryEntries] = useState<ProjectHistoryEntry[]>([])

  useEffect(() => {
    let active = true
    setWorkspace(null)
    setError(null)
    setSelectedTaskId(null)
    setIsCreatingTask(false)
    setIsEditingProject(false)
    setIsDeletingProject(false)
    setActiveView('overview')
    setHistoryEntries(projectHistory.list(projectId))
    projectService.getWorkspace(projectId)
      .then((result) => active && setWorkspace(result))
      .catch((loadError: unknown) => active && setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить проект.'))
    return () => { active = false }
  }, [projectId, loadAttempt])

  if (error) return <div className="grid min-h-screen place-items-center p-8"><div className="text-center text-sm text-rose-700"><p>{error}</p><button type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)} className="mt-4 rounded-xl bg-[#29263e] px-4 py-2 font-bold text-white">Повторить</button></div></div>
  if (!workspace) return <WorkspaceSkeleton />

  const selectedTask = workspace.tasks.find((task) => task.id === selectedTaskId)
  const recordHistory = (entry: NewProjectHistoryEntry) => {
    projectHistory.record(entry)
    setHistoryEntries(projectHistory.list(projectId))
  }
  const taskTitle = (taskId: string) => workspace.tasks.find((task) => task.id === taskId)?.title ?? taskId
  const handleTaskSave = async (update: TaskUpdateRequest) => {
    const beforeTask = selectedTask!
    const updatedWorkspace = await projectService.updateTask(projectId, selectedTaskId!, update)
    const afterTask = updatedWorkspace.tasks.find((task) => task.id === selectedTaskId!)!
    const event = taskUpdatedEvent(projectId, beforeTask, afterTask)
    if (Object.keys(event.after ?? {}).length > 0) recordHistory(event)
    setWorkspace(updatedWorkspace)
    setSelectedTaskId(null)
  }
  const handleDependencyCreate = async (request: CreateDependencyRequest) => {
    const previousIds = new Set(workspace.dependencies.map((dependency) => dependency.id))
    const updatedWorkspace = await projectService.createDependency(projectId, request)
    const dependency = updatedWorkspace.dependencies.find((candidate) => !previousIds.has(candidate.id))
      ?? updatedWorkspace.dependencies.find((candidate) => candidate.predecessorTaskId === request.predecessorTaskId && candidate.successorTaskId === request.successorTaskId)!
    recordHistory({ projectId, kind: 'dependency-created', title: 'Добавлена зависимость', description: `${taskTitle(request.predecessorTaskId)} → ${taskTitle(request.successorTaskId)}`, entityType: 'dependency', entityId: dependency.id, after: dependencySnapshot(dependency) })
    setWorkspace(updatedWorkspace)
  }
  const handleDependencyDelete = async (dependencyId: string) => {
    const dependency = workspace.dependencies.find((candidate) => candidate.id === dependencyId)!
    const updatedWorkspace = await projectService.deleteDependency(projectId, dependencyId)
    recordHistory({ projectId, kind: 'dependency-deleted', title: 'Удалена зависимость', description: `${taskTitle(dependency.predecessorTaskId)} → ${taskTitle(dependency.successorTaskId)}`, entityType: 'dependency', entityId: dependencyId, before: dependencySnapshot(dependency) })
    setWorkspace(updatedWorkspace)
  }
  const handleTaskCreate = async (request: TaskCreateRequest) => {
    const previousIds = new Set(workspace.tasks.map((task) => task.id))
    const updatedWorkspace = await projectService.createTask(projectId, request)
    const task = updatedWorkspace.tasks.find((candidate) => !previousIds.has(candidate.id))!
    recordHistory({ projectId, kind: 'task-created', title: 'Создана задача', description: task.title, entityType: 'task', entityId: task.id, after: taskSnapshot(task) })
    setWorkspace(updatedWorkspace)
    setIsCreatingTask(false)
  }
  const handleTaskDelete = async () => {
    if (!selectedTaskId) return
    const task = workspace.tasks.find((candidate) => candidate.id === selectedTaskId)!
    const updatedWorkspace = await projectService.deleteTask(projectId, selectedTaskId)
    recordHistory({ projectId, kind: 'task-deleted', title: 'Удалена задача', description: task.title, entityType: 'task', entityId: task.id, before: taskSnapshot(task) })
    setWorkspace(updatedWorkspace)
    setSelectedTaskId(null)
  }
  const handleSchedulePreview = (sourceTaskId: string) => projectService.previewScheduleShift(projectId, sourceTaskId)
  const handleScheduleApply = async (preview: ScheduleShiftPreview, confirmProjectEndDate: boolean) => {
    const updatedWorkspace = await projectService.applyScheduleShift(projectId, preview, confirmProjectEndDate)
    recordHistory(scheduleShiftEvent(projectId, preview))
    setWorkspace(updatedWorkspace)
  }
  const handleEmployeeCreate = async (name: string): Promise<Employee> => {
    const employee = await projectService.createEmployee(projectId, { name })
    const updatedWorkspace = await projectService.getWorkspace(projectId)
    recordHistory({ projectId, kind: 'employee-created', title: 'Добавлен сотрудник', description: employee.name, entityType: 'employee', entityId: employee.id, after: employeeSnapshot(employee) })
    setWorkspace(updatedWorkspace)
    return employee
  }
  const handleEmployeeUpdate = async (employeeId: string, name: string): Promise<Employee> => {
    const previous = workspace.assignees.find((employee) => employee.id === employeeId)!
    const employee = await projectService.updateEmployee(projectId, employeeId, { name })
    const updatedWorkspace = await projectService.getWorkspace(projectId)
    if (previous.name !== employee.name) recordHistory({ projectId, kind: 'employee-updated', title: 'Изменён сотрудник', description: `${previous.name} → ${employee.name}`, entityType: 'employee', entityId: employee.id, before: { name: previous.name }, after: { name: employee.name } })
    setWorkspace(updatedWorkspace)
    return employee
  }
  const handleEmployeeDelete = async (employeeId: string) => {
    const employee = workspace.assignees.find((candidate) => candidate.id === employeeId)!
    const updatedWorkspace = await deleteEmployeeWithHistory(projectId, employee, () => projectService.deleteEmployee(projectId, employeeId), recordHistory)
    setWorkspace(updatedWorkspace)
  }
  const handleProjectUpdate = async (request: CreateProjectRequest) => {
    const updatedWorkspace = await projectService.updateProject(projectId, request)
    const event = projectUpdatedEvent(projectId, workspace.project, updatedWorkspace.project)
    if (Object.keys(event.after ?? {}).length > 0) recordHistory(event)
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
  const handleHistoryRevert = async (entry: ProjectHistoryEntry) => {
    try {
      setWorkspace(await executeHistoryRevert(entry, workspace, projectService, projectHistory))
    } catch (revertError) {
      setWorkspace(await projectService.getWorkspace(projectId))
      throw revertError
    } finally {
      setHistoryEntries(projectHistory.list(projectId))
    }
  }

  return (
    <div className="min-h-screen">
      <WorkspaceHeader project={workspace.project} activeView={activeView} onViewChange={setActiveView} onOpenNavigation={openMobileSidebar} onEditProject={() => setIsEditingProject(true)} onDeleteProject={() => setIsDeletingProject(true)} />
      <div className="space-y-4 p-4 sm:p-7">
        <ProjectBoundaryWarnings issues={workspace.projectBoundaryIssues} />
        {activeView === 'overview' && <OverviewWorkspaceView workspace={workspace} onTaskSelect={setSelectedTaskId} onTaskCreate={() => setIsCreatingTask(true)} onPreviewScheduleShift={handleSchedulePreview} onApplyScheduleShift={handleScheduleApply} />}
        {activeView === 'dependencies' && <DependenciesView tasks={workspace.tasks} dependencies={workspace.dependencies} assignees={workspace.assignees} impact={workspace.impact} currentIssues={workspace.currentIssues} onTaskSelect={(task) => setSelectedTaskId(task.id)} onCreateDependency={handleDependencyCreate} onDeleteDependency={handleDependencyDelete} onTaskCreate={() => setIsCreatingTask(true)} />}
        {activeView === 'employees' && <EmployeesView employees={workspace.assignees} tasks={workspace.tasks} onCreateEmployee={handleEmployeeCreate} onUpdateEmployee={handleEmployeeUpdate} onDeleteEmployee={handleEmployeeDelete} onTaskSelect={(task) => setSelectedTaskId(task.id)} />}
        {activeView === 'history' && <HistoryView entries={historyEntries} workspace={workspace} onRevert={handleHistoryRevert} />}
      </div>
      {selectedTask && <TaskEditPanel task={selectedTask} assignees={workspace.assignees} tasks={workspace.tasks} dependencies={workspace.dependencies} onClose={() => setSelectedTaskId(null)} onSave={handleTaskSave} onDelete={handleTaskDelete} onCreateDependency={handleDependencyCreate} onDeleteDependency={handleDependencyDelete} onCreateEmployee={handleEmployeeCreate} />}
      {isCreatingTask && <TaskCreatePanel assignees={workspace.assignees} initialStartDate={workspace.project.startDate} onClose={() => setIsCreatingTask(false)} onCreate={handleTaskCreate} onCreateEmployee={handleEmployeeCreate} />}
      {isEditingProject && <ProjectFormPanel title="Редактирование проекта" submitLabel="Сохранить" initialValues={{ name: workspace.project.name, startDate: workspace.project.startDate, targetEndDate: workspace.project.targetEndDate }} onClose={() => setIsEditingProject(false)} onSubmit={handleProjectUpdate} />}
      {isDeletingProject && <ProjectDeleteDialog projectName={workspace.project.name} onClose={() => setIsDeletingProject(false)} onConfirm={handleProjectDelete} />}
    </div>
  )
}
