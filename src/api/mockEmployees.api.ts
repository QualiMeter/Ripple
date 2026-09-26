import { createMockEmployee, getMockEmployee, listMockEmployees, updateMockEmployee } from '../mocks/employeeStore'
import { getMockProject } from '../mocks/projectStore'
import type { CreateEmployeeRequest, UpdateEmployeeRequest } from '../types/employee'

function validateName(name: string | undefined): void {
  if (name !== undefined && !name.trim()) throw new Error('Введите имя сотрудника.')
}

export const mockEmployeesApi = {
  async listEmployees(projectId: string) {
    await new Promise((resolve) => setTimeout(resolve, 100))
    if (!getMockProject(projectId)) throw new Error('Проект не найден')
    return listMockEmployees(projectId)
  },
  async createEmployee(projectId: string, request: CreateEmployeeRequest) {
    await new Promise((resolve) => setTimeout(resolve, 140))
    if (!getMockProject(projectId)) throw new Error('Проект не найден')
    validateName(request.name)
    return createMockEmployee(projectId, request)
  },
  async updateEmployee(employeeId: string, request: UpdateEmployeeRequest) {
    await new Promise((resolve) => setTimeout(resolve, 140))
    if (!getMockEmployee(employeeId)) throw new Error('Сотрудник не найден.')
    validateName(request.name)
    return updateMockEmployee(employeeId, request)
  },
}
