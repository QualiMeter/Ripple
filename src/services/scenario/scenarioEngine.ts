import type { ProjectTask } from '../../types/task'
import type { ProjectWorkspace } from '../../types/workspace'
import { addCalendarDays, calendarDaysBetween, formatFullDate } from '../../utils/date'
import { findDownstreamTaskIds } from '../dependencyGraph'
import { findDependencyDateConflicts } from '../scheduleRules'
import { patchProject, rebuildWorkspaceDerivedState, upsertTask } from '../workspaceState'
import type { ProjectScenarioDraft, ScenarioMutationPort } from './scenarioTypes'

function conflictKey(conflict: ReturnType<typeof findDependencyDateConflicts>[number]): string {
  return `${conflict.dependency.predecessorTaskId}:${conflict.dependency.successorTaskId}:${conflict.dependency.type}`
}

function requireTask(workspace: ProjectWorkspace, taskId: string): ProjectTask {
  const task = workspace.tasks.find((candidate) => candidate.id === taskId)
  if (!task) throw new Error('Задача не найдена.')
  if (task.status === 'completed') throw new Error('Завершённую задачу нельзя изменять в сценарии.')
  return task
}

function buildTaskScenario(
  workspace: ProjectWorkspace,
  task: ProjectTask,
  update: { startDate?: string; endDate?: string },
  type: 'task-delay' | 'task-start-shift',
  description: string,
): ProjectScenarioDraft {
  const nextTask = { ...task, ...update }
  const graphAffected = [task.id, ...findDownstreamTaskIds(task.id, workspace.dependencies)]
  let scenarioWorkspace = rebuildWorkspaceDerivedState(upsertTask(workspace, nextTask), {
    sourceTaskId: task.id,
    affectedTaskIds: graphAffected,
    previousProjectedEndDate: workspace.impact.projectedProjectEndDate,
    lastChange: {
      kind: 'task-updated', taskId: task.id, taskTitle: task.title,
      changes: Object.entries(update).map(([field, value]) => ({ field: field as 'startDate' | 'endDate', previousValue: task[field as 'startDate' | 'endDate'], nextValue: value })),
    },
  })
  const beforeConflicts = new Map(findDependencyDateConflicts(workspace.tasks, workspace.dependencies).map((conflict) => [conflictKey(conflict), conflict]))
  const newConflictTasks = findDependencyDateConflicts(scenarioWorkspace.tasks, scenarioWorkspace.dependencies)
    .filter((conflict) => !beforeConflicts.has(conflictKey(conflict)))
    .map((conflict) => conflict.successor.id)
  const changedDerivedTasks = workspace.tasks.filter((candidate) => (
    workspace.impact.criticalTaskIds.includes(candidate.id) !== scenarioWorkspace.impact.criticalTaskIds.includes(candidate.id)
    || workspace.impact.slackDaysByTaskId[candidate.id] !== scenarioWorkspace.impact.slackDaysByTaskId[candidate.id]
  )).map((candidate) => candidate.id)
  const affectedTaskIds = [...new Set([...graphAffected, ...newConflictTasks, ...changedDerivedTasks])]
  scenarioWorkspace = rebuildWorkspaceDerivedState(scenarioWorkspace, {
    sourceTaskId: task.id,
    affectedTaskIds,
    previousProjectedEndDate: workspace.impact.projectedProjectEndDate,
    lastChange: scenarioWorkspace.impact.lastChange,
  })
  return {
    type, sourceTaskId: task.id, description, scenarioWorkspace, affectedTaskIds,
    taskUpdate: update, baseTaskDates: { startDate: task.startDate, endDate: task.endDate },
    baseTargetEndDate: workspace.project.targetEndDate,
  }
}

