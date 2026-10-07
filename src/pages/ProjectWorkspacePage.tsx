import { useCallback, useEffect, useRef, useState } from 'react'
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
import { isServerHistoryEntry, type HistoryEntry, type NewProjectHistoryEntry } from '../services/history/historyTypes'
import { dependencySnapshot, employeeSnapshot, projectUpdatedEvent, scheduleShiftEvent, taskSnapshot, taskUpdatedEvent } from '../services/history/historyEvents'
import { executeHistoryRevert } from '../services/history/historyRevert'
import { deleteEmployeeWithHistory } from '../services/history/employeeHistory'
import { useProjectRealtime } from '../realtime/useProjectRealtime'
import { isHttpApiMode } from '../config/api'
import { historyApi, isHistoryRealtimeEntity, serverHistoryEntryFromRealtimeData } from '../api/history.api'
import { serverHistorySession } from '../services/history/serverHistorySession'
import { projectRealtime } from '../realtime/projectRealtime'
import { undoServerHistoryAndSynchronize } from '../services/history/serverHistoryActions'
import { beginHistoryVisit, shouldLoadHistoryForVisit, shouldRefreshHistoryAfterMutation } from '../services/history/historySyncPolicy'
import { downloadProjectDiagnostics } from '../services/projectDiagnostics'
import { applyTimelineDraftPreview, buildTimelineDraftPreview, type TimelineDraftApplyMode, type TimelineDraftPreview } from '../services/timelineDraft'
import { downloadProjectExport } from '../services/projectTransfer'
import { applyTaskReassignment, type TaskReassignmentPreview } from '../services/taskReassignment'
import { AiPlanPanel } from '../components/ai/AiPlanPanel'
import type { AiPlan } from '../api/ai.api'

function WorkspaceSkeleton() {
  return <div className="p-7" role="status" aria-label="Загрузка проекта"><span className="sr-only">Загрузка проекта…</span><div className="h-8 w-64 animate-pulse rounded-lg bg-[#e5e3ea]" /><div className="mt-8 grid grid-cols-4 gap-3">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-32 animate-pulse rounded-2xl bg-white" />)}</div></div>
}

