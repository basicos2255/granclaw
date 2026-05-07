/**
 * File-based database
 * Persistencia simple en archivos JSON
 * H1.2: Uses atomic persistence for safe writes
 */

import * as path from 'path'
import { atomicWriteJson, atomicReadJsonOrDefault } from '../shared/atomic-persistence'

const DATA_DIR = path.join(process.cwd(), 'data')

/**
 * Obtiene la ruta del archivo para una entidad
 */
function getFilePath(entity: string): string {
  return path.join(DATA_DIR, `${entity}.json`)
}

/**
 * Lee todos los items de una entidad
 * H1.2: Uses atomicReadJsonOrDefault with backup fallback
 */
export function read<T>(entity: string): T[] {
  const filePath = getFilePath(entity)
  const data = atomicReadJsonOrDefault<T[]>(filePath, [])
  return Array.isArray(data) ? data : []
}

/**
 * Escribe todos los items de una entidad (reemplaza)
 * H1.2: Uses atomicWriteJson for safe atomic writes
 */
export function write<T>(entity: string, data: T[]): void {
  const filePath = getFilePath(entity)
  const result = atomicWriteJson(filePath, data)
  if (!result.success) {
    console.error(`[FileDB] Atomic write failed for ${entity}:`, result.error)
  }
}

/**
 * Añade un item a una entidad
 */
export function append<T>(entity: string, item: T): T {
  const items = read<T>(entity)
  items.push(item)
  write(entity, items)
  return item
}

/**
 * Obtiene un item por id
 */
export function getById<T extends { id: string }>(entity: string, id: string): T | null {
  const items = read<T>(entity)
  return items.find((item) => item.id === id) || null
}

/**
 * Actualiza un item por id
 */
export function update<T extends { id: string }>(entity: string, id: string, updates: Partial<T>): T | null {
  const items = read<T>(entity)
  const index = items.findIndex((item) => item.id === id)

  if (index === -1) {
    return null
  }

  items[index] = { ...items[index], ...updates }
  write(entity, items)
  return items[index]
}

/**
 * Elimina un item por id
 */
export function remove<T extends { id: string }>(entity: string, id: string): boolean {
  const items = read<T>(entity)
  const filtered = items.filter((item) => item.id !== id)

  if (filtered.length === items.length) {
    return false
  }

  write(entity, filtered)
  return true
}

/**
 * Elimina un item por campo específico
 */
export function removeByField<T>(entity: string, field: keyof T, value: unknown): boolean {
  const items = read<T>(entity)
  const filtered = items.filter((item) => item[field] !== value)

  if (filtered.length === items.length) {
    return false
  }

  write(entity, filtered)
  return true
}
