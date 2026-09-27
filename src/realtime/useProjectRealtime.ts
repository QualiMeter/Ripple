import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import type { ProjectWorkspace } from '../types/workspace'
import { applyRealtimeEvent } from './applyRealtimeEvent'
import { projectRealtime } from './projectRealtime'
import { setHttpProjectSession } from '../api/backend/session'

export function useProjectRealtime(
  projectId: string,
  workspace: ProjectWorkspace | null,
  setWorkspace: Dispatch<SetStateAction<ProjectWorkspace | null>>,
  loadWorkspace: (projectId: string) => Promise<ProjectWorkspace>,
): void {
  const workspaceRef = useRef(workspace)
  const eventQueue = useRef(Promise.resolve())

  useEffect(() => { workspaceRef.current = workspace }, [workspace])

  useEffect(() => {
    if (!workspace || workspace.project.id !== projectId) return
    let active = true

    const unsubscribeEvent = projectRealtime.onProjectChanged((event) => {
      if (event.projectId !== projectId) return
      eventQueue.current = eventQueue.current.then(async () => {
        const current = workspaceRef.current
        if (!active || !current || current.project.id !== projectId) return
        const next = await applyRealtimeEvent(current, event)
        if (!active || workspaceRef.current?.project.id !== projectId) return
        workspaceRef.current = next
        setHttpProjectSession(projectId, {
          sourceTaskId: next.impact.sourceTaskId,
          affectedTaskIds: next.impact.affectedTaskIds,
          lastChange: next.impact.lastChange,
          analysis: next.impact.reasons,
          previousProjectEndDate: next.impact.previousProjectEndDate,
        })
        setWorkspace(next)
      })
    })

    const unsubscribeResync = projectRealtime.onResyncRequired((reconnectedProjectId) => {
      if (!active || reconnectedProjectId !== projectId) return
      void loadWorkspace(projectId).then((next) => {
        if (!active) return
        workspaceRef.current = next
        setWorkspace(next)
      }).catch(() => undefined)
    })

    void projectRealtime.joinProject(projectId)
    return () => {
      active = false
      unsubscribeEvent()
      unsubscribeResync()
      void projectRealtime.leaveProject(projectId)
    }
  }, [projectId, Boolean(workspace), loadWorkspace, setWorkspace])
}
