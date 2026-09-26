import { createMockEmployee, getMockEmployee, listMockEmployees, updateMockEmployee } from '../mocks/employeeStore'
import { getMockProject } from '../mocks/projectStore'
import type { EmployeesApi } from './employees.api'

function validateName(name: string | undefined): void {
  if (name !== undefined && !name.trim()) throw new Error('Введите имя сотрудника.')
}

export const mockEmployeesApi: EmployeesApi = {
  async listEmployees(projectId) {
    await new Promise((resolve) => setTimeout(resolve, 100))
    if (!getMockProject(projectId)) throw new Error('Проект не найден')
    return listMockEmployees(projectId)
  },
  async createEmployee(projectId, request) {
    await new Promise((resolve) => setTimeout(resolve, 140))
    if (!getMockProject(projectId)) throw new Error('Проект не найден')
    validateName(request.name)
    return createMockEmployee(projectId, request)
  },
  async updateEmployee(employeeId, request) {
    await new Promise((resolve) => setTimeout(resolve, 140))
    if (!getMockEmployee(employeeId)) throw new Error('Сотрудник не найден.')
    validateName(request.name)
    return updateMockEmployee(employeeId, request)
  },
}
