import type { CreateProjectRequest, Project, UpdateProjectRequest } from '../types/project'
import { demoProjects } from './projects'

const projects = new Map(demoProjects.map((project) => [project.id, { ...project }]))
let projectSequence = 1

function projectSlug(name: string): string {
  const value = name
    .toLocaleLowerCase('ru-RU')
    .replace(/[^a-zа-яё0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 36)
  return value || 'project'
}

export function listMockProjects(): Project[] {
  return [...projects.values()].map((project) => ({ ...project }))
}

export function getMockProject(projectId: string): Project | undefined {
  const project = projects.get(projectId)
  return project ? { ...project } : undefined
}

export function createMockProject(request: CreateProjectRequest): Project {
  const baseId = projectSlug(request.name)
  let id = `${baseId}-${projectSequence++}`
  while (projects.has(id)) id = `${baseId}-${projectSequence++}`
  const project: Project = {
    id,
    creatorId: 'maya',
    name: request.name.trim(),
    description: 'Новый проект · задачи ещё не добавлены',
    startDate: request.startDate,
    targetEndDate: request.targetEndDate,
  }
  projects.set(id, project)
  return { ...project }
}

export function updateMockProject(projectId: string, request: UpdateProjectRequest): Project {
  const current = projects.get(projectId)
  if (!current) throw new Error('Проект не найден')
  const project: Project = {
    ...current,
    ...request,
    name: request.name?.trim() ?? current.name,
  }
  projects.set(projectId, project)
  return { ...project }
}
