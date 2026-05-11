/**
 * Composite Task Executor
 * FEATURE 130.2: Composite Tasks & Intelligent Task Chaining
 * FEATURE 130.3: Validated Workflows & Artifact Verification
 * P6.7: Execution Evidence & Artifact Validation
 *
 * Executes composite execution plans:
 * - Sequential step execution
 * - Validation between steps
 * - Failure recovery
 * - Partial completion
 * - Progress tracking
 * - Artifact validation
 *
 * IMPORTANT (P6.7): Task-memory pattern reuse ACCELERATES PLANNING,
 * but real execution MUST still happen. Pattern found != execution done.
 */

import {
  type CompositeExecutionPlan,
  type CompositeExecutionResult,
  type CompositeTaskStep,
  type ExecuteCompositePlanInput,
  type StepPreconditionResult
} from './types'
import {
  saveCompositeTask,
  recordCompositeExecution
} from './service'
import { checkStepPreconditions } from './planner'
import {
  checkTaskMemory,
  getExecutionPlanFromPattern,
  recordPatternExecution
} from '../orchestrator/task-memory-integration'
import { dispatchCapabilityExecution, getEnabledCapabilityByKey } from '../capabilities'
// P6.9R: Use executeProviderTask (no guard) for internal step execution
import { executeProviderTask } from '../orchestrator/service'
// FEATURE 130.3: Workflow validation
import {
  validateWorkflowStep,
  shouldLearnWorkflow,
  getValidationForAction,
  type StepValidationResult
} from '../workflow-validation'

/**
 * Minimum success rate to learn as composite
 */
const MIN_LEARNING_SUCCESS_RATE = 0.8

/**
 * Execute a single step
 */
