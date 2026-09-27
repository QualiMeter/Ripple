import type { CreateEmployeeRequest, Employee, UpdateEmployeeRequest } from '../types/employee'
import { apiRequest } from './client'
import type { EmployeeDto } from './backend/types'
import { mapEmployee } from './backend/mappers'

export interface EmployeesApi {
  listEmployees(projectId: string): Promise<Employee[]>
  getEmployee(projectId: string, employeeId: string): Promise<Employee>
  createEmployee(projectId: string, request: CreateEmployeeRequest): Promise<Employee>
  updateEmployee(projectId: string, employeeId: string, current: Employee, request: UpdateEmployeeRequest): Promise<Employee>
  deleteEmployee(projectId: string, employeeId: string): Promise<void>
}

export const httpEmployeesApi: EmployeesApi = {
  async listEmployees(projectId) { return (await apiRequest<EmployeeDto[]>(`/api/v1/projects/${projectId}/employees`)).map(mapEmployee) },
  async getEmployee(projectId, employeeId) {
    return mapEmployee(await apiRequest<import('./backend/types').EmployeeDetailsDto>(`/api/v1/projects/${projectId}/employees/${employeeId}`))
  },
  async createEmployee(projectId, request) {
    return mapEmployee(await apiRequest<EmployeeDto>(`/api/v1/projects/${projectId}/employees`, {
      method: 'POST', body: JSON.stringify({ name: request.name, phone: request.phone ?? null, email: request.email ?? null }),
    }))
  },
  async updateEmployee(projectId, employeeId, current, request) {
    return mapEmployee(await apiRequest<EmployeeDto>(`/api/v1/projects/${projectId}/employees/${employeeId}`, {
      method: 'PUT', body: JSON.stringify({ name: request.name ?? current.name, phone: request.phone ?? current.phone ?? null, email: request.email ?? current.email ?? null }),
    }))
  },
  async deleteEmployee(projectId, employeeId) {
    await apiRequest<void>(`/api/v1/projects/${projectId}/employees/${employeeId}`, { method: 'DELETE' })
  },
}

const mode = import.meta.env.VITE_API_MODE ?? 'mock'

export const employeesApi: EmployeesApi = mode === 'http' ? httpEmployeesApi : {
  listEmployees: async (projectId) => {
    const { mockEmployeesApi } = await import('./mockEmployees.api')
    return mockEmployeesApi.listEmployees(projectId)
  },
  getEmployee: async (projectId, employeeId) => {
    const { mockEmployeesApi } = await import('./mockEmployees.api')
    const employee = (await mockEmployeesApi.listEmployees(projectId)).find((candidate) => candidate.id === employeeId)
    if (!employee) throw new Error('Сотрудник не найден.')
    return employee
  },
  createEmployee: async (projectId, request) => {
    const { mockEmployeesApi } = await import('./mockEmployees.api')
    return mockEmployeesApi.createEmployee(projectId, request)
  },
  updateEmployee: async (_projectId, employeeId, _current, request) => {
    const { mockEmployeesApi } = await import('./mockEmployees.api')
    return mockEmployeesApi.updateEmployee(employeeId, request)
  },
  deleteEmployee: async (projectId, employeeId) => {
    const { mockEmployeesApi } = await import('./mockEmployees.api')
    return mockEmployeesApi.deleteEmployee(projectId, employeeId)
  },
}
