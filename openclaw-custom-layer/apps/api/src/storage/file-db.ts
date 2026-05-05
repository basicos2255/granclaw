/**
 * File-based database
 * Persistencia simple en archivos JSON
 */

import * as fs from 'fs'
import * as path from 'path'

const DATA_DIR = path.join(process.cwd(), 'data')

/**
 * Asegura que el directorio data existe
 */
function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

/**
 * Obtiene la ruta del archivo para una entidad
 */
function getFilePath(entity: string): string {
  return path.join(DATA_DIR, `${entity}.json`)
}

/**
 * Lee todos los items de una entidad
 */
export function read<T>(entity: string): T[] {
  ensureDataDir()
  const filePath = getFilePath(entity)

  if (!fs.existsSync(filePath)) {
    return []
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const data = JSON.parse(content)
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

/**
 * Escribe todos los items de una entidad (reemplaza)
 */
export function write<T>(entity: string, data: T[]): void {
  ensureDataDir()
  const filePath = getFilePath(entity)
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
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
