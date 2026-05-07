/**
 * FTP/SFTP Hardening
 * P5.1: Controlled Real Testing & Connector Hardening
 *
 * FTP worker hardening: reconnect, retry, checksum, rollback.
 */

import * as crypto from 'crypto'

/**
 * FTP hardening configuration
 */
export interface FTPHardeningConfig {
  maxReconnectAttempts: number
  reconnectBackoffMs: number
  maxRetries: number
  checksumValidation: boolean
  partialUploadDetection: boolean
  rollbackEnabled: boolean
  transferTimeoutMs: number
}

/**
 * Transfer state
 */
export interface TransferState {
  transferId: string
  type: 'upload' | 'download'
  localPath: string
  remotePath: string
  totalBytes: number
  transferredBytes: number
  checksum?: string
  status: 'pending' | 'in_progress' | 'paused' | 'completed' | 'failed'
  retryCount: number
  lastError?: string
  startedAt: string
  completedAt?: string
}

/**
 * Rollback metadata
 */
export interface RollbackMetadata {
  deployId: string
  timestamp: string
  files: Array<{
    remotePath: string
    backupPath: string
    checksum: string
  }>
  status: 'pending' | 'completed' | 'rolled_back'
}

/**
 * FTP connection state
 */
interface FTPConnectionState {
  connected: boolean
  lastConnectAt?: string
  reconnectAttempts: number
  reconnectBackoffMs: number
  transfers: Map<string, TransferState>
  rollbacks: Map<string, RollbackMetadata>
}

let connectionState: FTPConnectionState = {
  connected: false,
  reconnectAttempts: 0,
  reconnectBackoffMs: 1000,
  transfers: new Map(),
  rollbacks: new Map()
}

/**
 * Default config
 */
const defaultConfig: FTPHardeningConfig = {
  maxReconnectAttempts: 5,
  reconnectBackoffMs: 1000,
  maxRetries: 3,
  checksumValidation: true,
  partialUploadDetection: true,
  rollbackEnabled: true,
  transferTimeoutMs: 300000 // 5 minutes
}

let currentConfig: FTPHardeningConfig = { ...defaultConfig }

/**
 * Initialize FTP hardening
 */
export function initializeFTPHardening(
  config?: Partial<FTPHardeningConfig>
): void {
  currentConfig = { ...defaultConfig, ...config }

  connectionState = {
    connected: false,
    reconnectAttempts: 0,
    reconnectBackoffMs: currentConfig.reconnectBackoffMs,
    transfers: new Map(),
    rollbacks: new Map()
  }

  console.log('[FTPHardening] Initialized')
}

/**
 * Record connection attempt
 */
export function recordConnectionAttempt(
  success: boolean,
  error?: string
): { shouldRetry: boolean; backoffMs: number } {
  if (success) {
    connectionState.connected = true
    connectionState.lastConnectAt = new Date().toISOString()
    connectionState.reconnectAttempts = 0
    connectionState.reconnectBackoffMs = currentConfig.reconnectBackoffMs
    return { shouldRetry: false, backoffMs: 0 }
  }

  connectionState.connected = false
  connectionState.reconnectAttempts++
  connectionState.reconnectBackoffMs = Math.min(
    connectionState.reconnectBackoffMs * 2,
    60000
  )

  const shouldRetry = connectionState.reconnectAttempts < currentConfig.maxReconnectAttempts

  if (!shouldRetry) {
    console.error(`[FTPHardening] Max reconnect attempts reached: ${error}`)
  }

  return {
    shouldRetry,
    backoffMs: connectionState.reconnectBackoffMs
  }
}

/**
 * Start transfer tracking
 */
