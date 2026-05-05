import { storage } from '../../storage'
import type { Tenant } from './types'

export function getAllTenants(): Tenant[] {
  return storage.getAll<Tenant>('tenants')
}

export function getTenantById(id: string): Tenant | null {
  return storage.getById<Tenant>('tenants', id)
}
