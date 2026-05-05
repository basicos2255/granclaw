/**
 * Memory Store - Almacenamiento temporal in-memory
 * Para desarrollo sin base de datos real
 */

type EntityType = 'tenants' | 'users' | 'presets' | 'agents' | 'sessions' | 'tasks' | 'audit'

interface StoreData {
  tenants: Record<string, unknown>[]
  users: Record<string, unknown>[]
  presets: Record<string, unknown>[]
  agents: Record<string, unknown>[]
  sessions: Record<string, unknown>[]
  tasks: Record<string, unknown>[]
  audit: Record<string, unknown>[]
}

class MemoryStore {
  private data: StoreData = {
    tenants: [],
    users: [],
    presets: [],
    agents: [],
    sessions: [],
    tasks: [],
    audit: []
  }

  getAll<T = Record<string, unknown>>(entity: EntityType): T[] {
    return this.data[entity] as T[]
  }

  getById<T = Record<string, unknown>>(entity: EntityType, id: string): T | null {
    const items = this.data[entity]
    const found = items.find((item) => (item as { id?: string }).id === id)
    return (found as T) ?? null
  }

  add<T extends Record<string, unknown>>(entity: EntityType, item: T): T {
    this.data[entity].push(item)
    return item
  }

  update<T extends Record<string, unknown>>(entity: EntityType, id: string, updates: Partial<T>): T | null {
    const items = this.data[entity]
    const index = items.findIndex((item) => (item as { id?: string }).id === id)
    if (index === -1) return null

    items[index] = { ...items[index], ...updates }
    return items[index] as T
  }

  delete(entity: EntityType, id: string): boolean {
    const items = this.data[entity]
    const index = items.findIndex((item) => (item as { id?: string }).id === id)
    if (index === -1) return false

    items.splice(index, 1)
    return true
  }

  clear(entity: EntityType): void {
    this.data[entity] = []
  }

  clearAll(): void {
    this.data = {
      tenants: [],
      users: [],
      presets: [],
      agents: [],
      sessions: [],
      tasks: [],
      audit: []
    }
  }
}

export const store = new MemoryStore()
export type { EntityType, StoreData }
