export function calculateProjectProgress(completedTaskCount: number, taskCount: number): number {
  if (taskCount <= 0) return 0
  const completed = Math.min(taskCount, Math.max(0, completedTaskCount))
  return Math.round((completed / taskCount) * 100)
}
