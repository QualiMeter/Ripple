export interface ProjectDeletionFlow {
  deleteProject: (projectId: string) => Promise<void>
  closeDialog: () => void
  refreshProjects: () => Promise<void>
  navigateHome: () => void
}

export async function deleteProjectAndLeave(projectId: string, flow: ProjectDeletionFlow): Promise<void> {
  await flow.deleteProject(projectId)
  flow.closeDialog()
  await flow.refreshProjects()
  flow.navigateHome()
}
