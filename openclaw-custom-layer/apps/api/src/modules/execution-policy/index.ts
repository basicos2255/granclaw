/**
 * Execution Policy Module
 * FEATURE 120: Hybrid Execution Policy v1
 * FIX 121: Authoritative Hybrid Router & Intent Classification
 *
 * Provides hybrid execution routing between local and OpenClaw.
 */

export * from './types'
export {
  getExecutionPolicy,
  setExecutionPolicy,
  getAllExecutionPolicies,
  deleteExecutionPolicy
} from './service'
export {
  decideExecutionRoute,
  createExecutionPlanPreview,
  type ExecutionStep,
  type TaskExecutionPlan
} from './execution-router'
// FIX 121: Intent classifier exports
export {
  classifyIntent,
  shouldBlockLocalProposal,
  requiresOpenClaw,
  type IntentKind,
  type IntentClassification
} from './intent-classifier'
export {
  handleGetExecutionPolicy,
  handleSetExecutionPolicy
} from './routes'