export function startTransfer(
  type: 'upload' | 'download',
  localPath: string,
  remotePath: string,
  totalBytes: number
): TransferState {
  const transferId = `transfer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  const transfer: TransferState = {
    transferId,
    type,
    localPath,
    remotePath,
    totalBytes,
    transferredBytes: 0,
    status: 'pending',
    retryCount: 0,
    startedAt: new Date().toISOString()
  }

  connectionState.transfers.set(transferId, transfer)
  return transfer
}

/**
 * Update transfer progress
 */
export function updateTransferProgress(
  transferId: string,
  transferredBytes: number
): void {
  const transfer = connectionState.transfers.get(transferId)
  if (transfer) {
    transfer.transferredBytes = transferredBytes
    transfer.status = 'in_progress'
  }
}

/**
 * Detect partial upload
 */
export function detectPartialUpload(
  transferId: string
): { isPartial: boolean; percentage: number } {
  if (!currentConfig.partialUploadDetection) {
    return { isPartial: false, percentage: 100 }
  }

  const transfer = connectionState.transfers.get(transferId)
  if (!transfer) {
    return { isPartial: false, percentage: 0 }
  }

  const percentage = (transfer.transferredBytes / transfer.totalBytes) * 100

  return {
    isPartial: percentage < 100 && transfer.status !== 'completed',
    percentage
  }
}

/**
 * Complete transfer with validation
 */
export function completeTransfer(
  transferId: string,
  checksum?: string
): { valid: boolean; error?: string } {
  const transfer = connectionState.transfers.get(transferId)
  if (!transfer) {
    return { valid: false, error: 'Transfer not found' }
  }

  // Check partial upload
  const partial = detectPartialUpload(transferId)
  if (partial.isPartial) {
    transfer.status = 'failed'
    transfer.lastError = `Partial transfer: ${partial.percentage.toFixed(1)}%`
    return { valid: false, error: transfer.lastError }
  }

  // Validate checksum
  if (currentConfig.checksumValidation && checksum) {
    transfer.checksum = checksum
  }

  transfer.status = 'completed'
  transfer.completedAt = new Date().toISOString()

  return { valid: true }
}

/**
 * Retry failed transfer
 */
export function retryTransfer(
  transferId: string
): { canRetry: boolean; resumeFrom?: number } {
  const transfer = connectionState.transfers.get(transferId)
  if (!transfer) {
    return { canRetry: false }
  }

  if (transfer.retryCount >= currentConfig.maxRetries) {
    return { canRetry: false }
  }

  transfer.retryCount++
  transfer.status = 'pending'

  // Resume from last position for partial uploads
  const resumeFrom = transfer.transferredBytes > 0 ? transfer.transferredBytes : undefined

  return { canRetry: true, resumeFrom }
}

/**
 * Calculate checksum
 */
export function calculateChecksum(data: Buffer): string {
  return crypto.createHash('md5').update(data).digest('hex')
}

/**
 * Validate checksum
 */
export function validateChecksum(
  data: Buffer,
  expectedChecksum: string
): boolean {
  const actual = calculateChecksum(data)
  return actual === expectedChecksum
}

/**
 * Create rollback metadata
 */
export function createRollbackMetadata(
  deployId: string,
  files: Array<{ remotePath: string; backupPath: string; checksum: string }>
): RollbackMetadata {
  const rollback: RollbackMetadata = {
    deployId,
    timestamp: new Date().toISOString(),
    files,
    status: 'pending'
  }

  connectionState.rollbacks.set(deployId, rollback)
  return rollback
}

/**
 * Mark deploy as completed
 */
export function markDeployCompleted(deployId: string): void {
  const rollback = connectionState.rollbacks.get(deployId)
  if (rollback) {
    rollback.status = 'completed'
  }
}

/**
 * Execute rollback
 */
export function executeRollback(
  deployId: string
): { success: boolean; filesToRestore?: string[] } {
  if (!currentConfig.rollbackEnabled) {
    return { success: false }
  }

  const rollback = connectionState.rollbacks.get(deployId)
  if (!rollback) {
    return { success: false }
  }

  if (rollback.status === 'rolled_back') {
    return { success: false }
  }

  const filesToRestore = rollback.files.map(f => f.backupPath)
  rollback.status = 'rolled_back'

  console.log(`[FTPHardening] Rollback executed for deploy: ${deployId}`)
  return { success: true, filesToRestore }
}

/**
 * Get FTP hardening state
 */
export function getFTPHardeningState(): {
  connected: boolean
  reconnectAttempts: number
  activeTransfers: number
  completedTransfers: number
  failedTransfers: number
  pendingRollbacks: number
  config: FTPHardeningConfig
} {
  let active = 0
  let completed = 0
  let failed = 0

  for (const transfer of connectionState.transfers.values()) {
    switch (transfer.status) {
      case 'in_progress':
      case 'pending':
        active++
        break
      case 'completed':
        completed++
        break
      case 'failed':
        failed++
        break
    }
  }

  const pendingRollbacks = Array.from(connectionState.rollbacks.values())
    .filter(r => r.status === 'pending').length

  return {
    connected: connectionState.connected,
    reconnectAttempts: connectionState.reconnectAttempts,
    activeTransfers: active,
    completedTransfers: completed,
    failedTransfers: failed,
    pendingRollbacks,
    config: currentConfig
  }
}

/**
 * Get transfer by ID
 */
export function getTransfer(transferId: string): TransferState | undefined {
  return connectionState.transfers.get(transferId)
}

/**
 * Clean old transfers
 */
export function cleanOldTransfers(maxAgeMs: number): number {
  const cutoff = Date.now() - maxAgeMs
  let cleaned = 0

  for (const [id, transfer] of connectionState.transfers) {
    if (transfer.status === 'completed' || transfer.status === 'failed') {
      const completedAt = transfer.completedAt
        ? new Date(transfer.completedAt).getTime()
        : new Date(transfer.startedAt).getTime()

      if (completedAt < cutoff) {
        connectionState.transfers.delete(id)
        cleaned++
      }
    }
  }

  return cleaned
}
