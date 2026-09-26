import type { ProjectSummary } from '../types/project'

export function getInitialProjectPath(projects: ProjectSummary[]): string | null {
  return projects[0] ? `/projects/${projects[0].id}` : null
}
