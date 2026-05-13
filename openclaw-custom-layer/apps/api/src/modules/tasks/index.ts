/**
 * Tasks Module
 * FEATURE 080: Task System v1
 * FIX 126: Timeout Recovery & Multistep Task Execution
 * P6.3: Added structured result endpoint
 * P6.12: Added retry, cancel, repair endpoints
 */

export * from './types'
export * from './service'
export {
  handleGetTasks,
  handleGetTasks as handleTasks,
  handleGetTaskById,
  handleGetTaskResult,
  handleExecuteSteps,
  handleReconcileTask,
  handleReconcileAllTasks,
  // P6.12: Retry, cancel, repair handlers
  handleRetryTask,
  handleCancelTask,
  handleRepairTask,
  handleGetTaskTruth
} from './routes'
