import type { ProjectTask } from '../types/task'

export type TaskVisualState = 'affected' | 'risk' | 'completed' | 'in-progress' | 'not-started'

export interface TaskVisualStateOptions {
  affected?: boolean
}

export function getTaskVisualState(
  task: ProjectTask,
  { affected = false }: TaskVisualStateOptions = {},
): TaskVisualState {
  if (affected) return 'affected'
  if (task.riskState === 'at-risk' || task.status === 'delayed') return 'risk'
  if (task.status === 'completed') return 'completed'
  if (task.status === 'in-progress') return 'in-progress'
  return 'not-started'
}

export const taskVisualStateClasses: Record<TaskVisualState, string> = {
  affected: 'bg-[#e7774d]',
  risk: 'bg-[#df5e64]',
  completed: 'bg-[#55ad89]',
  'in-progress': 'bg-[#7768ed]',
  'not-started': 'bg-[#aaa5b6]',
}
