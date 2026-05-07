/**
 * FTP/SFTP Channel
 * P3: Real Integrations & Operational Channels
 *
 * File transfer integration via FTP/SFTP.
 */

import type {
  FtpFile,
  FtpTransferResult,
  ChannelType
} from '../../channels-runtime/types'
import { emitChannelEvent } from '../../channels-runtime/event-adapter'
import { enqueueChannelAction } from '../../channels-runtime/runtime-integration'
import { getChannel, updateChannelMetrics } from '../../channels-runtime/channel-manager'

/**
 * FTP channel configuration
 */
export interface FtpChannelConfig {
  host: string
  port: number
  secure: boolean // true for SFTP/FTPS
  basePath: string
  username: string
  // Password/key comes from credentials vault
}

/**
 * Sync configuration
 */
export interface SyncConfig {
  localPath: string
  remotePath: string
  direction: 'upload' | 'download' | 'bidirectional'
  deleteOrphans: boolean
  includePatterns?: string[]
  excludePatterns?: string[]
}

/**
 * Upload a file
 */
export async function uploadFile(
  channelId: string,
  localPath: string,
  remotePath: string,
  options: {
    userId?: string
    overwrite?: boolean
    createDirs?: boolean
  } = {}
): Promise<{ queued: boolean; requestId?: string; error?: string }> {
  const channel = getChannel(channelId)
  if (!channel) {
    return { queued: false, error: 'Channel not found' }
  }

  const channelType = channel.config.type
  if (channelType !== 'ftp' && channelType !== 'sftp') {
    return { queued: false, error: 'Not an FTP/SFTP channel' }
  }

  return enqueueChannelAction(
    channel.config,
    'upload',
    { localPath, remotePath, overwrite: options.overwrite, createDirs: options.createDirs },
    { userId: options.userId }
  )
}

/**
 * Download a file
 */
export async function downloadFile(
  channelId: string,
  remotePath: string,
  localPath: string,
  options: {
    userId?: string
    overwrite?: boolean
  } = {}
): Promise<{ queued: boolean; requestId?: string; error?: string }> {
  const channel = getChannel(channelId)
  if (!channel) {
    return { queued: false, error: 'Channel not found' }
  }

  return enqueueChannelAction(
    channel.config,
    'download',
    { remotePath, localPath, overwrite: options.overwrite },
    { userId: options.userId }
  )
}

/**
 * List directory contents
 */
export async function listDirectory(
  channelId: string,
  remotePath: string
): Promise<FtpFile[]> {
  const channel = getChannel(channelId)
  if (!channel) return []

  // TODO: Implement actual FTP listing
  console.log(`[FtpChannel] Listing directory: ${remotePath} on ${channelId}`)
  return []
}

/**
 * Delete a file
 */
export async function deleteFile(
  channelId: string,
  remotePath: string,
  options: {
    userId?: string
  } = {}
): Promise<{ queued: boolean; requestId?: string; error?: string }> {
  const channel = getChannel(channelId)
  if (!channel) {
    return { queued: false, error: 'Channel not found' }
  }

  return enqueueChannelAction(
    channel.config,
    'delete',
    { remotePath },
    { userId: options.userId, priority: 'high' }
  )
}

/**
 * Create directory
 */
export async function createDirectory(
  channelId: string,
  remotePath: string
): Promise<{ queued: boolean; requestId?: string; error?: string }> {
  const channel = getChannel(channelId)
  if (!channel) {
    return { queued: false, error: 'Channel not found' }
  }

  return enqueueChannelAction(
    channel.config,
    'mkdir',
    { remotePath },
    {}
  )
}

/**
 * Rename/move a file
 */
export async function renameFile(
  channelId: string,
  oldPath: string,
  newPath: string
): Promise<{ queued: boolean; requestId?: string; error?: string }> {
  const channel = getChannel(channelId)
  if (!channel) {
    return { queued: false, error: 'Channel not found' }
  }

  return enqueueChannelAction(
    channel.config,
    'rename',
    { oldPath, newPath },
    {}
  )
}

/**
 * Sync files between local and remote
 */
