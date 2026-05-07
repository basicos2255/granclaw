/**
 * Atomic Persistence
 * PHASE H1: Runtime Hardening & Platform Stabilization
 *
 * Safe file persistence with atomic writes, backups, and recovery.
 * Prevents data corruption from partial writes or crashes.
 */

import * as fs from 'fs'
import * as path from 'path'

/**
 * Persistence options
 */
export interface PersistenceOptions {
  /** Create backup before writing */
  createBackup?: boolean
  /** Backup suffix */
  backupSuffix?: string
  /** Maximum backup age in ms (auto-cleanup) */
  maxBackupAgeMs?: number
  /** Pretty print JSON */
  prettyPrint?: boolean
  /** Ensure directory exists */
  ensureDir?: boolean
}

const DEFAULT_OPTIONS: Required<PersistenceOptions> = {
  createBackup: true,
  backupSuffix: '.backup',
  maxBackupAgeMs: 86400000, // 24 hours
  prettyPrint: true,
  ensureDir: true
}

/**
 * Atomic write result
 */
export interface WriteResult {
  success: boolean
  filepath: string
  bytesWritten: number
  backupCreated: boolean
  error?: string
}

/**
 * Atomic read result
 */
export interface ReadResult<T> {
  success: boolean
  data: T | null
  source: 'primary' | 'backup' | 'none'
  error?: string
}

/**
 * Atomically write data to a JSON file
 * Uses temp file + rename pattern for atomicity
 */
export function atomicWriteJson<T>(
  filepath: string,
  data: T,
  options: PersistenceOptions = {}
): WriteResult {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const tempPath = filepath + '.tmp'
  const backupPath = filepath + opts.backupSuffix

  try {
    // Ensure directory exists
    if (opts.ensureDir) {
      const dir = path.dirname(filepath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
    }

    // Serialize data
    const content = opts.prettyPrint
      ? JSON.stringify(data, null, 2)
      : JSON.stringify(data)

    // Write to temp file first
    fs.writeFileSync(tempPath, content, 'utf-8')

    // Create backup of existing file
    let backupCreated = false
    if (opts.createBackup && fs.existsSync(filepath)) {
      fs.copyFileSync(filepath, backupPath)
      backupCreated = true
    }

    // Atomic rename (temp -> final)
    fs.renameSync(tempPath, filepath)

    return {
      success: true,
      filepath,
      bytesWritten: content.length,
      backupCreated
    }
  } catch (err) {
    // Clean up temp file on error
    if (fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath)
      } catch {
        // Ignore cleanup errors
      }
    }

    return {
      success: false,
      filepath,
      bytesWritten: 0,
      backupCreated: false,
      error: err instanceof Error ? err.message : String(err)
    }
  }
}

/**
 * Read JSON file with fallback to backup
 */
export function atomicReadJson<T>(
  filepath: string,
  options: PersistenceOptions = {}
): ReadResult<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const backupPath = filepath + opts.backupSuffix

  // Try primary file
  try {
    if (fs.existsSync(filepath)) {
      const content = fs.readFileSync(filepath, 'utf-8')
      const data = JSON.parse(content) as T
      return {
        success: true,
        data,
        source: 'primary'
      }
    }
  } catch (err) {
    console.warn(`[AtomicPersistence] Error reading primary ${filepath}:`, err)
  }

  // Try backup
  try {
    if (fs.existsSync(backupPath)) {
      const content = fs.readFileSync(backupPath, 'utf-8')
      const data = JSON.parse(content) as T
      console.log(`[AtomicPersistence] Recovered from backup: ${backupPath}`)
      return {
        success: true,
        data,
        source: 'backup'
      }
    }
  } catch (err) {
    console.warn(`[AtomicPersistence] Error reading backup ${backupPath}:`, err)
  }

  return {
    success: false,
    data: null,
    source: 'none',
    error: `File not found or corrupted: ${filepath}`
  }
}

/**
 * Read JSON file or return default value
 */
export function atomicReadJsonOrDefault<T>(
  filepath: string,
  defaultValue: T,
  options: PersistenceOptions = {}
): T {
  const result = atomicReadJson<T>(filepath, options)
  return result.success && result.data !== null ? result.data : defaultValue
}

/**
 * Check if a file exists (primary or backup)
 */
