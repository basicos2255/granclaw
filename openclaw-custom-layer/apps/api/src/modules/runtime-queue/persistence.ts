/**
 * Queue Persistence
 * PHASE H1: Runtime Hardening & Platform Stabilization
 *
 * Atomic persistence for queue state with crash recovery support.
 */

import * as fs from 'fs'
import * as path from 'path'
import type { QueuedJob, JobStatus } from './types'
import type { RuntimeQueue } from './queue'

/**
 * Persistence configuration
 */
interface PersistenceConfig {
  /** Data directory path */
  dataDir: string
  /** Queue state file name */
  queueFile: string
  /** Dead letter file name */
  deadLetterFile: string
  /** Backup file suffix */
  backupSuffix: string
  /** Maximum queue entries to persist */
  maxEntries: number
  /** Maximum dead letter entries */
  maxDeadLetterEntries: number
}

const DEFAULT_PERSISTENCE_CONFIG: PersistenceConfig = {
  dataDir: 'data',
  queueFile: 'runtime-queue.json',
  deadLetterFile: 'dead-letter-queue.json',
  backupSuffix: '.backup',
  maxEntries: 500,
  maxDeadLetterEntries: 200
}

let config = { ...DEFAULT_PERSISTENCE_CONFIG }

/**
 * Set persistence configuration
 */
export function setPersistenceConfig(updates: Partial<PersistenceConfig>): void {
  config = { ...config, ...updates }
}

/**
 * Ensure data directory exists
 */
function ensureDataDir(): void {
  if (!fs.existsSync(config.dataDir)) {
    fs.mkdirSync(config.dataDir, { recursive: true })
  }
}

/**
 * Get full path for a file
 */
function getFilePath(filename: string): string {
  return path.join(config.dataDir, filename)
}

/**
 * Atomic write with backup
 */
function atomicWrite(filepath: string, data: string): void {
  const tempPath = filepath + '.tmp'
  const backupPath = filepath + config.backupSuffix

  try {
    // Write to temp file first
    fs.writeFileSync(tempPath, data, 'utf-8')

    // Create backup of existing file
    if (fs.existsSync(filepath)) {
      fs.copyFileSync(filepath, backupPath)
    }

    // Rename temp to final (atomic on most filesystems)
    fs.renameSync(tempPath, filepath)
  } catch (err) {
    // Clean up temp file on error
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath)
    }
    throw err
  }
}

/**
 * Safe read with fallback to backup
 */
function safeRead<T>(filepath: string, defaultValue: T): T {
  const backupPath = filepath + config.backupSuffix

  try {
    if (fs.existsSync(filepath)) {
      const content = fs.readFileSync(filepath, 'utf-8')
      return JSON.parse(content) as T
    }
  } catch (err) {
    console.warn(`[Persistence] Error reading ${filepath}, trying backup:`, err)

    // Try backup
    try {
      if (fs.existsSync(backupPath)) {
        const content = fs.readFileSync(backupPath, 'utf-8')
        return JSON.parse(content) as T
      }
    } catch (backupErr) {
      console.error(`[Persistence] Error reading backup ${backupPath}:`, backupErr)
    }
  }

  return defaultValue
}

/**
 * Queue state for persistence
 */
interface PersistedQueueState {
  version: number
  lastSavedAt: string
  jobs: QueuedJob[]
}

/**
 * Save queue state to disk
 */
export function saveQueueState(queue: RuntimeQueue): void {
  ensureDataDir()

  const jobs = queue.getAllJobs()

  // Filter to relevant jobs (pending, running, retrying)
  const relevantStatuses: JobStatus[] = ['pending', 'scheduled', 'running', 'retrying']
  let relevantJobs = jobs.filter(j => relevantStatuses.includes(j.status))

  // Also keep recent completed/failed for history (last 50)
  const completedJobs = jobs
    .filter(j => j.status === 'completed' || j.status === 'failed' || j.status === 'cancelled')
    .sort((a, b) => {
      const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0
      const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0
      return bTime - aTime
    })
    .slice(0, 50)

  relevantJobs = [...relevantJobs, ...completedJobs]

  // Limit total entries
  if (relevantJobs.length > config.maxEntries) {
    relevantJobs = relevantJobs.slice(0, config.maxEntries)
  }

  const state: PersistedQueueState = {
    version: 1,
    lastSavedAt: new Date().toISOString(),
    jobs: relevantJobs
  }

  const filepath = getFilePath(config.queueFile)
  atomicWrite(filepath, JSON.stringify(state, null, 2))
}

/**
 * Load queue state from disk
 */
export function loadQueueState(): QueuedJob[] {
  const filepath = getFilePath(config.queueFile)

  const state = safeRead<PersistedQueueState | null>(filepath, null)

  if (!state || !state.jobs) {
    return []
  }

  console.log(`[Persistence] Loaded ${state.jobs.length} jobs from ${filepath}`)
  console.log(`[Persistence] Last saved at: ${state.lastSavedAt}`)

  return state.jobs
}

/**
 * Dead letter entry for persistence
 */
interface DeadLetterEntry {
  job: QueuedJob
  reason: string
  deadLetteredAt: string
  requeueAttempts: number
  lastRequeueAt?: string
}

