import type { ProjectWorkspace } from '../types/workspace'
import { projectsApi } from '../api/projects.api'
import { tasksApi } from '../api/tasks.api'
import type { TaskUpdateRequest } from '../types/task'

export interface ProjectService {
  getWorkspace(projectId: string): Promise<ProjectWorkspace>
  updateTask(projectId: string, taskId: string, update: TaskUpdateRequest): Promise<ProjectWorkspace>
}

export const projectService: ProjectService = {
  getWorkspace: (projectId) => projectsApi.getWorkspace(projectId),
  async updateTask(projectId, taskId, update) {
    await tasksApi.updateTask(taskId, update)
    return projectsApi.getWorkspace(projectId)
  },
}
