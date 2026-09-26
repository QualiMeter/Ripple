import type { CreateEmployeeRequest, Employee, UpdateEmployeeRequest } from '../types/employee'
import { apiRequest } from './client'

export interface EmployeesApi {
  listEmployees(projectId: string): Promise<Employee[]>
  createEmployee(projectId: string, request: CreateEmployeeRequest): Promise<Employee>
  updateEmployee(employeeId: string, request: UpdateEmployeeRequest): Promise<Employee>
}

const httpEmployeesApi: EmployeesApi = {
  listEmployees: (projectId) => apiRequest<Employee[]>(`/api/projects/${projectId}/employees`),
  createEmployee: (projectId, request) => apiRequest<Employee>(`/api/projects/${projectId}/employees`, { method: 'POST', body: JSON.stringify(request) }),
  updateEmployee: (employeeId, request) => apiRequest<Employee>(`/api/employees/${employeeId}`, { method: 'PATCH', body: JSON.stringify(request) }),
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
  updateEmployee: async (employeeId, request) => {
    const { mockEmployeesApi } = await import('./mockEmployees.api')
    return mockEmployeesApi.updateEmployee(employeeId, request)
  },
}