export function fileExists(
  filepath: string,
  options: PersistenceOptions = {}
): { exists: boolean; hasBackup: boolean } {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const backupPath = filepath + opts.backupSuffix

  return {
    exists: fs.existsSync(filepath),
    hasBackup: fs.existsSync(backupPath)
  }
}

/**
 * Delete a file and its backup
 */
export function deleteFile(
  filepath: string,
  options: PersistenceOptions = {}
): boolean {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const backupPath = filepath + opts.backupSuffix
  let deleted = false

  try {
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath)
      deleted = true
    }
    if (fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath)
    }
  } catch (err) {
    console.error(`[AtomicPersistence] Error deleting ${filepath}:`, err)
    return false
  }

  return deleted
}

/**
 * Restore from backup
 */
export function restoreFromBackup(
  filepath: string,
  options: PersistenceOptions = {}
): boolean {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const backupPath = filepath + opts.backupSuffix

  try {
    if (!fs.existsSync(backupPath)) {
      console.warn(`[AtomicPersistence] No backup found: ${backupPath}`)
      return false
    }

    fs.copyFileSync(backupPath, filepath)
    console.log(`[AtomicPersistence] Restored from backup: ${filepath}`)
    return true
  } catch (err) {
    console.error(`[AtomicPersistence] Error restoring from backup:`, err)
    return false
  }
}

/**
 * Clean up old backups
 */
export function cleanupOldBackups(
  directory: string,
  maxAgeMs: number,
  backupSuffix = '.backup'
): number {
  let cleaned = 0
  const now = Date.now()

  try {
    if (!fs.existsSync(directory)) return 0

    const files = fs.readdirSync(directory)

    for (const file of files) {
      if (!file.endsWith(backupSuffix)) continue

      const filepath = path.join(directory, file)
      const stats = fs.statSync(filepath)
      const age = now - stats.mtimeMs

      if (age > maxAgeMs) {
        fs.unlinkSync(filepath)
        cleaned++
      }
    }
  } catch (err) {
    console.error(`[AtomicPersistence] Error cleaning backups:`, err)
  }

  return cleaned
}

/**
 * Persistence wrapper for managing a JSON file
 */
export class JsonPersistence<T> {
  private filepath: string
  private options: Required<PersistenceOptions>
  private cache: T | null = null
  private lastModified: number = 0

  constructor(filepath: string, options: PersistenceOptions = {}) {
    this.filepath = filepath
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  /**
   * Read data (with caching)
   */
  read(defaultValue?: T): T | null {
    // Check if file has changed
    try {
      if (fs.existsSync(this.filepath)) {
        const stats = fs.statSync(this.filepath)
        if (stats.mtimeMs > this.lastModified) {
          this.cache = null
        }
      }
    } catch {
      // Ignore stat errors
    }

    // Return cached value if available
    if (this.cache !== null) {
      return this.cache
    }

    // Read from file
    const result = atomicReadJson<T>(this.filepath, this.options)

    if (result.success && result.data !== null) {
      this.cache = result.data
      this.lastModified = Date.now()
      return this.cache
    }

    if (defaultValue !== undefined) {
      return defaultValue
    }

    return null
  }

  /**
   * Write data
   */
  write(data: T): WriteResult {
    const result = atomicWriteJson(this.filepath, data, this.options)

    if (result.success) {
      this.cache = data
      this.lastModified = Date.now()
    }

    return result
  }

  /**
   * Update data with a function
   */
  update(updater: (current: T | null) => T): WriteResult {
    const current = this.read()
    const updated = updater(current)
    return this.write(updated)
  }

  /**
   * Delete the file
   */
  delete(): boolean {
    this.cache = null
    this.lastModified = 0
    return deleteFile(this.filepath, this.options)
  }

  /**
   * Clear cache (force re-read on next access)
   */
  clearCache(): void {
    this.cache = null
    this.lastModified = 0
  }

  /**
   * Check if file exists
   */
  exists(): boolean {
    return fileExists(this.filepath, this.options).exists
  }

  /**
   * Restore from backup
   */
  restoreFromBackup(): boolean {
    this.clearCache()
    return restoreFromBackup(this.filepath, this.options)
  }

  /**
   * Get file path
   */
  getFilepath(): string {
    return this.filepath
  }
}

/**
 * Create a JSON persistence instance
 */
export function createJsonPersistence<T>(
  filepath: string,
  options?: PersistenceOptions
): JsonPersistence<T> {
  return new JsonPersistence<T>(filepath, options)
}
