/**
 * Workflow Validation Types
 * FEATURE 130.3: Validated Workflows & Artifact Verification
 *
 * Types for artifact validation, workflow verification, and step validation.
 */

/**
 * Types of artifacts that can be validated
 */
export type ArtifactType =
  | 'file'
  | 'app'
  | 'process'
  | 'url'
  | 'directory'

/**
 * Validation types corresponding to actions
 */
export type ValidationType =
  | 'file_exists'
  | 'file_downloaded'
  | 'app_installed'
  | 'app_opened'
  | 'process_running'
  | 'url_reachable'
  | 'directory_exists'
  | 'custom'

/**
 * Workflow artifact to be validated
 */
export interface WorkflowArtifact {
  type: ArtifactType
  target: string                       // Filename, app name, process name, URL, etc.
  expectedPath?: string                // Expected location
  exists?: boolean
  verified?: boolean
  verifiedAt?: string
  metadata?: Record<string, unknown>
}

/**
 * Result of a validation check
 */
export interface ValidationResult {
  ok: boolean
  validationType: ValidationType
  artifactType?: ArtifactType
  target?: string
  reason?: string
  warnings: string[]
  evidence: string[]                   // Proof of validation (paths, process IDs, etc.)
  durationMs?: number
  checkedAt: string
}

/**
 * Validation requirement for a step
 */
export interface StepValidation {
  required: boolean
  type: ValidationType
  target?: string                      // What to validate (filename, app name, etc.)
  critical: boolean                    // If true, stop workflow on failure
  timeout?: number                     // Validation timeout in ms
  retryCount?: number                  // How many times to retry validation
  retryDelayMs?: number                // Delay between retries
}

/**
 * Extended step validation result
 */
export interface StepValidationResult extends ValidationResult {
  stepId: string
  stepOrder: number
  actionType: string
  targetEntity?: string
  validationAttempts: number
  recovered?: boolean
  recoveryAction?: 'retry' | 'fallback' | 'skip' | 'cancel'
}

/**
 * Workflow validation summary
 */
export interface WorkflowValidationSummary {
  workflowId: string
  planId: string
  totalSteps: number
  validatedSteps: number
  failedValidations: number
  skippedValidations: number
  warnings: string[]
  criticalFailures: StepValidationResult[]
  allValid: boolean
  canLearn: boolean
  reason: string
}

/**
 * Validation policy configuration
 */
export interface ValidationPolicy {
  strictMode: boolean                  // Require all validations to pass
  allowContinueWithWarnings: boolean   // Continue workflow with warnings
  learnOnlyFullyValidated: boolean     // Only learn fully validated workflows
  maxRetries: number                   // Default retry count
  retryDelayMs: number                 // Default retry delay
  validationTimeout: number            // Default validation timeout
}

/**
 * Default validation policy
 */
export const DEFAULT_VALIDATION_POLICY: ValidationPolicy = {
  strictMode: true,
  allowContinueWithWarnings: true,
  learnOnlyFullyValidated: true,
  maxRetries: 2,
  retryDelayMs: 1000,
  validationTimeout: 10000
}

/**
 * Validation action types (for determining what validation to run)
 */
export const ACTION_VALIDATION_MAP: Record<string, ValidationType> = {
  'download_file': 'file_downloaded',
  'install_app': 'app_installed',
  'uninstall_app': 'app_installed',  // Check it's NOT installed
  'open_app': 'app_opened',
  'close_app': 'process_running',    // Check it's NOT running
  'navigate_url': 'url_reachable',
  'file_operation': 'file_exists',
  'folder_operation': 'directory_exists',
  'script_execution': 'process_running'
}

/**
 * Debug info for workflow validation
 */
export interface WorkflowValidationDebugInfo {
  validationEnabled: boolean
  validatedArtifacts: WorkflowArtifact[]
  failedArtifacts: WorkflowArtifact[]
  validationResults: StepValidationResult[]
  warnings: string[]
  workflowLearned: boolean
  learnRejectedReason?: string
}
