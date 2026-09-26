import type { CreateProjectRequest } from '../types/project'

export function validateProjectInput(project: CreateProjectRequest): void {
  if (!project.name.trim()) throw new Error('Введите название проекта.')
  if (!project.startDate || !project.targetEndDate) throw new Error('Укажите даты начала и окончания проекта.')
  if (project.startDate > project.targetEndDate) {
    throw new Error('Дата начала не может быть позже плановой даты окончания.')
  }
}