async function executeStep(
  step: CompositeTaskStep,
  input: ExecuteCompositePlanInput
): Promise<{ success: boolean; result?: unknown; error?: string; skipped: boolean }> {
  const { tenantId, userId, sessionId } = input

  // Check preconditions
  const precondition: StepPreconditionResult = checkStepPreconditions(step, tenantId)

  if (precondition.shouldSkip) {
    console.log(`[CompositeExecutor] Step ${step.stepId} skipped: ${precondition.skipReason}`)
    return {
      success: true,
      skipped: true,
      result: { skipped: true, reason: precondition.skipReason }
    }
  }

  if (!precondition.canExecute) {
    return {
      success: false,
      skipped: false,
      error: `Precondition failed: ${precondition.warnings.join(', ')}`
    }
  }

  console.log(`[CompositeExecutor] Executing step ${step.stepId} (${step.type}): ${step.description}`)

  try {
    switch (step.type) {
      case 'task_memory': {
        // P6.7: Task memory provides STRATEGY, not execution bypass
        // We must still execute the steps!

        if (!step.taskPatternId) {
          return { success: false, skipped: false, error: 'Missing taskPatternId' }
        }

        // Check task memory for pattern (strategy lookup)
        const memoryCheck = checkTaskMemory({
          input: step.description,
          tenantId,
          userId
        })

        if (memoryCheck.canReuse && memoryCheck.pattern) {
          const execPlan = getExecutionPlanFromPattern({
            pattern: memoryCheck.pattern,
            tenantId,
            userId
          })

          console.log(`[CompositeExecutor] P6.7: Found pattern ${execPlan.patternId}, EXECUTING steps (not bypassing)`)

          // P6.7 FIX: Actually EXECUTE the steps from the pattern
          // The pattern tells us WHAT to do, but we must DO it
          const startTime = Date.now()
          let allStepsSucceeded = true
          let stepResults: unknown[] = []
          let lastError: string | undefined

          for (const patternStep of execPlan.steps) {
            // P6.9R: Execute each step via provider (no guard for internal execution)
            const stepResult = await executeProviderTask({
              message: patternStep.input || patternStep.description || step.description,
              tenantId,
              sessionId
            })

            if (!stepResult.success) {
              allStepsSucceeded = false
              lastError = stepResult.error
              console.log(`[CompositeExecutor] P6.7: Pattern step failed: ${lastError}`)
              break
            }

            stepResults.push(stepResult.result)
          }

          const durationMs = Date.now() - startTime

          // P6.7 FIX: Only record success if execution actually succeeded
          if (allStepsSucceeded) {
            recordPatternExecution(execPlan.patternId, true, durationMs)
            console.log(`[CompositeExecutor] P6.7: Pattern ${execPlan.patternId} executed successfully`)
          } else {
            recordPatternExecution(execPlan.patternId, false, durationMs)
            console.log(`[CompositeExecutor] P6.7: Pattern ${execPlan.patternId} execution FAILED`)
          }

          return {
            success: allStepsSucceeded,
            skipped: false,
            result: {
              fromTaskMemory: true,
              patternId: execPlan.patternId,
              steps: execPlan.steps,
              stepResults,
              executedSteps: stepResults.length,
              totalSteps: execPlan.steps.length,
              durationMs
            },
            error: lastError
          }
        }

        // Fallback to OpenClaw if pattern not reusable
        return await executeOpenClawStep(step, input)
      }

      case 'capability': {
        if (!step.capabilityKey) {
          return { success: false, skipped: false, error: 'Missing capabilityKey' }
        }

        const capability = getEnabledCapabilityByKey(tenantId, step.capabilityKey)
        if (!capability) {
          // Fallback to OpenClaw
          return await executeOpenClawStep(step, input)
        }

        const dispatchResult = await dispatchCapabilityExecution(capability, {
          tenantId,
          userId: userId || 'system',
          sessionId: sessionId || 'composite',
          mode: 'strict',
          requestedAction: step.description
        })

        if (dispatchResult.confirmationRequired) {
          return {
            success: false,
            skipped: false,
            error: 'Confirmation required',
            result: {
              confirmationRequired: true,
              confirmationId: dispatchResult.confirmationId
            }
          }
        }

        return {
          success: dispatchResult.success,
          skipped: false,
          result: dispatchResult.result,
          error: dispatchResult.error
        }
      }

      case 'openclaw': {
        return await executeOpenClawStep(step, input)
      }

      case 'manual': {
        return {
          success: false,
          skipped: false,
          error: 'Manual step requires user action'
        }
      }

      default:
        return {
          success: false,
          skipped: false,
          error: `Unknown step type: ${step.type}`
        }
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[CompositeExecutor] Step ${step.stepId} error:`, err)
    return {
      success: false,
      skipped: false,
      error: errorMessage
    }
  }
}

/**
 * Execute step via OpenClaw
 * P6.9R: Uses executeProviderTask (no guard) for internal step execution
 */
async function executeOpenClawStep(
  step: CompositeTaskStep,
  input: ExecuteCompositePlanInput
): Promise<{ success: boolean; result?: unknown; error?: string; skipped: boolean }> {
  const { tenantId, sessionId } = input

  // P6.9R: Use executeProviderTask - no multistep guard for internal execution
  const result = await executeProviderTask({
    message: step.description,
    tenantId,
    sessionId
  })

  return {
    success: result.success,
    skipped: false,
    result: result.result,
    error: result.error
  }
}

/**
 * Execute composite plan
 * FEATURE 130.3: Enhanced with step validation
 */
export async function executeCompositePlan(
  input: ExecuteCompositePlanInput
): Promise<CompositeExecutionResult> {
  const {
    plan,
    tenantId,
    userId,
    stopOnFirstFailure = true,
    allowPartialCompletion = true,
    retryFailedSteps = false,
    maxRetries = 1
  } = input

  const startTime = Date.now()
  const completedSteps: string[] = []
  const skippedSteps: string[] = []
  const validatedSteps: string[] = []
  const validationFailedSteps: string[] = []
  let failedStep: CompositeExecutionResult['failedStep'] | undefined
  let validationStoppedWorkflow = false

  console.log(`[CompositeExecutor] Starting plan ${plan.id} with ${plan.steps.length} steps`)

  // Execute steps sequentially
  for (const step of plan.steps) {
    // Check if step should be skipped
    if (plan.skippableSteps.includes(step.stepId)) {
      step.status = 'skipped'
      step.skippedReason = 'Pre-check: already done'
      skippedSteps.push(step.stepId)
      console.log(`[CompositeExecutor] Step ${step.stepId} pre-skipped`)
      continue
    }

    step.status = 'running'
    step.startedAt = new Date().toISOString()

    let attempts = 0
    let stepResult: { success: boolean; result?: unknown; error?: string; skipped: boolean }

    // Retry loop
    do {
      attempts++
      stepResult = await executeStep(step, input)

      if (!stepResult.success && retryFailedSteps && attempts < maxRetries) {
        console.log(`[CompositeExecutor] Step ${step.stepId} failed, retrying (${attempts}/${maxRetries})`)
      }
    } while (!stepResult.success && retryFailedSteps && attempts < maxRetries)

    step.completedAt = new Date().toISOString()

    if (stepResult.skipped) {
      step.status = 'skipped'
      step.skippedReason = stepResult.result?.toString() || 'Skipped'
      skippedSteps.push(step.stepId)
    } else if (stepResult.success) {
      step.status = 'success'
      step.result = stepResult.result
      completedSteps.push(step.stepId)

      // FEATURE 130.3: Run validation if required
      if (step.validationRequired) {
        console.log(`[CompositeExecutor] Validating step ${step.stepId}`)

        const validationResult = await validateWorkflowStep(
          step.stepId,
          step.order,
          step.actionType,
          step.targetEntity,
          tenantId,
          step.validationType ? {
            required: true,
            type: step.validationType as 'file_exists' | 'file_downloaded' | 'app_installed' | 'app_opened' | 'process_running' | 'url_reachable' | 'directory_exists' | 'custom',
            target: step.validationTarget,
            critical: step.validationCritical ?? false
          } : undefined
        )

        step.validationResult = {
          ok: validationResult.ok,
          reason: validationResult.reason,
          warnings: validationResult.warnings,
          evidence: validationResult.evidence,
          attempts: validationResult.validationAttempts
        }

        if (validationResult.ok) {
          validatedSteps.push(step.stepId)
          console.log(`[CompositeExecutor] Step ${step.stepId} validation passed`)
        } else {
          validationFailedSteps.push(step.stepId)
          console.log(`[CompositeExecutor] Step ${step.stepId} validation failed: ${validationResult.reason}`)

          // If critical validation failed, stop workflow
          if (step.validationCritical) {
            step.status = 'validation_failed'
            validationStoppedWorkflow = true
            console.log(`[CompositeExecutor] Critical validation failed at step ${step.stepId}, stopping workflow`)
            break
          }
        }
      }
    } else {
      step.status = 'failed'
      step.error = stepResult.error

      failedStep = {
        stepId: step.stepId,
        error: stepResult.error || 'Unknown error',
        recoverable: step.type !== 'manual'
      }

      if (stopOnFirstFailure) {
        console.log(`[CompositeExecutor] Stopping on failure at step ${step.stepId}`)
        break
      }
    }
  }

  const totalDurationMs = Date.now() - startTime
  const totalSteps = plan.steps.length
  const successfulSteps = completedSteps.length + skippedSteps.length

  // Determine execution status (FEATURE 130.3: Added validation_failed)
  let executionStatus: CompositeExecutionResult['executionStatus']
  if (validationStoppedWorkflow) {
    executionStatus = 'validation_failed'
  } else if (failedStep) {
    executionStatus = allowPartialCompletion && completedSteps.length > 0 ? 'partial' : 'failed'
  } else if (successfulSteps === totalSteps) {
    executionStatus = 'completed'
  } else {
    executionStatus = 'partial'
  }

  const success = executionStatus === 'completed'

  // Calculate token saving
  const tokenSaving = plan.steps
    .filter(s => s.status === 'success' && (s.type === 'task_memory' || s.type === 'capability'))
    .length * 500

  // Record execution if using existing composite
  if (plan.compositeTaskId) {
    recordCompositeExecution(
      plan.compositeTaskId,
      success,
      totalDurationMs,
      completedSteps.length,
      totalSteps
    )
  }

  // FEATURE 130.3: Learn as new composite only if fully validated
  let learnedAsComposite = false
  let learnedCompositeId: string | undefined
  let learnRejectedReason: string | undefined

  if (success && successfulSteps >= 2 && !plan.compositeTaskId) {
    const successRate = successfulSteps / totalSteps

    if (successRate >= MIN_LEARNING_SUCCESS_RATE) {
      // FEATURE 130.3: Check validation requirements before learning
      // Build validation results from steps
      const stepValidationResults = plan.steps
        .filter(s => s.validationResult)
        .map(s => ({
          ok: s.validationResult!.ok,
          validationType: s.validationType as 'file_exists' | 'file_downloaded' | 'app_installed' | 'app_opened' | 'process_running' | 'url_reachable' | 'directory_exists' | 'custom' || 'custom',
          reason: s.validationResult!.reason,
          warnings: s.validationResult!.warnings,
          evidence: s.validationResult!.evidence,
          checkedAt: s.completedAt || new Date().toISOString(),
          stepId: s.stepId,
          stepOrder: s.order,
          actionType: s.actionType,
          targetEntity: s.targetEntity,
          validationAttempts: s.validationResult!.attempts
        }))

      const learnDecision = shouldLearnWorkflow(stepValidationResults, tenantId)

      if (learnDecision.shouldLearn) {
        const composite = saveCompositeTask({
          tenantId,
          userId,
          name: plan.sourceInput.substring(0, 50),
          normalizedIntent: plan.sourceInput,
          triggerPatterns: [plan.sourceInput.toLowerCase()],
          steps: plan.steps.filter(s => s.status === 'success' || s.status === 'skipped')
        })

        learnedAsComposite = true
        learnedCompositeId = composite.id
        console.log(`[CompositeExecutor] Learned as composite: ${composite.id}`)
      } else {
        learnRejectedReason = learnDecision.reason
        console.log(`[CompositeExecutor] Learning rejected: ${learnDecision.reason}`)
      }
    }
  }

  console.log(`[CompositeExecutor] Plan ${plan.id} ${executionStatus}: ${completedSteps.length}/${totalSteps} completed, ${skippedSteps.length} skipped, ${validatedSteps.length} validated, ${validationFailedSteps.length} validation failed`)

  return {
    planId: plan.id,
    compositeTaskId: plan.compositeTaskId || learnedCompositeId,
    success,
    completedSteps,
    failedStep,
    skippedSteps,
    validatedSteps,
    validationFailedSteps,
    executionStatus,
    totalDurationMs,
    tokenSaving,
    learnedAsComposite,
    learnedCompositeId,
    learnRejectedReason
  }
}

/**
 * Retry a failed step in an execution
 */
export async function retryFailedStep(
  plan: CompositeExecutionPlan,
  stepId: string,
  input: Omit<ExecuteCompositePlanInput, 'plan'>
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  const step = plan.steps.find(s => s.stepId === stepId)
  if (!step) {
    return { success: false, error: 'Step not found' }
  }

  const result = await executeStep(step, { ...input, plan })

  if (result.success) {
    step.status = 'success'
    step.result = result.result
    step.error = undefined
  }

  return {
    success: result.success,
    result: result.result,
    error: result.error
  }
}

/**
 * Continue execution from a specific step
 */
export async function continueFromStep(
  plan: CompositeExecutionPlan,
  fromStepId: string,
  input: Omit<ExecuteCompositePlanInput, 'plan'>
): Promise<CompositeExecutionResult> {
  const stepIndex = plan.steps.findIndex(s => s.stepId === fromStepId)
  if (stepIndex === -1) {
    return {
      planId: plan.id,
      success: false,
      completedSteps: [],
      skippedSteps: [],
      validatedSteps: [],
      validationFailedSteps: [],
      executionStatus: 'failed',
      totalDurationMs: 0,
      tokenSaving: 0,
      learnedAsComposite: false,
      failedStep: {
        stepId: fromStepId,
        error: 'Step not found',
        recoverable: false
      }
    }
  }

  // Create partial plan starting from stepIndex
  const partialPlan: CompositeExecutionPlan = {
    ...plan,
    steps: plan.steps.slice(stepIndex)
  }

  return executeCompositePlan({ ...input, plan: partialPlan })
}
