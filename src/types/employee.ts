export interface Employee {
  id: string
  projectId: string
  name: string
  phone?: string | null
  email?: string | null
  role?: string
  initials?: string
  color?: string
}

export interface CreateEmployeeRequest {
  name: string
  phone?: string | null
  email?: string | null
}

export interface UpdateEmployeeRequest {
  name?: string
  phone?: string | null
  email?: string | null
}
