export function getInitialProjectPath(projects: Array<{ id: string }>): string | null {
  return projects[0] ? `/projects/${projects[0].id}` : null
}