export function buildTaskDelayScenario(workspace: ProjectWorkspace, taskId: string, delayDays: number): ProjectScenarioDraft {
  const task = requireTask(workspace, taskId)
  if (!Number.isInteger(delayDays) || delayDays < 1) throw new Error('Укажите задержку не менее одного календарного дня.')
  return buildTaskScenario(workspace, task, { endDate: addCalendarDays(task.endDate, delayDays) }, 'task-delay', `«${task.title}» займёт на ${delayDays} дн. больше`)
}

export function buildTaskStartScenario(workspace: ProjectWorkspace, taskId: string, newStartDate: string): ProjectScenarioDraft {
  const task = requireTask(workspace, taskId)
  if (!newStartDate || newStartDate <= task.startDate) throw new Error('Новая дата начала должна быть позже текущей.')
  const durationOffset = calendarDaysBetween(task.startDate, task.endDate)
  const newEndDate = addCalendarDays(newStartDate, durationOffset)
  return buildTaskScenario(workspace, task, { startDate: newStartDate, endDate: newEndDate }, 'task-start-shift', `«${task.title}» начнётся ${formatFullDate(newStartDate)}`)
}

export function buildProjectDeadlineScenario(workspace: ProjectWorkspace, targetEndDate: string): ProjectScenarioDraft {
  if (!targetEndDate || targetEndDate < workspace.project.startDate) throw new Error('Срок проекта не может быть раньше даты начала.')
  let scenarioWorkspace = rebuildWorkspaceDerivedState(patchProject(workspace, { targetEndDate }), {
    affectedTaskIds: workspace.tasks.filter((task) => task.endDate > targetEndDate).map((task) => task.id),
    previousProjectedEndDate: workspace.impact.projectedProjectEndDate,
  })
  const affectedTaskIds = scenarioWorkspace.tasks.filter((task) => (
    task.endDate > targetEndDate
    || workspace.impact.criticalTaskIds.includes(task.id) !== scenarioWorkspace.impact.criticalTaskIds.includes(task.id)
    || workspace.impact.slackDaysByTaskId[task.id] !== scenarioWorkspace.impact.slackDaysByTaskId[task.id]
  )).map((task) => task.id)
  scenarioWorkspace = rebuildWorkspaceDerivedState(scenarioWorkspace, {
    affectedTaskIds,
    previousProjectedEndDate: workspace.impact.projectedProjectEndDate,
  })
  return {
    type: 'project-deadline', description: `Срок проекта изменится на ${formatFullDate(targetEndDate)}`,
    scenarioWorkspace, affectedTaskIds, projectTargetEndDate: targetEndDate,
    baseTargetEndDate: workspace.project.targetEndDate,
  }
}

export async function applyProjectScenario(workspace: ProjectWorkspace, draft: ProjectScenarioDraft, port: ScenarioMutationPort): Promise<ProjectWorkspace> {
  if (workspace.project.id !== draft.scenarioWorkspace.project.id) throw new Error('Сценарий относится к другому проекту.')
  if (draft.type === 'project-deadline') {
    if (!draft.projectTargetEndDate) throw new Error('В сценарии не указана новая дата проекта.')
    if (workspace.project.targetEndDate !== draft.baseTargetEndDate) throw new Error('Срок проекта изменился после создания сценария. Создайте сценарий заново.')
    return port.updateProject(workspace, { targetEndDate: draft.projectTargetEndDate })
  }
  if (!draft.sourceTaskId || !draft.taskUpdate || !draft.baseTaskDates) throw new Error('Сценарий задачи повреждён.')
  const currentTask = workspace.tasks.find((task) => task.id === draft.sourceTaskId)
  if (!currentTask) throw new Error('Задача больше не существует.')
  if (currentTask.startDate !== draft.baseTaskDates.startDate || currentTask.endDate !== draft.baseTaskDates.endDate) {
    throw new Error('Задача изменилась после создания сценария. Создайте сценарий заново.')
  }
  return port.updateTask(workspace, draft.sourceTaskId, draft.taskUpdate)
}