export function ProjectWorkspacePage() {
  const { openMobileSidebar, refreshProjects, syncProjectNavigation, removeProjectNavigation } = useOutletContext<AppShellContext>()
  const navigate = useNavigate()
  const { projectId = '' } = useParams()
  const [workspace, setWorkspace] = useState<ProjectWorkspace | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [isCreatingTask, setIsCreatingTask] = useState(false)
  const [activeView, setActiveView] = useState<WorkspaceView>('overview')
  const [isEditingProject, setIsEditingProject] = useState(false)
  const [isDeletingProject, setIsDeletingProject] = useState(false)
  const [pendingProjectDeletion, setPendingProjectDeletion] = useState(false)
  const [projectDeletionSeconds, setProjectDeletionSeconds] = useState(5)
  const projectDeletionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const projectDeletionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([])
  const [historyLoaded, setHistoryLoaded] = useState(!isHttpApiMode)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [requestedShiftSourceId, setRequestedShiftSourceId] = useState<string | null>(null)
  const [timelineDraft, setTimelineDraft] = useState<TimelineDraftPreview | null>(null)
  const [aiEditOpen, setAiEditOpen] = useState(false)

  useEffect(() => {
    let active = true
    setWorkspace(null)
    setError(null)
    setSelectedTaskId(null)
    setIsCreatingTask(false)
    setIsEditingProject(false)
    setIsDeletingProject(false)
    setPendingProjectDeletion(false)
    setProjectDeletionSeconds(5)
    setRequestedShiftSourceId(null)
    setTimelineDraft(null)
    setAiEditOpen(false)
    setActiveView('overview')
    const cachedServerHistory = isHttpApiMode ? serverHistorySession.get(projectId) : undefined
    const historyVisit = beginHistoryVisit(isHttpApiMode, cachedServerHistory, isHttpApiMode ? [] : projectHistory.list(projectId))
    setHistoryEntries(historyVisit.entries)
    setHistoryLoaded(historyVisit.loaded)
    setHistoryLoading(false)
    setHistoryError(null)
    projectService.getWorkspace(projectId)
      .then((result) => active && setWorkspace(result))
      .catch((loadError: unknown) => active && setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить проект.'))
    return () => { active = false }
  }, [projectId, loadAttempt])

  const handleRealtimeProjectDeleted = useCallback((deletedProjectId: string) => {
    if (deletedProjectId !== projectId) return
    setSelectedTaskId(null)
    setIsCreatingTask(false)
    setIsEditingProject(false)
    setIsDeletingProject(false)
    setPendingProjectDeletion(false)
    setProjectDeletionSeconds(5)
    setWorkspace(null)
    removeProjectNavigation(deletedProjectId)
    navigate('/', { replace: true })
  }, [navigate, projectId, removeProjectNavigation])

  useProjectRealtime(projectId, workspace, setWorkspace, projectService.getWorkspace, handleRealtimeProjectDeleted)

  useEffect(() => {
    if (!shouldLoadHistoryForVisit(isHttpApiMode, activeView, historyLoaded)) return
    let active = true
    setHistoryLoading(true)
    setHistoryError(null)
    serverHistorySession.refresh(projectId, historyApi)
      .then((entries) => {
        if (!active) return
        setHistoryEntries(entries)
        setHistoryLoaded(true)
      })
      .catch((historyLoadError: unknown) => active && setHistoryError(historyLoadError instanceof Error ? historyLoadError.message : 'Не удалось загрузить историю проекта.'))
      .finally(() => active && setHistoryLoading(false))
    return () => { active = false }
  }, [activeView, historyLoaded, projectId])

  useEffect(() => {
    const unsubscribeEvent = projectRealtime.onProjectChanged((event) => {
      if (!isHttpApiMode || !historyLoaded || event.projectId !== projectId) return
      if (!isHistoryRealtimeEntity(event.entity)) return
      const entry = serverHistoryEntryFromRealtimeData(projectId, event.data)
      if (event.action.toLowerCase() === 'undone' && event.entityId) serverHistorySession.markUndone(projectId, event.entityId)
      if (entry) {
        setHistoryEntries(serverHistorySession.upsert(projectId, event.action.toLowerCase() === 'undone' ? { ...entry, canUndo: false, isCurrent: false, undone: true } : entry))
        return
      }
      void serverHistorySession.refresh(projectId, historyApi).then(setHistoryEntries).catch(() => undefined)
    })
    const unsubscribeResync = projectRealtime.onResyncRequired((reconnectedProjectId) => {
      if (!isHttpApiMode || !historyLoaded || reconnectedProjectId !== projectId) return
      void serverHistorySession.refresh(projectId, historyApi).then(setHistoryEntries).catch(() => undefined)
    })
    return () => { unsubscribeEvent(); unsubscribeResync() }
  }, [historyLoaded, projectId])

  useEffect(() => {
    if (!workspace) return
    syncProjectNavigation({
      id: workspace.project.id,
      creatorId: workspace.project.creatorId,
      name: workspace.project.name,
      description: workspace.project.description,
      startDate: workspace.project.startDate,
      targetEndDate: workspace.project.targetEndDate,
      taskCount: workspace.tasks.length,
      employeeCount: workspace.assignees.length,
    })
  }, [workspace, syncProjectNavigation])

  if (error) return <div className="grid min-h-screen place-items-center p-8"><div className="text-center text-sm text-rose-700"><p>{error}</p><button type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)} className="mt-4 rounded-xl bg-[#29263e] px-4 py-2 font-bold text-white">Повторить</button></div></div>
  if (!workspace) return <WorkspaceSkeleton />

  const selectedTask = workspace.tasks.find((task) => task.id === selectedTaskId)
  const recordHistory = (entry: NewProjectHistoryEntry) => {
    if (isHttpApiMode) {
      if (shouldRefreshHistoryAfterMutation(isHttpApiMode, historyLoaded, projectRealtime.isProjectJoined(projectId))) {
        void serverHistorySession.refresh(projectId, historyApi).then(setHistoryEntries).catch(() => undefined)
      }
      return
    }
    projectHistory.record(entry)
    setHistoryEntries(projectHistory.list(projectId))
  }
  const taskTitle = (taskId: string) => workspace.tasks.find((task) => task.id === taskId)?.title ?? taskId
  const updateTask = async (taskId: string, update: TaskUpdateRequest) => {
    const beforeTask = workspace.tasks.find((task) => task.id === taskId)
    if (!beforeTask) throw new Error('Задача не найдена.')
    const updatedWorkspace = await projectService.updateTask(workspace, taskId, update)
    const afterTask = updatedWorkspace.tasks.find((task) => task.id === taskId)!
    const event = taskUpdatedEvent(projectId, beforeTask, afterTask)
    if (Object.keys(event.after ?? {}).length > 0) recordHistory(event)
    setWorkspace(updatedWorkspace)
  }
  const handleTaskSave = async (update: TaskUpdateRequest) => {
    await updateTask(selectedTaskId!, update)
    setSelectedTaskId(null)
  }
  const handleDependencyCreate = async (request: CreateDependencyRequest) => {
    const previousIds = new Set(workspace.dependencies.map((dependency) => dependency.id))
    const updatedWorkspace = await projectService.createDependency(workspace, request)
    const dependency = updatedWorkspace.dependencies.find((candidate) => !previousIds.has(candidate.id))
      ?? updatedWorkspace.dependencies.find((candidate) => candidate.predecessorTaskId === request.predecessorTaskId && candidate.successorTaskId === request.successorTaskId)!
    recordHistory({ projectId, kind: 'dependency-created', title: 'Добавлена зависимость', description: `${taskTitle(request.predecessorTaskId)} → ${taskTitle(request.successorTaskId)}`, entityType: 'dependency', entityId: dependency.id, after: dependencySnapshot(dependency) })
    setWorkspace(updatedWorkspace)
  }
  const handleDependencyDelete = async (dependencyId: string) => {
    const dependency = workspace.dependencies.find((candidate) => candidate.id === dependencyId)!
    const updatedWorkspace = await projectService.deleteDependency(workspace, dependencyId)
    recordHistory({ projectId, kind: 'dependency-deleted', title: 'Удалена зависимость', description: `${taskTitle(dependency.predecessorTaskId)} → ${taskTitle(dependency.successorTaskId)}`, entityType: 'dependency', entityId: dependencyId, before: dependencySnapshot(dependency) })
    setWorkspace(updatedWorkspace)
  }
  const handleTaskCreate = async (request: TaskCreateRequest) => {
    const previousIds = new Set(workspace.tasks.map((task) => task.id))
    const updatedWorkspace = await projectService.createTask(workspace, request)
    const task = updatedWorkspace.tasks.find((candidate) => !previousIds.has(candidate.id))!
    recordHistory({ projectId, kind: 'task-created', title: 'Создана задача', description: task.title, entityType: 'task', entityId: task.id, after: taskSnapshot(task) })
    setWorkspace(updatedWorkspace)
    setIsCreatingTask(false)
  }
  const handleTaskDelete = async () => {
    if (!selectedTaskId) return
    const task = workspace.tasks.find((candidate) => candidate.id === selectedTaskId)!
    const updatedWorkspace = await projectService.deleteTask(workspace, selectedTaskId)
    recordHistory({ projectId, kind: 'task-deleted', title: 'Удалена задача', description: task.title, entityType: 'task', entityId: task.id, before: taskSnapshot(task) })
    setWorkspace(updatedWorkspace)
    setSelectedTaskId(null)
  }
  const handleSchedulePreview = (sourceTaskId: string) => projectService.previewScheduleShift(workspace, sourceTaskId)
  const handleTaskAnalysisShift = (sourceTaskId: string) => {
    setSelectedTaskId(null)
    setActiveView('overview')
    setRequestedShiftSourceId(sourceTaskId)
  }
  const handleScheduleApply = async (preview: ScheduleShiftPreview, confirmProjectEndDate: boolean) => {
    const updatedWorkspace = await projectService.applyScheduleShift(workspace, preview, confirmProjectEndDate)
    recordHistory(scheduleShiftEvent(projectId, preview))
    setWorkspace(updatedWorkspace)
  }
  const handleTimelineDraft = (taskId: string, update: TaskUpdateRequest) => {
    setTimelineDraft(buildTimelineDraftPreview(workspace, taskId, update))
  }
  const handleTimelineDraftApply = async (mode: TimelineDraftApplyMode) => {
    if (!timelineDraft) return
    const beforeTask = workspace.tasks.find((task) => task.id === timelineDraft.sourceTaskId)
    if (!beforeTask) throw new Error('Задача не найдена.')
    try {
      const result = await applyTimelineDraftPreview(workspace, timelineDraft, projectService, mode)
      const afterTask = result.sourceWorkspace.tasks.find((task) => task.id === timelineDraft.sourceTaskId)!
      const event = taskUpdatedEvent(projectId, beforeTask, afterTask)
      if (Object.keys(event.after ?? {}).length > 0) recordHistory(event)
      if (result.appliedSchedulePreview) recordHistory(scheduleShiftEvent(projectId, result.appliedSchedulePreview))
      setWorkspace(result.workspace)
      setTimelineDraft(null)
    } catch (draftError) {
      throw draftError
    }
  }
  const handleTaskReassignment = async (preview: TaskReassignmentPreview) => {
    const updatedWorkspace = await applyTaskReassignment(workspace, preview, projectService)
    const beforeTask = workspace.tasks.find((task) => task.id === preview.taskId)!
    const afterTask = updatedWorkspace.tasks.find((task) => task.id === preview.taskId)!
    const event = taskUpdatedEvent(projectId, beforeTask, afterTask)
    if (Object.keys(event.after ?? {}).length > 0) recordHistory(event)
    setWorkspace(updatedWorkspace)
    setTimelineDraft(null)
  }
  const handleEmployeeCreate = async (name: string): Promise<Employee> => {
    const { entity: employee, workspace: updatedWorkspace } = await projectService.createEmployee(workspace, { name })
    recordHistory({ projectId, kind: 'employee-created', title: 'Добавлен сотрудник', description: employee.name, entityType: 'employee', entityId: employee.id, after: employeeSnapshot(employee) })
    setWorkspace(updatedWorkspace)
    return employee
  }
  const handleEmployeeUpdate = async (employeeId: string, name: string): Promise<Employee> => {
    const previous = workspace.assignees.find((employee) => employee.id === employeeId)!
    const { entity: employee, workspace: updatedWorkspace } = await projectService.updateEmployee(workspace, employeeId, { name })
    if (previous.name !== employee.name) recordHistory({ projectId, kind: 'employee-updated', title: 'Изменён сотрудник', description: `${previous.name} → ${employee.name}`, entityType: 'employee', entityId: employee.id, before: { name: previous.name }, after: { name: employee.name } })
    setWorkspace(updatedWorkspace)
    return employee
  }
  const handleEmployeeDelete = async (employeeId: string) => {
    const employee = workspace.assignees.find((candidate) => candidate.id === employeeId)!
    const updatedWorkspace = await deleteEmployeeWithHistory(projectId, employee, () => projectService.deleteEmployee(workspace, employeeId), recordHistory)
    setWorkspace(updatedWorkspace)
  }
  const handleProjectUpdate = async (request: CreateProjectRequest) => {
    const updatedWorkspace = await projectService.updateProject(workspace, request)
    const event = projectUpdatedEvent(projectId, workspace.project, updatedWorkspace.project)
    if (Object.keys(event.after ?? {}).length > 0) recordHistory(event)
    setWorkspace(updatedWorkspace)
    setIsEditingProject(false)
  }
  const handleProjectDelete = async () => {
    if (projectDeletionTimerRef.current) clearTimeout(projectDeletionTimerRef.current)
    if (projectDeletionIntervalRef.current) clearInterval(projectDeletionIntervalRef.current)

    setIsDeletingProject(false)
    setProjectDeletionSeconds(5)
    setPendingProjectDeletion(true)

    projectDeletionIntervalRef.current = setInterval(() => {
      setProjectDeletionSeconds((seconds) => Math.max(0, seconds - 1))
    }, 1000)

    projectDeletionTimerRef.current = setTimeout(async () => {
      if (projectDeletionIntervalRef.current) {
        clearInterval(projectDeletionIntervalRef.current)
        projectDeletionIntervalRef.current = null
      }

      try {
        await deleteProjectAndLeave(projectId, {
          deleteProject: projectService.deleteProject,
          closeDialog: () => undefined,
          refreshProjects,
          navigateHome: () => navigate('/', { replace: true }),
        })
      } catch (error) {
        setPendingProjectDeletion(false)
        setProjectDeletionSeconds(5)
        setError(error instanceof Error ? error.message : 'Не удалось удалить проект.')
      } finally {
        projectDeletionTimerRef.current = null
      }
    }, 5000)
  }

  const cancelProjectDeletion = useCallback(() => {
    if (projectDeletionTimerRef.current) {
      clearTimeout(projectDeletionTimerRef.current)
      projectDeletionTimerRef.current = null
    }
    if (projectDeletionIntervalRef.current) {
      clearInterval(projectDeletionIntervalRef.current)
      projectDeletionIntervalRef.current = null
    }
    setPendingProjectDeletion(false)
    setProjectDeletionSeconds(5)
  }, [])

  useEffect(() => {
    return () => {
      if (projectDeletionTimerRef.current) clearTimeout(projectDeletionTimerRef.current)
      if (projectDeletionIntervalRef.current) clearInterval(projectDeletionIntervalRef.current)
    }
  }, [])
  const handleProjectDiagnosticsDownload = () => downloadProjectDiagnostics(projectId, workspace.project.name).then(() => undefined)
  const handleAiProjectConfirmed = async (_plan: AiPlan) => {
    const refreshed = await projectService.getWorkspace(projectId)
    setWorkspace(refreshed)
    if (isHttpApiMode) {
      const entries = await serverHistorySession.refresh(projectId, historyApi)
      setHistoryEntries(entries)
      setHistoryLoaded(true)
    }
    await refreshProjects()
    setAiEditOpen(false)
  }
  const handleProjectExport = () => downloadProjectExport(projectId, workspace.project.name)
  const handleHistoryRevert = async (entry: HistoryEntry) => {
    if (isHttpApiMode) {
      if (!isServerHistoryEntry(entry)) throw new Error('Локальная запись не относится к серверной истории.')
      try {
        const synchronized = await undoServerHistoryAndSynchronize(projectId, entry.id, historyApi, serverHistorySession, projectService.getWorkspace)
        setHistoryEntries(synchronized.entries)
        if (synchronized.workspace) setWorkspace(synchronized.workspace)
      } catch (undoError) {
        setHistoryEntries(serverHistorySession.get(projectId) ?? [])
        throw undoError
      }
      return
    }
    if (isServerHistoryEntry(entry)) return
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
      <WorkspaceHeader project={workspace.project} activeView={activeView} onViewChange={setActiveView} onOpenNavigation={openMobileSidebar} onEditProject={() => setIsEditingProject(true)} onDeleteProject={() => setIsDeletingProject(true)} onDownloadDiagnostics={isHttpApiMode ? handleProjectDiagnosticsDownload : undefined} onExportProject={isHttpApiMode ? handleProjectExport : undefined} onAiEditProject={isHttpApiMode ? () => setAiEditOpen(true) : undefined} />
      <div className="space-y-4 p-4 sm:p-7">
        <ProjectBoundaryWarnings issues={workspace.projectBoundaryIssues} />
        {activeView === 'overview' && <OverviewWorkspaceView workspace={workspace} timelineDraft={timelineDraft} onTaskSelect={setSelectedTaskId} onTaskCreate={() => setIsCreatingTask(true)} onTaskDraft={handleTimelineDraft} onApplyTimelineDraft={handleTimelineDraftApply} onCancelTimelineDraft={() => setTimelineDraft(null)} onViewWorkload={() => setActiveView('employees')} onApplyTaskReassignment={handleTaskReassignment} onCreateDependency={handleDependencyCreate} onPreviewScheduleShift={handleSchedulePreview} onApplyScheduleShift={handleScheduleApply} requestedPreviewSourceId={requestedShiftSourceId} onRequestedPreviewHandled={() => setRequestedShiftSourceId(null)} />}
        {activeView === 'dependencies' && <DependenciesView tasks={workspace.tasks} dependencies={workspace.dependencies} assignees={workspace.assignees} impact={workspace.impact} currentIssues={workspace.currentIssues} onTaskSelect={(task) => setSelectedTaskId(task.id)} onCreateDependency={handleDependencyCreate} onDeleteDependency={handleDependencyDelete} onTaskCreate={() => setIsCreatingTask(true)} />}
        {activeView === 'employees' && <EmployeesView employees={workspace.assignees} tasks={workspace.tasks} historyMode={isHttpApiMode ? 'server' : 'local'} onCreateEmployee={handleEmployeeCreate} onUpdateEmployee={handleEmployeeUpdate} onDeleteEmployee={handleEmployeeDelete} onTaskSelect={(task) => setSelectedTaskId(task.id)} />}
        {activeView === 'history' && <HistoryView entries={historyEntries} workspace={workspace} onRevert={handleHistoryRevert} source={isHttpApiMode ? 'server' : 'local'} loading={historyLoading} loadError={historyError} />}
      </div>
      {selectedTask && <TaskEditPanel task={selectedTask} assignees={workspace.assignees} tasks={workspace.tasks} dependencies={workspace.dependencies} historyMode={isHttpApiMode ? 'server' : 'local'} onClose={() => setSelectedTaskId(null)} onSave={handleTaskSave} onDelete={handleTaskDelete} onCreateDependency={handleDependencyCreate} onDeleteDependency={handleDependencyDelete} onCreateEmployee={handleEmployeeCreate} onLoadAnalysis={projectService.getTaskAnalysis} onOpenTask={setSelectedTaskId} onRequestScheduleShift={handleTaskAnalysisShift} />}
      {isCreatingTask && <TaskCreatePanel assignees={workspace.assignees} initialStartDate={workspace.project.startDate} onClose={() => setIsCreatingTask(false)} onCreate={handleTaskCreate} onCreateEmployee={handleEmployeeCreate} />}
      {isEditingProject && <ProjectFormPanel title="Редактирование проекта" submitLabel="Сохранить" initialValues={{ name: workspace.project.name, startDate: workspace.project.startDate, targetEndDate: workspace.project.targetEndDate }} onClose={() => setIsEditingProject(false)} onSubmit={handleProjectUpdate} />}
      {isDeletingProject && <ProjectDeleteDialog projectName={workspace.project.name} onClose={() => setIsDeletingProject(false)} onConfirm={handleProjectDelete} />}
      {pendingProjectDeletion && <div className="fixed bottom-5 left-1/2 z-[90] w-[min(520px,calc(100vw-32px))] -translate-x-1/2" role="status" aria-live="polite">
        <div className="flex items-center gap-3 rounded-2xl border border-[#ded9f8] bg-white px-4 py-3 shadow-[0_18px_50px_rgba(32,29,49,.22)]">
          <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-rose-50 text-rose-600" aria-label={`До удаления осталось ${projectDeletionSeconds} секунд`}>
            <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 40 40" aria-hidden="true">
              <circle cx="20" cy="20" r="17" fill="none" stroke="currentColor" strokeWidth="2.5" opacity="0.14" />
              <circle
                cx="20"
                cy="20"
                r="17"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray="106.81"
                strokeDashoffset={`${106.81 * (1 - projectDeletionSeconds / 5)}`}
                className="transition-[stroke-dashoffset] duration-1000 linear"
              />
            </svg>
            <span className="relative text-xs font-bold leading-none">{projectDeletionSeconds}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-[#302c40]">Проект удаляется</p>
            <p className="mt-0.5 text-[11px] leading-4 text-[#777181]">Удаление можно отменить в течение 5 секунд.</p>
          </div>
          <button type="button" onClick={cancelProjectDeletion} className="shrink-0 rounded-xl bg-[#6757df] px-3 py-2 text-xs font-bold text-white hover:bg-[#5848ce]">Отменить</button>
        </div>
      </div>}
      {aiEditOpen && <AiPlanPanel mode="update" projectId={projectId} projectName={workspace.project.name} employees={workspace.assignees} onClose={() => setAiEditOpen(false)} onConfirmed={handleAiProjectConfirmed} />}
    </div>
  )
}
