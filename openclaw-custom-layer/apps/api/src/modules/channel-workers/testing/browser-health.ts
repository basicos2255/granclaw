/**
 * Browser Health & Hardening
 * P5.1: Controlled Real Testing & Connector Hardening
 *
 * Browser worker hardening: crash recovery, memory management, etc.
 */

/**
 * Browser health configuration
 */
export interface BrowserHealthConfig {
  maxMemoryMB: number
  contextReuseEnabled: boolean
  maxContextAge: number
  screenshotOnFailure: boolean
  maxRetries: number
  downloadRecoveryEnabled: boolean
  crashRecoveryEnabled: boolean
  memoryCheckIntervalMs: number
}

/**
 * Browser context state
 */
export interface BrowserContextState {
  contextId: string
  createdAt: string
  lastUsedAt: string
  pageCount: number
  memoryUsageMB: number
  crashed: boolean
  recoveryAttempts: number
}

/**
 * Browser crash record
 */
export interface BrowserCrashRecord {
  timestamp: string
  contextId: string
  errorMessage: string
  screenshotPath?: string
  recovered: boolean
  recoveryTime?: number
}

/**
 * Download recovery state
 */
export interface DownloadRecoveryState {
  downloadId: string
  url: string
  filename: string
  bytesDownloaded: number
  totalBytes: number
  status: 'in_progress' | 'paused' | 'failed' | 'completed'
  retryCount: number
  lastError?: string
}

/**
 * Browser health state
 */
interface BrowserHealthState {
  contexts: Map<string, BrowserContextState>
  crashes: BrowserCrashRecord[]
  downloads: Map<string, DownloadRecoveryState>
  totalMemoryMB: number
  lastMemoryCheck: string
  memoryLeakDetected: boolean
}

let healthState: BrowserHealthState = {
  contexts: new Map(),
  crashes: [],
  downloads: new Map(),
  totalMemoryMB: 0,
  lastMemoryCheck: new Date().toISOString(),
  memoryLeakDetected: false
}

/**
 * Default config
 */
const defaultConfig: BrowserHealthConfig = {
  maxMemoryMB: 1024,
  contextReuseEnabled: true,
  maxContextAge: 3600000, // 1 hour
  screenshotOnFailure: true,
  maxRetries: 3,
  downloadRecoveryEnabled: true,
  crashRecoveryEnabled: true,
  memoryCheckIntervalMs: 60000
}

let currentConfig: BrowserHealthConfig = { ...defaultConfig }
let memoryCheckInterval: ReturnType<typeof setInterval> | null = null

/**
 * Initialize browser health
 */
export function initializeBrowserHealth(
  config?: Partial<BrowserHealthConfig>
): void {
  currentConfig = { ...defaultConfig, ...config }

  healthState = {
    contexts: new Map(),
    crashes: [],
    downloads: new Map(),
    totalMemoryMB: 0,
    lastMemoryCheck: new Date().toISOString(),
    memoryLeakDetected: false
  }

  // Start memory monitoring
  if (memoryCheckInterval) {
    clearInterval(memoryCheckInterval)
  }

  memoryCheckInterval = setInterval(() => {
    checkMemoryUsage()
  }, currentConfig.memoryCheckIntervalMs)

  console.log('[BrowserHealth] Initialized')
}

/**
 * Stop browser health monitoring
 */
export function stopBrowserHealth(): void {
  if (memoryCheckInterval) {
    clearInterval(memoryCheckInterval)
    memoryCheckInterval = null
  }
}

/**
 * Register browser context
 */
export function registerContext(contextId: string): BrowserContextState {
  const now = new Date().toISOString()

  const context: BrowserContextState = {
    contextId,
    createdAt: now,
    lastUsedAt: now,
    pageCount: 0,
    memoryUsageMB: 0,
    crashed: false,
    recoveryAttempts: 0
  }

  healthState.contexts.set(contextId, context)
  return context
}

/**
 * Get reusable context (if available)
 */
export function getReusableContext(): BrowserContextState | undefined {
  if (!currentConfig.contextReuseEnabled) {
    return undefined
  }

  const now = Date.now()
  const maxAge = currentConfig.maxContextAge

  for (const context of healthState.contexts.values()) {
    if (context.crashed) continue

    const age = now - new Date(context.createdAt).getTime()
    if (age < maxAge) {
      context.lastUsedAt = new Date().toISOString()
      return context
    }
  }

  return undefined
}

/**
 * Update context usage
 */
export function updateContextUsage(
  contextId: string,
  memoryMB: number,
  pageCount: number
): void {
  const context = healthState.contexts.get(contextId)
  if (context) {
    context.lastUsedAt = new Date().toISOString()
    context.memoryUsageMB = memoryMB
    context.pageCount = pageCount
  }
}

/**
 * Record browser crash
 */
export function recordCrash(
  contextId: string,
  errorMessage: string,
  screenshotPath?: string
): BrowserCrashRecord {
  const crash: BrowserCrashRecord = {
    timestamp: new Date().toISOString(),
    contextId,
    errorMessage,
    screenshotPath,
    recovered: false
  }

  healthState.crashes.push(crash)

  // Mark context as crashed
  const context = healthState.contexts.get(contextId)
  if (context) {
    context.crashed = true
  }

  // Keep only last 100 crashes
  if (healthState.crashes.length > 100) {
    healthState.crashes = healthState.crashes.slice(-100)
  }

  console.log(`[BrowserHealth] Crash recorded: ${errorMessage}`)
  return crash
}

