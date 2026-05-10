/**
 * Task Threads Module
 * P6.6: Human Interaction Layer, Task Threads & Conversational Control
 *
 * Central module for conversational task management.
 */

// =============================================================================
// Types
// =============================================================================

export type {
  TaskThread,
  ThreadMessage,
  ThreadContext,
  HumanReadablePlan,
  PendingApproval,
  HumanTaskState,
  MessageRole,
  ThreadTaskAction,
  CreateThreadInput,
  AddMessageInput,
  UpdateContextInput,
  RefinementInput,
  TaskThreadState
} from './types'

export {
  DEFAULT_THREAD_STATE,
  DEFAULT_THREAD_CONTEXT
} from './types'

// =============================================================================
// Service
// =============================================================================

export {
  // State
  loadState,
  // Thread CRUD
  createThread,
  getThread,
  getThreadByTaskId,
  getActiveThread,
  listThreads,
  updateThreadStatus,
  // Messages
  addMessage,
  addUserMessage,
  addRuntimeMessage,
  addAssistantMessage,
  // Context
  updateContext,
  extractContextFromMessage,
  // Plans
  setThreadPlan,
  refinePlan,
  // Approvals
  createApproval,
  resolveApproval,
  getPendingApprovals,
  // Actions
  pauseThread,
  resumeThread,
  cancelThread,
  completeThread,
  failThread
} from './service'

// =============================================================================
// Handlers
// =============================================================================

export {
  handleListThreads,
  handleGetActiveThread,
  handleGetThread,
  handleGetThreadByTask,
  handleCreateThread,
  handleUpdateStatus,
  handleAddMessage,
  handleAddRuntimeMessage,
  handleAddAssistantMessage,
  handleSetPlan,
  handleRefinePlan,
  handleUpdateContext,
  handleGetApprovals,
  handleCreateApproval,
  handleResolveApproval,
  handlePauseThread,
  handleResumeThread,
  handleCancelThread,
  handleCompleteThread,
  handleFailThread
} from './handlers'
