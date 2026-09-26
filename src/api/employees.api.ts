import type { CreateEmployeeRequest, Employee, UpdateEmployeeRequest } from '../types/employee'
import { apiRequest } from './client'
import type { EmployeeDto } from './backend/types'
import { mapEmployee } from './backend/mappers'

export interface EmployeesApi {
  listEmployees(projectId: string): Promise<Employee[]>
  createEmployee(projectId: string, request: CreateEmployeeRequest): Promise<Employee>
  updateEmployee(projectId: string, employeeId: string, request: UpdateEmployeeRequest): Promise<Employee>
}

export const httpEmployeesApi: EmployeesApi = {
  async listEmployees(projectId) { return (await apiRequest<EmployeeDto[]>(`/api/v1/projects/${projectId}/employees`)).map(mapEmployee) },
  async createEmployee(projectId, request) { return mapEmployee(await apiRequest<EmployeeDto>(`/api/v1/projects/${projectId}/employees`, { method: 'POST', body: JSON.stringify({ name: request.name }) })) },
  async updateEmployee(projectId, employeeId, request) {
    const employees = await apiRequest<EmployeeDto[]>(`/api/v1/projects/${projectId}/employees`)
    const current = employees.find((employee) => employee.id === employeeId)
    if (!current) throw new Error('Сотрудник не найден.')
    return mapEmployee(await apiRequest<EmployeeDto>(`/api/v1/projects/${projectId}/employees/${employeeId}`, { method: 'PUT', body: JSON.stringify({ name: request.name ?? current.name }) }))
  },
}

const mode = import.meta.env.VITE_API_MODE ?? 'mock'

export const employeesApi: EmployeesApi = mode === 'http' ? httpEmployeesApi : {
  listEmployees: async (projectId) => {
    const { mockEmployeesApi } = await import('./mockEmployees.api')
    return mockEmployeesApi.listEmployees(projectId)
  },
  createEmployee: async (projectId, request) => {
    const { mockEmployeesApi } = await import('./mockEmployees.api')
    return mockEmployeesApi.createEmployee(projectId, request)
  },
  updateEmployee: async (_projectId, employeeId, request) => {
    const { mockEmployeesApi } = await import('./mockEmployees.api')
    return mockEmployeesApi.updateEmployee(employeeId, request)
  },
}
