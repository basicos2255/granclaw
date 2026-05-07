/**
 * Composite Tasks Module
 * FEATURE 130.2: Composite Tasks & Intelligent Task Chaining
 *
 * Exports for composite task composition, chaining, and workflow execution.
 */

// Types
export type {
  CompositeTask,
  CompositeTaskStep,
  CompositeExecutionPlan,
  CompositeExecutionResult,
  BuildCompositePlanInput,
  BuildCompositePlanResult,
  ExecuteCompositePlanInput,
  StepPreconditionResult,
  CompositeTaskState,
  CompositeTaskStats,
  CompositeDebugInfo,
  CompositeStepType,
  CompositeStepStatus
} from './types'

export {
  CURRENT_COMPOSITE_TASK_VERSION,
  DEFAULT_COMPOSITE_TASK_STATE
} from './types'

// Service functions
export {
  loadCompositeTaskState,
  generateCompositeSignature,
  findCompositeBySignature,
  findCompositeByInput,
  getCompositeById,
  getCompositeTasks,
  getAllCompositeTasks,
  saveCompositeTask,
  recordCompositeExecution,
  invalidateCompositeTask,
  validateCompositeTask,
  deleteCompositeTask,
  clearCompositeTasks,
  getCompositeTaskStats
} from './service'

// Planner functions
export {
  buildCompositeExecutionPlan,
  splitInputIntoSteps,
  checkStepPreconditions,
  isCompositeCandidate
} from './planner'

// Executor functions
export {
  executeCompositePlan,
  retryFailedStep,
  continueFromStep
} from './executor'

// Route handlers
export {
  handleGetCompositeTasks,
  handleGetCompositeStats,
  handleGetCompositeById,
  handleFindCompositePlan,
  handleExecuteCompositePlan,
  handleInvalidateComposite,
  handleValidateComposite,
  handleDeleteComposite,
  handleClearCompositeTasks
} from './routes'