/**
 * Dead letter state for persistence
 */
interface PersistedDeadLetterState {
  version: number
  lastSavedAt: string
  entries: DeadLetterEntry[]
}

// In-memory dead letter cache
let deadLetterCache: DeadLetterEntry[] = []

/**
 * Add job to dead letter queue
 */
export function addToDeadLetter(job: QueuedJob, reason: string): void {
  const entry: DeadLetterEntry = {
    job,
    reason,
    deadLetteredAt: new Date().toISOString(),
    requeueAttempts: 0
  }

  deadLetterCache.push(entry)

  // Limit size
  if (deadLetterCache.length > config.maxDeadLetterEntries) {
    deadLetterCache = deadLetterCache.slice(-config.maxDeadLetterEntries)
  }

  // Persist
  saveDeadLetterState()
}

/**
 * Save dead letter state
 */
export function saveDeadLetterState(): void {
  ensureDataDir()

  const state: PersistedDeadLetterState = {
    version: 1,
    lastSavedAt: new Date().toISOString(),
    entries: deadLetterCache
  }

  const filepath = getFilePath(config.deadLetterFile)
  atomicWrite(filepath, JSON.stringify(state, null, 2))
}

/**
 * Load dead letter state
 */
export function loadDeadLetterState(): DeadLetterEntry[] {
  const filepath = getFilePath(config.deadLetterFile)

  const state = safeRead<PersistedDeadLetterState | null>(filepath, null)

  if (!state || !state.entries) {
    deadLetterCache = []
    return []
  }

  deadLetterCache = state.entries
  console.log(`[Persistence] Loaded ${deadLetterCache.length} dead letter entries`)

  return deadLetterCache
}

/**
 * Get dead letter entries
 */
export function getDeadLetterEntries(limit = 50, offset = 0): DeadLetterEntry[] {
  return deadLetterCache.slice(offset, offset + limit)
}

/**
 * Get dead letter entry by job ID
 */
export function getDeadLetterEntry(jobId: string): DeadLetterEntry | undefined {
  return deadLetterCache.find(e => e.job.id === jobId)
}

/**
 * Remove from dead letter (for requeue)
 */
export function removeFromDeadLetter(jobId: string): DeadLetterEntry | undefined {
  const index = deadLetterCache.findIndex(e => e.job.id === jobId)
  if (index === -1) return undefined

  const [entry] = deadLetterCache.splice(index, 1)
  saveDeadLetterState()

  return entry
}

/**
 * Mark requeue attempt on dead letter entry
 */
export function markRequeueAttempt(jobId: string): void {
  const entry = deadLetterCache.find(e => e.job.id === jobId)
  if (entry) {
    entry.requeueAttempts++
    entry.lastRequeueAt = new Date().toISOString()
    saveDeadLetterState()
  }
}

/**
 * Clear dead letter queue
 */
export function clearDeadLetter(): number {
  const count = deadLetterCache.length
  deadLetterCache = []
  saveDeadLetterState()
  return count
}

/**
 * Get dead letter count
 */
export function getDeadLetterCount(): number {
  return deadLetterCache.length
}

/**
 * Recovery helper: find orphaned running jobs
 */
export function findOrphanedJobs(jobs: QueuedJob[]): QueuedJob[] {
  return jobs.filter(job => {
    // Jobs marked as running or scheduled but no active process
    if (job.status === 'running' || job.status === 'scheduled') {
      return true
    }
    return false
  })
}

/**
 * Start periodic persistence
 */
let persistenceInterval: ReturnType<typeof setInterval> | null = null

export function startPeriodicPersistence(queue: RuntimeQueue, intervalMs = 5000): void {
  if (persistenceInterval) {
    clearInterval(persistenceInterval)
  }

  persistenceInterval = setInterval(() => {
    try {
      saveQueueState(queue)
    } catch (err) {
      console.error('[Persistence] Error saving queue state:', err)
    }
  }, intervalMs)

  console.log(`[Persistence] Started periodic save (every ${intervalMs}ms)`)
}

/**
 * Stop periodic persistence
 */
export function stopPeriodicPersistence(): void {
  if (persistenceInterval) {
    clearInterval(persistenceInterval)
    persistenceInterval = null
    console.log('[Persistence] Stopped periodic save')
  }
}

/**
 * Initialize persistence (load state)
 */
export function initializePersistence(queue: RuntimeQueue): {
  loadedJobs: number
  orphanedJobs: number
  deadLetterCount: number
} {
  // Load queue state
  const jobs = loadQueueState()
  const orphanedJobs = findOrphanedJobs(jobs)

  // Reset orphaned jobs to pending/retrying
  const recoveredJobs = jobs.map(job => {
    if (orphanedJobs.includes(job)) {
      console.log(`[Persistence] Recovering orphaned job ${job.id} (was ${job.status})`)
      return {
        ...job,
        status: 'pending' as JobStatus,
        scheduledAt: undefined,
        startedAt: undefined
      }
    }
    return job
  })

  // Load into queue
  queue.loadJobs(recoveredJobs)

  // Load dead letter state
  loadDeadLetterState()

  return {
    loadedJobs: jobs.length,
    orphanedJobs: orphanedJobs.length,
    deadLetterCount: deadLetterCache.length
  }
}
