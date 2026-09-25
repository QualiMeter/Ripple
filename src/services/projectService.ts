import type { ProjectWorkspace } from '../types/workspace'
import { projectsApi } from '../api/projects.api'

export interface ProjectService {
  getWorkspace(projectId: string): Promise<ProjectWorkspace>
}

export const projectService: ProjectService = {
  getWorkspace: (projectId) => projectsApi.getWorkspace(projectId),
}
