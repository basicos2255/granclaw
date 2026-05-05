export interface User {
  id: string
  tenantId: string
  email: string
  role: 'admin' | 'user'
  active: boolean
  createdAt: number
}

export interface PublicUser {
  id: string
  tenantId: string
  email: string
  role: 'admin' | 'user'
  active: boolean
  createdAt: number
}
