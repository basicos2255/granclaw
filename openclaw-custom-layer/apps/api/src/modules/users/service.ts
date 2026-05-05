import { storage } from '../../storage'
import type { PublicUser, User } from './types'

function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    tenantId: user.tenantId,
    email: user.email,
    role: user.role,
    active: user.active,
    createdAt: user.createdAt
  }
}

export function getAllUsers(): User[] {
  return storage.getAll<User>('users')
}

export function getUserById(id: string): User | null {
  return storage.getById<User>('users', id)
}

export function getUsersByTenant(tenantId: string): PublicUser[] {
  const users = storage.getAll<User>('users')
  return users
    .filter((u) => u.tenantId === tenantId)
    .map(toPublicUser)
}
