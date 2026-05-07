/**
 * Task Memory Module
 * FEATURE 130: Advanced Tasks (Persistent, Reusable, Optimized Execution)
 * FIX 130.1: Safe Task Memory Matching & Validation
 *
 * Exports for task pattern storage and reuse.
 */

// Types
export type {
  TaskPattern,
  TaskMemoryState,
  TaskMemoryStats,
  TaskPatternMetadata,
  FindPatternInput,
  FindPatternResult,
  SavePatternInput,
  PatternExecutionResult,
  // FIX 130.1: New types
  TaskActionType,
  EnvironmentFingerprint,
  NormalizedIntent,
  PreconditionCheckResult,
  TaskMemoryDebugInfo
} from './types'

export {
  DEFAULT_TASK_MEMORY_STATE,
  CURRENT_TASK_PATTERN_VERSION
} from './types'

// Service functions
export {
  normalizeTaskInput,
  generateInputSignature,
  findPatternByInput,
  savePattern,
  getRecentPatterns,
  getTopPatterns,
  recordPatternReuse,
  getTaskMemoryStats,
  getAllPatterns,
  deletePattern,
  clearAllPatterns,
  reloadTaskMemory,
  detectTaskCategory,
  detectLanguage,
  // FIX 130.1: New functions
  getCurrentEnvironment,
  runPreconditionChecks,
  invalidatePattern,
  validatePattern
} from './service'

// Route handlers
export {
  handleGetPatterns,
  handleGetStats,
  handleFindPattern,
  handleDeletePattern,
  handleClearPatterns,
  handleNormalizeInput,
  // FIX 130.1: New handlers
  handleInvalidatePattern,
  handleValidatePattern
} from './routes'
