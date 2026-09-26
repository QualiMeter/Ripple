import type { CreateEmployeeRequest, Employee, UpdateEmployeeRequest } from '../types/employee'
import { demoAssignees } from './assignees'

const employees = new Map(demoAssignees.map((employee) => [employee.id, { ...employee }]))
const colors = ['#6D5DFB', '#189A73', '#2575D8', '#D35D96', '#D07A22', '#7557A8']
let employeeSequence = 100

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toLocaleUpperCase('ru-RU')
}

export function listMockEmployees(projectId: string): Employee[] {
  return [...employees.values()].filter((employee) => employee.projectId === projectId).map((employee) => ({ ...employee }))
}

export function getMockEmployee(employeeId: string): Employee | undefined {
  const employee = employees.get(employeeId)
  return employee ? { ...employee } : undefined
}

export function createMockEmployee(projectId: string, request: CreateEmployeeRequest): Employee {
  const sequence = employeeSequence++
  const employee: Employee = {
    id: `employee-${sequence}`,
    projectId,
    name: request.name.trim(),
    role: 'Сотрудник проекта',
    initials: initials(request.name),
    color: colors[sequence % colors.length],
  }
  employees.set(employee.id, employee)
  return { ...employee }
}

export function updateMockEmployee(employeeId: string, request: UpdateEmployeeRequest): Employee {
  const current = employees.get(employeeId)
  if (!current) throw new Error('Сотрудник не найден.')
  const name = request.name?.trim() ?? current.name
  const employee = { ...current, ...request, name, initials: initials(name) }
  employees.set(employeeId, employee)
  return { ...employee }
}
