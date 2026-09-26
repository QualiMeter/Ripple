export interface Employee {
  id: string
  projectId: string
  name: string
  role?: string
  initials?: string
  color?: string
}

export interface CreateEmployeeRequest {
  name: string
}

export interface UpdateEmployeeRequest {
  name?: string
}
