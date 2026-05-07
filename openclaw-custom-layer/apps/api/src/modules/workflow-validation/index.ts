/**
 * Workflow Validation Module
 * FEATURE 130.3: Validated Workflows & Artifact Verification
 *
 * Exports for workflow validation, artifact verification, and step validation.
 */

// Types
export type {
  ArtifactType,
  ValidationType,
  WorkflowArtifact,
  ValidationResult,
  StepValidation,
  StepValidationResult,
  WorkflowValidationSummary,
  ValidationPolicy,
  WorkflowValidationDebugInfo
} from './types'

export {
  DEFAULT_VALIDATION_POLICY,
  ACTION_VALIDATION_MAP
} from './types'

// Validators
export {
  validateDownloadedFile,
  validateInstalledApplication,
  validateOpenedApplication,
  validateUrlReachable,
  validateFileExists,
  validateDirectoryExists
} from './validators'

// Artifact checks
export {
  getValidationForAction,
  runValidation,
  runValidationWithRetry,
  validateStep,
  createArtifactFromValidation,
  canLearnWorkflow,
  summarizeValidations
} from './artifact-checks'

// Service
export {
  getValidationPolicy,
  setValidationPolicy,
  resetValidationPolicy,
  validateWorkflowStep,
  validateWorkflowSteps,
  shouldLearnWorkflow,
  getConfidenceAdjustment,
  getRecoveryOptions,
  formatValidationForUI
} from './service'