/**
 * Attempt crash recovery
 */
export function attemptCrashRecovery(
  contextId: string
): { success: boolean; newContextId?: string; error?: string } {
  if (!currentConfig.crashRecoveryEnabled) {
    return { success: false, error: 'Crash recovery disabled' }
  }

  const context = healthState.contexts.get(contextId)
  if (!context) {
    return { success: false, error: 'Context not found' }
  }

  if (context.recoveryAttempts >= currentConfig.maxRetries) {
    return { success: false, error: 'Max recovery attempts exceeded' }
  }

  context.recoveryAttempts++

  // In real implementation: recreate browser context
  const newContextId = `recovered_${contextId}_${Date.now()}`
  const newContext = registerContext(newContextId)

  // Update crash record
  const lastCrash = healthState.crashes.find(
    c => c.contextId === contextId && !c.recovered
  )
  if (lastCrash) {
    lastCrash.recovered = true
    lastCrash.recoveryTime = Date.now() - new Date(lastCrash.timestamp).getTime()
  }

  console.log(`[BrowserHealth] Crash recovered: ${contextId} -> ${newContextId}`)
  return { success: true, newContextId }
}

/**
 * Track download
 */
export function trackDownload(
  downloadId: string,
  url: string,
  filename: string,
  totalBytes: number
): DownloadRecoveryState {
  const download: DownloadRecoveryState = {
    downloadId,
    url,
    filename,
    bytesDownloaded: 0,
    totalBytes,
    status: 'in_progress',
    retryCount: 0
  }

  healthState.downloads.set(downloadId, download)
  return download
}

/**
 * Update download progress
 */
export function updateDownloadProgress(
  downloadId: string,
  bytesDownloaded: number,
  status?: DownloadRecoveryState['status']
): void {
  const download = healthState.downloads.get(downloadId)
  if (download) {
    download.bytesDownloaded = bytesDownloaded
    if (status) download.status = status
  }
}

/**
 * Attempt download recovery
 */
export function attemptDownloadRecovery(
  downloadId: string
): { canRetry: boolean; resumeFrom?: number } {
  if (!currentConfig.downloadRecoveryEnabled) {
    return { canRetry: false }
  }

  const download = healthState.downloads.get(downloadId)
  if (!download) {
    return { canRetry: false }
  }

  if (download.retryCount >= currentConfig.maxRetries) {
    return { canRetry: false }
  }

  download.retryCount++
  download.status = 'in_progress'

  return {
    canRetry: true,
    resumeFrom: download.bytesDownloaded
  }
}

/**
 * Check memory usage
 */
function checkMemoryUsage(): void {
  let totalMemory = 0

  for (const context of healthState.contexts.values()) {
    if (!context.crashed) {
      totalMemory += context.memoryUsageMB
    }
  }

  const previousMemory = healthState.totalMemoryMB
  healthState.totalMemoryMB = totalMemory
  healthState.lastMemoryCheck = new Date().toISOString()

  // Detect memory leak (continuous growth)
  if (totalMemory > previousMemory * 1.2 && totalMemory > currentConfig.maxMemoryMB * 0.8) {
    healthState.memoryLeakDetected = true
    console.warn(`[BrowserHealth] Potential memory leak: ${totalMemory}MB`)
  }

  // Alert if over limit
  if (totalMemory > currentConfig.maxMemoryMB) {
    console.error(`[BrowserHealth] Memory limit exceeded: ${totalMemory}MB > ${currentConfig.maxMemoryMB}MB`)
  }
}

/**
 * Clean up old contexts
 */
export function cleanupOldContexts(): number {
  const now = Date.now()
  const maxAge = currentConfig.maxContextAge
  let cleaned = 0

  for (const [id, context] of healthState.contexts) {
    const age = now - new Date(context.createdAt).getTime()
    if (age > maxAge || context.crashed) {
      healthState.contexts.delete(id)
      cleaned++
    }
  }

  if (cleaned > 0) {
    console.log(`[BrowserHealth] Cleaned up ${cleaned} old contexts`)
  }

  return cleaned
}

/**
 * Get browser health state
 */
export function getBrowserHealthState(): {
  contextCount: number
  crashCount: number
  activeDownloads: number
  totalMemoryMB: number
  memoryLeakDetected: boolean
  config: BrowserHealthConfig
} {
  return {
    contextCount: healthState.contexts.size,
    crashCount: healthState.crashes.length,
    activeDownloads: Array.from(healthState.downloads.values())
      .filter(d => d.status === 'in_progress').length,
    totalMemoryMB: healthState.totalMemoryMB,
    memoryLeakDetected: healthState.memoryLeakDetected,
    config: currentConfig
  }
}

/**
 * Get recent crashes
 */
export function getRecentCrashes(limit = 10): BrowserCrashRecord[] {
  return healthState.crashes.slice(-limit)
}
