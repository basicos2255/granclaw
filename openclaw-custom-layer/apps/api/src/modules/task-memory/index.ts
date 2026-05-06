/**
 * Task Memory Module
 * FEATURE 130: Advanced Tasks (Persistent, Reusable, Optimized Execution)
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
  PatternExecutionResult
} from './types'

export { DEFAULT_TASK_MEMORY_STATE } from './types'

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
  detectLanguage
} from './service'

// Route handlers
export {
  handleGetPatterns,
  handleGetStats,
  handleFindPattern,
  handleDeletePattern,
  handleClearPatterns,
  handleNormalizeInput
} from './routes'
