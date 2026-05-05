export interface AuditEntry {
  id: string
  tenantId: string
  userId?: string
  action: string
  resource: string
  resourceId?: string
  details?: Record<string, unknown>
  ip?: string
  userAgent?: string
  timestamp: string
}
