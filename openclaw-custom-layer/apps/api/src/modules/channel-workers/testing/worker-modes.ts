/**
 * Worker Mode Configuration
 * P5.1: Controlled Real Testing & Connector Hardening
 *
 * Each worker declares supported modes and current mode.
 */

import type { ChannelType } from '../../channels-runtime/types'
import type { RuntimeEnvironment } from './environments'
import { getCurrentEnvironment, getEnvironmentConfig } from './environments'

/**
 * Worker mode capabilities
 */
export interface WorkerModeCapabilities {
  channelType: ChannelType
  supportedModes: RuntimeEnvironment[]
  currentMode: RuntimeEnvironment
  modeFeatures: Record<RuntimeEnvironment, WorkerModeFeatures>
}

/**
 * Features available in each mode
 */
export interface WorkerModeFeatures {
  canConnect: boolean
  canSend: boolean
  canReceive: boolean
  canPoll: boolean
  usesRealCredentials: boolean
  mockResponses: boolean
}

/**
 * Worker mode registry
 */
const workerModes: Map<ChannelType, WorkerModeCapabilities> = new Map()

/**
 * Default mode features
 */
const defaultModeFeatures: Record<RuntimeEnvironment, WorkerModeFeatures> = {
  simulation: {
    canConnect: true,
    canSend: true,
    canReceive: true,
    canPoll: true,
    usesRealCredentials: false,
    mockResponses: true
  },
  sandbox: {
    canConnect: true,
    canSend: true,
    canReceive: true,
    canPoll: true,
    usesRealCredentials: true,
    mockResponses: false
  },
  controlled_real: {
    canConnect: true,
    canSend: true,
    canReceive: true,
    canPoll: true,
    usesRealCredentials: true,
    mockResponses: false
  },
  production: {
    canConnect: true,
    canSend: true,
    canReceive: true,
    canPoll: true,
    usesRealCredentials: true,
    mockResponses: false
  }
}

/**
 * Register worker mode capabilities
 */
export function registerWorkerMode(
  channelType: ChannelType,
  supportedModes: RuntimeEnvironment[],
  customFeatures?: Partial<Record<RuntimeEnvironment, Partial<WorkerModeFeatures>>>
): void {
  const modeFeatures: Record<RuntimeEnvironment, WorkerModeFeatures> = {
    simulation: { ...defaultModeFeatures.simulation },
    sandbox: { ...defaultModeFeatures.sandbox },
    controlled_real: { ...defaultModeFeatures.controlled_real },
    production: { ...defaultModeFeatures.production }
  }

  // Apply custom features
  if (customFeatures) {
    for (const [mode, features] of Object.entries(customFeatures)) {
      modeFeatures[mode as RuntimeEnvironment] = {
        ...modeFeatures[mode as RuntimeEnvironment],
        ...features
      }
    }
  }

  workerModes.set(channelType, {
    channelType,
    supportedModes,
    currentMode: getCurrentEnvironment(),
    modeFeatures
  })
}

/**
 * Get worker mode capabilities
 */
export function getWorkerModeCapabilities(
  channelType: ChannelType
): WorkerModeCapabilities | undefined {
  return workerModes.get(channelType)
}

/**
 * Check if worker supports mode
 */
export function workerSupportsMode(
  channelType: ChannelType,
  mode: RuntimeEnvironment
): boolean {
  const capabilities = workerModes.get(channelType)
  if (!capabilities) return false
  return capabilities.supportedModes.includes(mode)
}

/**
 * Get worker features for current mode
 */
export function getWorkerFeatures(
  channelType: ChannelType
): WorkerModeFeatures | undefined {
  const capabilities = workerModes.get(channelType)
  if (!capabilities) return undefined

  const currentMode = getCurrentEnvironment()
  return capabilities.modeFeatures[currentMode]
}

/**
 * Check if worker can perform action in current mode
 */
export function canWorkerPerformAction(
  channelType: ChannelType,
  action: 'connect' | 'send' | 'receive' | 'poll'
): boolean {
  const features = getWorkerFeatures(channelType)
  if (!features) return false

  switch (action) {
    case 'connect':
      return features.canConnect
    case 'send':
      return features.canSend
    case 'receive':
      return features.canReceive
    case 'poll':
      return features.canPoll
    default:
      return false
  }
}

/**
 * Initialize default worker modes
 */
export function initializeWorkerModes(): void {
  // Email: supports all modes
  registerWorkerMode('email', ['simulation', 'sandbox', 'controlled_real', 'production'])

  // WhatsApp: NO production without explicit enablement
  registerWorkerMode('whatsapp', ['simulation', 'sandbox', 'controlled_real'], {
    production: {
      canConnect: false,
      canSend: false,
      canReceive: false,
      canPoll: false,
      usesRealCredentials: false,
      mockResponses: true
    }
  })

  // Browser: all modes but with restrictions
  registerWorkerMode('browser', ['simulation', 'sandbox', 'controlled_real', 'production'], {
    controlled_real: {
      canConnect: true,
      canSend: true,
      canReceive: true,
      canPoll: false, // No polling in controlled
      usesRealCredentials: true,
      mockResponses: false
    }
  })

  // FTP: all modes
  registerWorkerMode('ftp', ['simulation', 'sandbox', 'controlled_real', 'production'])
  registerWorkerMode('sftp', ['simulation', 'sandbox', 'controlled_real', 'production'])

  // Calendar: all modes
  registerWorkerMode('calendar', ['simulation', 'sandbox', 'controlled_real', 'production'])

  // Filesystem: simulation and sandbox only by default
  registerWorkerMode('filesystem', ['simulation', 'sandbox'], {
    controlled_real: {
      canConnect: false,
      canSend: false,
      canReceive: false,
      canPoll: false,
      usesRealCredentials: false,
      mockResponses: true
    },
    production: {
      canConnect: false,
      canSend: false,
      canReceive: false,
      canPoll: false,
      usesRealCredentials: false,
      mockResponses: true
    }
  })

  console.log('[WorkerModes] Initialized default worker modes')
}

/**
 * Get all registered worker modes
 */
export function getAllWorkerModes(): WorkerModeCapabilities[] {
  return Array.from(workerModes.values())
}

/**
 * Get workers that support current environment
 */
export function getWorkersForCurrentEnvironment(): ChannelType[] {
  const currentMode = getCurrentEnvironment()
  const result: ChannelType[] = []

  for (const [channelType, capabilities] of workerModes) {
    if (capabilities.supportedModes.includes(currentMode)) {
      result.push(channelType)
    }
  }

  return result
}
