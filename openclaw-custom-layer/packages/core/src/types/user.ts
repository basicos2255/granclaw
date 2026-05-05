export interface User {
  id: string
  tenantId: string
  email: string
  name: string
  role: 'admin' | 'operator' | 'viewer'
  status: 'active' | 'inactive'
  createdAt: Date
  updatedAt: Date
}

export interface UserCredentials {
  email: string
  password: string
}