export async function syncFiles(
  channelId: string,
  config: SyncConfig,
  options: {
    userId?: string
    dryRun?: boolean
  } = {}
): Promise<{ queued: boolean; requestId?: string; error?: string }> {
  const channel = getChannel(channelId)
  if (!channel) {
    return { queued: false, error: 'Channel not found' }
  }

  return enqueueChannelAction(
    channel.config,
    'sync',
    { ...config, dryRun: options.dryRun },
    { userId: options.userId, priority: 'normal' }
  )
}

/**
 * Deploy files (specialized upload for web deployments)
 */
export async function deployFiles(
  channelId: string,
  params: {
    localPath: string
    remotePath: string
    backupExisting?: boolean
    validateAfter?: boolean
    rollbackOnError?: boolean
  },
  options: {
    userId?: string
  } = {}
): Promise<{ queued: boolean; requestId?: string; error?: string }> {
  const channel = getChannel(channelId)
  if (!channel) {
    return { queued: false, error: 'Channel not found' }
  }

  // Deployments always require approval by default
  return enqueueChannelAction(
    channel.config,
    'deploy',
    params,
    { userId: options.userId, priority: 'high' }
  )
}

/**
 * Verify file exists
 */
export async function verifyFile(
  channelId: string,
  remotePath: string
): Promise<{ exists: boolean; file?: FtpFile; error?: string }> {
  const channel = getChannel(channelId)
  if (!channel) {
    return { exists: false, error: 'Channel not found' }
  }

  // TODO: Implement actual verification
  console.log(`[FtpChannel] Verifying file: ${remotePath} on ${channelId}`)
  return { exists: false }
}

/**
 * Handle transfer completion event
 */
export async function handleTransferComplete(
  channelId: string,
  result: FtpTransferResult,
  tenantId: string,
  action: 'upload' | 'download'
): Promise<void> {
  const eventType = action === 'upload' ? 'ftp:upload_complete' : 'ftp:download_complete'

  await emitChannelEvent(
    channelId,
    'ftp',
    eventType,
    result,
    {
      tenantId,
      metadata: {
        path: result.path,
        bytesTransferred: result.bytesTransferred,
        durationMs: result.durationMs
      }
    }
  )

  // Update metrics
  const channel = getChannel(channelId)
  if (channel) {
    updateChannelMetrics(channelId, {
      messagesProcessed: (channel.metrics?.messagesProcessed || 0) + 1,
      avgResponseMs: result.durationMs
    })
  }

  console.log(`[FtpChannel] Transfer complete: ${action} ${result.path}`)
}

/**
 * Handle sync completion event
 */
export async function handleSyncComplete(
  channelId: string,
  results: {
    uploaded: number
    downloaded: number
    deleted: number
    errors: number
    durationMs: number
  },
  tenantId: string
): Promise<void> {
  await emitChannelEvent(
    channelId,
    'ftp',
    'ftp:sync_complete',
    results,
    {
      tenantId,
      metadata: {
        totalFiles: results.uploaded + results.downloaded,
        hasErrors: results.errors > 0
      }
    }
  )

  console.log(`[FtpChannel] Sync complete: ${results.uploaded} up, ${results.downloaded} down`)
}

/**
 * Handle deployment failure
 */
export async function handleDeploymentFailed(
  channelId: string,
  error: string,
  tenantId: string,
  rollbackPerformed: boolean
): Promise<void> {
  await emitChannelEvent(
    channelId,
    'ftp',
    'ftp:deployment_failed',
    {
      error,
      rollbackPerformed,
      timestamp: new Date().toISOString()
    },
    {
      tenantId
    }
  )

  // Update channel metrics
  const channel = getChannel(channelId)
  if (channel) {
    updateChannelMetrics(channelId, {
      errorsLastHour: (channel.metrics?.errorsLastHour || 0) + 1
    })
  }

  console.error(`[FtpChannel] Deployment failed: ${error}`)
}

/**
 * Get transfer history for channel
 */
export function getTransferHistory(
  channelId: string,
  limit = 50
): Array<{
  type: 'upload' | 'download' | 'sync' | 'deploy'
  path: string
  timestamp: string
  success: boolean
  bytesTransferred?: number
}> {
  // TODO: Implement persistent history
  // For now return from recent events
  return []
}
