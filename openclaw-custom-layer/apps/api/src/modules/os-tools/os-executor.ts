/**
 * OS Tools Executor
 * FEATURE 110: Controlled OS Tools v1
 *
 * Executes OS tools using child_process.spawn (not exec)
 * for controlled, safer execution.
 */

import { spawn } from 'child_process'
import type {
  OSCapabilityKey,
  OSExecutionResult,
  OSToolPendingConfirmation,
  Platform
} from './types'
import {
  getCurrentPlatform,
  getOSToolConfig,
  isOSToolCapability,
  isOSToolSupportedOnPlatform
} from './os-whitelist'

// In-memory store for pending confirmations
const pendingConfirmations: Map<string, OSToolPendingConfirmation> = new Map()

// Confirmation timeout (5 minutes)
const CONFIRMATION_TIMEOUT_MS = 5 * 60 * 1000

/**
 * Generate unique confirmation ID
 */
function generateConfirmationId(): string {
  return `os-confirm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Execute OS tool directly (for passthrough mode or after confirmation)
 */
export async function executeOSTool(
  capabilityKey: OSCapabilityKey,
  platform?: Platform
): Promise<OSExecutionResult> {
  const startTime = Date.now()
  const targetPlatform = platform || getCurrentPlatform()

  console.log(`[OS-EXECUTOR] Executing ${capabilityKey} on ${targetPlatform}`)

  // Validate capability key
  if (!isOSToolCapability(capabilityKey)) {
    return {
      success: false,
      capabilityKey,
      platform: targetPlatform,
      command: '',
      args: [],
      error: `Invalid OS tool capability: ${capabilityKey}`,
      executedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime
    }
  }

  // Get tool config
  const config = getOSToolConfig(capabilityKey)
  if (!config) {
    return {
      success: false,
      capabilityKey,
      platform: targetPlatform,
      command: '',
      args: [],
      error: `OS tool config not found: ${capabilityKey}`,
      executedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime
    }
  }

  // Check platform support
  if (!isOSToolSupportedOnPlatform(capabilityKey, targetPlatform)) {
    return {
      success: false,
      capabilityKey,
      platform: targetPlatform,
      command: '',
      args: [],
      error: `OS tool ${capabilityKey} not supported on platform ${targetPlatform}`,
      executedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime
    }
  }

  const platformConfig = config.platforms[targetPlatform]!
  const { command, args } = platformConfig

  console.log(`[OS-EXECUTOR] Running: ${command} ${args.join(' ')}`)

  return new Promise(resolve => {
    try {
      const child = spawn(command, args, {
        detached: true,
        stdio: 'ignore',
        // Don't inherit shell - direct execution is safer
        shell: false
      })

      // Let the process run independently
      child.unref()

      // Give it a moment to start
      setTimeout(() => {
        resolve({
          success: true,
          capabilityKey,
          platform: targetPlatform,
          command,
          args,
          exitCode: 0,
          stdout: '',
          stderr: '',
          executedAt: new Date().toISOString(),
          durationMs: Date.now() - startTime
        })
      }, 200)

      child.on('error', error => {
        console.error(`[OS-EXECUTOR] Spawn error for ${capabilityKey}:`, error)
        resolve({
          success: false,
          capabilityKey,
          platform: targetPlatform,
          command,
          args,
          error: `Failed to start: ${error.message}`,
          executedAt: new Date().toISOString(),
          durationMs: Date.now() - startTime
        })
      })
    } catch (error) {
      console.error(`[OS-EXECUTOR] Exception for ${capabilityKey}:`, error)
      resolve({
        success: false,
        capabilityKey,
        platform: targetPlatform,
        command,
        args,
        error: `Exception: ${error instanceof Error ? error.message : String(error)}`,
        executedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime
      })
    }
  })
}

/**
 * Create a pending confirmation for OS tool execution
 * Used in strict mode when capability requires confirmation
 */
export function createPendingConfirmation(
  tenantId: string,
  sessionId: string,
  capabilityKey: OSCapabilityKey
): OSToolPendingConfirmation | null {
  const config = getOSToolConfig(capabilityKey)
  if (!config) {
    return null
  }

  const platform = getCurrentPlatform()
  const platformConfig = config.platforms[platform]
  if (!platformConfig) {
    return null
  }

  const id = generateConfirmationId()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + CONFIRMATION_TIMEOUT_MS)

  const confirmation: OSToolPendingConfirmation = {
    id,
    tenantId,
    sessionId,
    capabilityKey,
    displayName: config.displayName,
    description: config.description,
    platform,
    command: platformConfig.command,
    args: platformConfig.args,
    riskLevel: config.riskLevel,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    status: 'pending'
  }

  pendingConfirmations.set(id, confirmation)
  console.log(`[OS-EXECUTOR] Created confirmation ${id} for ${capabilityKey}`)

  return confirmation
}

/**
 * Get pending confirmation by ID
 */
export function getPendingConfirmation(
  confirmationId: string
): OSToolPendingConfirmation | null {
  const confirmation = pendingConfirmations.get(confirmationId)
  if (!confirmation) {
    return null
  }

  // Check if expired
  if (new Date() > new Date(confirmation.expiresAt)) {
    confirmation.status = 'expired'
    pendingConfirmations.set(confirmationId, confirmation)
    return confirmation
  }

  return confirmation
}

/**
 * Confirm OS tool execution
 */
export async function confirmOSToolExecution(
  confirmationId: string
): Promise<OSExecutionResult | null> {
  const confirmation = getPendingConfirmation(confirmationId)
  if (!confirmation) {
    return null
  }

  if (confirmation.status !== 'pending') {
    console.log(`[OS-EXECUTOR] Confirmation ${confirmationId} is ${confirmation.status}`)
    return null
  }

  // Mark as confirmed
  confirmation.status = 'confirmed'
  pendingConfirmations.set(confirmationId, confirmation)

  // Execute
  const result = await executeOSTool(confirmation.capabilityKey, confirmation.platform)

  console.log(`[OS-EXECUTOR] Confirmed and executed ${confirmation.capabilityKey}`)
  return result
}

/**
 * Reject OS tool execution
 */
export function rejectOSToolExecution(confirmationId: string): boolean {
  const confirmation = getPendingConfirmation(confirmationId)
  if (!confirmation || confirmation.status !== 'pending') {
    return false
  }

  confirmation.status = 'rejected'
  pendingConfirmations.set(confirmationId, confirmation)
  console.log(`[OS-EXECUTOR] Rejected ${confirmation.capabilityKey}`)
  return true
}

/**
 * Get all pending confirmations for a tenant/session
 */
export function getPendingConfirmationsForSession(
  tenantId: string,
  sessionId: string
): OSToolPendingConfirmation[] {
  const result: OSToolPendingConfirmation[] = []
  const now = new Date()

  pendingConfirmations.forEach(confirmation => {
    if (
      confirmation.tenantId === tenantId &&
      confirmation.sessionId === sessionId &&
      confirmation.status === 'pending'
    ) {
      // Check expiration
      if (now > new Date(confirmation.expiresAt)) {
        confirmation.status = 'expired'
        pendingConfirmations.set(confirmation.id, confirmation)
      } else {
        result.push(confirmation)
      }
    }
  })

  return result
}

/**
 * Clean up old confirmations (expired, confirmed, rejected)
 */
export function cleanupOldConfirmations(): number {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  let deleted = 0

  pendingConfirmations.forEach((confirmation, id) => {
    const createdAt = new Date(confirmation.createdAt)
    if (createdAt < oneHourAgo || confirmation.status !== 'pending') {
      pendingConfirmations.delete(id)
      deleted++
    }
  })

  if (deleted > 0) {
    console.log(`[OS-EXECUTOR] Cleaned up ${deleted} old confirmations`)
  }

  return deleted
}
