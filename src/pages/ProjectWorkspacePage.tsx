import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ImpactPanel } from '../components/workspace/ImpactPanel'
import { MetricCards } from '../components/workspace/MetricCards'
import { TaskList } from '../components/workspace/TaskList'
import { TaskEditPanel } from '../components/workspace/TaskEditPanel'
import { Timeline } from '../components/workspace/Timeline'
import { WorkspaceHeader } from '../components/workspace/WorkspaceHeader'
import { projectService } from '../services/projectService'
import type { ProjectWorkspace } from '../types/workspace'
import type { TaskUpdateRequest } from '../types/task'

function WorkspaceSkeleton() {
  return <div className="p-7" role="status" aria-label="Загрузка проекта"><span className="sr-only">Загрузка проекта…</span><div className="h-8 w-64 animate-pulse rounded-lg bg-[#e5e3ea]" /><div className="mt-8 grid grid-cols-4 gap-3">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-32 animate-pulse rounded-2xl bg-white" />)}</div></div>
}

export function ProjectWorkspacePage() {
  const { projectId = 'aurora-launch' } = useParams()
  const [workspace, setWorkspace] = useState<ProjectWorkspace | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    projectService.getWorkspace(projectId)
      .then((result) => active && setWorkspace(result))
      .catch(() => active && setError('Не удалось загрузить проект. Попробуйте ещё раз.'))
    return () => { active = false }
  }, [projectId])

  if (error) return <div className="grid min-h-screen place-items-center p-8 text-sm text-rose-700">{error}</div>
  if (!workspace) return <WorkspaceSkeleton />

  const selectedTask = workspace.tasks.find((task) => task.id === selectedTaskId)
  const handleTaskSave = async (update: TaskUpdateRequest) => {
    const updatedWorkspace = await projectService.updateTask(projectId, selectedTaskId!, update)
    setWorkspace(updatedWorkspace)
    setSelectedTaskId(null)
  }

  return (
    <div className="min-h-screen">
      <WorkspaceHeader project={workspace.project} impact={workspace.impact} />
      <div className="space-y-4 p-4 sm:p-7">
        <MetricCards workspace={workspace} />
        <div className="grid items-start gap-4 2xl:grid-cols-[minmax(0,1fr)_330px]">
          <div className="min-w-0 space-y-4">
            <Timeline project={workspace.project} tasks={workspace.tasks} assignees={workspace.assignees} impact={workspace.impact} onTaskSelect={(task) => setSelectedTaskId(task.id)} />
            <TaskList tasks={workspace.tasks} assignees={workspace.assignees} affectedTaskIds={workspace.impact.affectedTaskIds} onTaskSelect={(task) => setSelectedTaskId(task.id)} />
          </div>
          <ImpactPanel workspace={workspace} />
        </div>
      </div>
      {selectedTask && <TaskEditPanel task={selectedTask} assignees={workspace.assignees} onClose={() => setSelectedTaskId(null)} onSave={handleTaskSave} />}
    </div>
  )
}
