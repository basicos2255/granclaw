export interface Tenant {
  id: string
  name: string
  slug: string
  status: 'active' | 'inactive' | 'suspended'
  createdAt: Date
  updatedAt: Date
}

export interface TenantConfig {
  tenantId: string
  settings: Record<string, unknown>
}
