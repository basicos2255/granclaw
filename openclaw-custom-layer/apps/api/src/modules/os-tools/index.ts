/**
 * OS Tools Module
 * FEATURE 110: Controlled OS Tools v1
 *
 * Provides controlled access to OS applications via whitelist.
 * Integrates with capabilities system for approval workflow.
 */

export * from './types'
export * from './os-whitelist'
export {
  executeOSTool,
  createPendingConfirmation,
  getPendingConfirmation,
  confirmOSToolExecution,
  rejectOSToolExecution,
  getPendingConfirmationsForSession,
  cleanupOldConfirmations
} from './os-executor'
export {
  handleGetOSTools,
  handleGetPendingConfirmations,
  handleConfirmOSTool,
  handleCleanupOSTools
} from './routes'
