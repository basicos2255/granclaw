/**
 * Storage interface
 * Abstracción sobre file-db para posible migración futura
 */

import * as fileDb from './file-db'

export interface StorageInterface {
  getAll<T>(entity: string): T[]
  getById<T extends { id: string }>(entity: string, id: string): T | null
  add<T>(entity: string, item: T): T
  update<T extends { id: string }>(entity: string, id: string, updates: Partial<T>): T | null
  remove<T extends { id: string }>(entity: string, id: string): boolean
  removeByField<T>(entity: string, field: keyof T, value: unknown): boolean
}

/**
 * Storage implementation usando file-db
 */
export const storage: StorageInterface = {
  getAll<T>(entity: string): T[] {
    return fileDb.read<T>(entity)
  },

  getById<T extends { id: string }>(entity: string, id: string): T | null {
    return fileDb.getById<T>(entity, id)
  },

  add<T>(entity: string, item: T): T {
    return fileDb.append<T>(entity, item)
  },

  update<T extends { id: string }>(entity: string, id: string, updates: Partial<T>): T | null {
    return fileDb.update<T>(entity, id, updates)
  },

  remove<T extends { id: string }>(entity: string, id: string): boolean {
    return fileDb.remove<T>(entity, id)
  },

  removeByField<T>(entity: string, field: keyof T, value: unknown): boolean {
    return fileDb.removeByField<T>(entity, field, value)
  }
}
