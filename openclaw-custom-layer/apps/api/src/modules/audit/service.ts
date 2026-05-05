import { store } from '../../shared/memory-store'
import type { AuditEntry } from './types'

export function getAllAuditEntries(): AuditEntry[] {
  return store.getAll<AuditEntry>('audit')
}

export function getAuditEntryById(id: string): AuditEntry | null {
  return store.getById<AuditEntry>('audit', id)
}

export function getAuditEntriesByTenant(tenantId: string): AuditEntry[] {
  const entries = store.getAll<AuditEntry>('audit')
  return entries.filter((e) => e.tenantId === tenantId)
}
