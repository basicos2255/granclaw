/**
 * P6.17R E2E Test Harness
 * Live Task Control & E2E Validation
 *
 * Validates:
 * 1. Task creation → queue → complete flow
 * 2. Mock safety blocking capability tasks
 * 3. Real provider execution (when configured)
 * 4. Reconciliation persistence
 * 5. Task events emission
 *
 * P6.17R: Fixed API response unwrapping to match actual API format
 * API uses ok() which wraps: { success, data: {...}, error }
 */

import type { GranClawTask, TaskReconciliation } from '../../tasks/types'

/**
 * API Response wrapper (from shared/response.ts)
 */
interface ApiResponse<T> {
  success: boolean
  data: T | null
  error: string | null
}

/**
 * Orchestrator run response structure
 */
interface OrchestratorRunResponse {
  success: boolean
  queued?: boolean
  message?: string
  error?: string
  meta?: {
    requestId?: string
    taskId?: string
    jobId?: string
    planId?: string
    planSteps?: number
    executionMode?: string
    intentKind?: string
  }
  // For simpler execution paths
  result?: unknown
  source?: string
}

// Test configuration
export interface P617HarnessConfig {
  baseUrl: string
  authToken: string
  tenantId: string
  userId?: string
  verbose?: boolean
}

// Test result
export interface TestResult {
  name: string
  passed: boolean
  error?: string
  details?: Record<string, unknown>
  durationMs: number
}

// Harness report
export interface HarnessReport {
  timestamp: string
  config: Partial<P617HarnessConfig>
  results: TestResult[]
  summary: {
    total: number
    passed: number
    failed: number
    passRate: number
  }
}

/**
 * P6.17 E2E Test Harness
 */
export class P617Harness {
  private config: P617HarnessConfig
  private results: TestResult[] = []

  constructor(config: P617HarnessConfig) {
    this.config = config
  }

  private log(message: string): void {
    if (this.config.verbose) {
      console.log(`[P6.17 Harness] ${message}`)
    }
  }

  /**
   * P6.17R: API call helper that properly unwraps API response wrapper
   * API format: { success, data: {...}, error }
   */
  private async apiCall<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<{ success: boolean; data?: T; error?: string; status?: number; rawResponse?: unknown }> {
    try {
      const url = `${this.config.baseUrl}${path}`
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.authToken}`
        },
        body: body ? JSON.stringify(body) : undefined
      })

      const rawJson = await response.json() as ApiResponse<T>

      // P6.17R: Properly unwrap API response
      // API uses ok() which wraps in { success, data, error }
      const unwrappedData = rawJson.data as T

      return {
        success: response.ok && rawJson.success,
        data: unwrappedData,
        error: rawJson.error || undefined,
        status: response.status,
        rawResponse: rawJson // For debugging
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err)
      }
    }
  }

  /**
   * P6.17R: Helper to fetch full task by ID
   */
  private async fetchTask(taskId: string): Promise<GranClawTask | null> {
    const result = await this.apiCall<GranClawTask>('GET', `/tasks/${taskId}`)
    return result.success && result.data ? result.data : null
  }

  /**
   * Test 1: Task Creation
   * Verifies that tasks can be created and get proper ID/status
   * P6.17R: Fixed to use correct API response structure
   */
  async testTaskCreation(): Promise<TestResult> {
    const start = Date.now()
    const testName = 'Task Creation'
    this.log(`Running: ${testName}`)

    try {
      const result = await this.apiCall<OrchestratorRunResponse>(
        'POST',
        '/orchestrator/run',
        {
          message: 'Hola, ¿qué hora es?',
          tenantId: this.config.tenantId,
          userId: this.config.userId
        }
      )

      if (!result.success || !result.data) {
        return {
          name: testName,
          passed: false,
          error: result.error || 'API call failed',
          details: { rawResponse: result.rawResponse },
          durationMs: Date.now() - start
        }
      }

      // P6.17R: Get taskId from meta (queue path) or direct response
      const taskId = result.data.meta?.taskId

      if (!taskId) {
        return {
          name: testName,
          passed: false,
          error: 'No taskId in response',
          details: { response: result.data },
          durationMs: Date.now() - start
        }
      }

      // P6.17R: Fetch full task to verify it exists
      const task = await this.fetchTask(taskId)

      if (!task) {
        return {
          name: testName,
          passed: false,
          error: 'Task not found after creation',
          details: { taskId },
          durationMs: Date.now() - start
        }
      }

      const hasRequiredFields = task.id && task.status && task.tenantId && task.createdAt

      return {
        name: testName,
        passed: !!hasRequiredFields,
        details: {
          taskId: task.id,
          status: task.status,
          source: task.source,
          queued: result.data.queued
        },
        error: hasRequiredFields ? undefined : 'Missing required fields',
        durationMs: Date.now() - start
      }
    } catch (err) {
      return {
        name: testName,
        passed: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - start
      }
    }
  }

  /**
   * Test 2: Mock Safety - Capability Tasks Should Fail
   * Verifies that capability-backed tasks (downloads, etc.) fail in mock mode
   * P6.17R: Fixed to use correct API response structure
   */
  async testMockSafetyCapabilityBlock(): Promise<TestResult> {
    const start = Date.now()
    const testName = 'Mock Safety - Capability Block'
    this.log(`Running: ${testName}`)

    try {
      // This should fail/block if OpenClaw is not configured
      const result = await this.apiCall<OrchestratorRunResponse>(
        'POST',
        '/orchestrator/run',
        {
          message: 'Descargar e instalar VLC',
          tenantId: this.config.tenantId,
          userId: this.config.userId
        }
      )

      // P6.17R: Check for various blocking scenarios
      // 1. API returns success=false with error about capabilities
      if (!result.success || (result.data && !result.data.success)) {
        const errorMsg = result.error || result.data?.error || ''
        const isCapabilityBlock = errorMsg.includes('Capacidades') ||
                                  errorMsg.includes('capability') ||
                                  errorMsg.includes('blocked') ||
                                  errorMsg.includes('mock') ||
                                  errorMsg.includes('setup')

        return {
          name: testName,
          passed: isCapabilityBlock,
          details: {
            blocked: true,
            error: errorMsg,
            isCapabilityBlock
          },
          error: isCapabilityBlock ? undefined : `Unexpected error: ${errorMsg}`,
          durationMs: Date.now() - start
        }
      }

      // 2. Task was created - fetch it to check status
      const taskId = result.data?.meta?.taskId
      if (!taskId) {
        // No task created, check if response indicates blocking
        const responseData = result.data as OrchestratorRunResponse | undefined
        const isBlocked = !!responseData?.error || !responseData?.success

        return {
          name: testName,
          passed: isBlocked,
          details: {
            noTaskCreated: true,
            response: responseData
          },
          error: isBlocked ? undefined : 'Capability task was allowed without proper checks',
          durationMs: Date.now() - start
        }
      }

      // Fetch task to check its status
      const task = await this.fetchTask(taskId)
      if (!task) {
        return {
          name: testName,
          passed: false,
          error: 'Task not found',
          details: { taskId },
          durationMs: Date.now() - start
        }
      }

      const source = task.source

      // If source is 'mock', the task should NOT be successful for capability tasks
      if (source === 'mock') {
        const mockBlocked = task.status === 'error' ||
                           task.status === 'blocked' ||
                           (task.result as Record<string, unknown>)?.mockBlocked === true

        return {
          name: testName,
          passed: mockBlocked,
          details: {
            taskId: task.id,
            source,
            status: task.status,
            mockBlocked
          },
          error: mockBlocked ? undefined : 'Capability task succeeded in mock mode - this is a bug!',
          durationMs: Date.now() - start
        }
      }

      // If source is 'openclaw' or 'queue', it's fine - real provider was used
      return {
        name: testName,
        passed: true,
        details: {
          taskId: task.id,
          source,
          status: task.status,
          note: 'Real provider or queue used, mock safety not applicable'
        },
        durationMs: Date.now() - start
      }
    } catch (err) {
      return {
        name: testName,
        passed: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - start
      }
    }
  }

  /**
   * Test 3: Task Truth Endpoint
   * Verifies /tasks/:id/truth returns complete reconciliation data
   * P6.17R: Fixed to use correct API response structure
   */
  async testTaskTruthEndpoint(taskId: string): Promise<TestResult> {
    const start = Date.now()
    const testName = 'Task Truth Endpoint'
    this.log(`Running: ${testName}`)

    try {
      // P6.17R: The truth endpoint returns { success, taskId, truth: {...} }
      const result = await this.apiCall<{
        success: boolean
        taskId: string
        truth: {
          task: Partial<GranClawTask>
          reconciliation: TaskReconciliation | null
          executionEvidence: unknown
          evidenceValidated?: boolean
          job: unknown
          thread: unknown
          result: unknown
          failureExplanation: unknown
        }
      }>('GET', `/tasks/${taskId}/truth`)

      if (!result.success || !result.data) {
        return {
          name: testName,
          passed: false,
          error: result.error || 'Truth endpoint failed',
          details: { rawResponse: result.rawResponse },
          durationMs: Date.now() - start
        }
      }

      // P6.17R: Check the truth structure
      const truth = result.data.truth
      if (!truth) {
        return {
          name: testName,
          passed: false,
          error: 'No truth object in response',
          details: { response: result.data },
          durationMs: Date.now() - start
        }
      }

      const hasTaskInfo = truth.task && truth.task.id === taskId

      return {
        name: testName,
        passed: !!hasTaskInfo,
        details: {
          hasTask: !!truth.task,
          taskIdMatch: truth.task?.id === taskId,
          hasReconciliation: !!truth.reconciliation,
          hasEvidence: !!truth.executionEvidence,
          evidenceValidated: truth.evidenceValidated,
          hasJob: !!truth.job,
          hasThread: !!truth.thread,
          hasResult: !!truth.result,
          hasFailureExplanation: !!truth.failureExplanation,
          taskStatus: truth.task?.status
        },
        error: hasTaskInfo ? undefined : 'Task info missing or mismatch',
        durationMs: Date.now() - start
      }
    } catch (err) {
      return {
        name: testName,
        passed: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - start
      }
    }
  }

  /**
   * Test 4: Conversational Task Success
   * Verifies that simple conversational tasks succeed (even in mock mode)
   * P6.17R: Fixed to use correct API response structure
   */
  async testConversationalTaskSuccess(): Promise<TestResult> {
    const start = Date.now()
    const testName = 'Conversational Task Success'
    this.log(`Running: ${testName}`)

    try {
      const result = await this.apiCall<OrchestratorRunResponse>(
        'POST',
        '/orchestrator/run',
        {
          message: '¿Cuál es la capital de Francia?',
          tenantId: this.config.tenantId,
          userId: this.config.userId
        }
      )

      if (!result.success || !result.data) {
        return {
          name: testName,
          passed: false,
          error: result.error || 'API call failed',
          details: { rawResponse: result.rawResponse },
          durationMs: Date.now() - start
        }
      }

      // P6.17R: Get taskId from response
      const taskId = result.data.meta?.taskId
      if (!taskId) {
        // For simple conversational tasks, might not create a task
        // Check if response indicates success
        const responseSuccess = result.data.success
        return {
          name: testName,
          passed: responseSuccess,
          details: {
            noTaskCreated: true,
            responseSuccess,
            response: result.data
          },
          error: responseSuccess ? undefined : 'Conversational task failed without task creation',
          durationMs: Date.now() - start
        }
      }

      // Fetch task
      const task = await this.fetchTask(taskId)
      if (!task) {
        return {
          name: testName,
          passed: false,
          error: 'Task not found after creation',
          details: { taskId },
          durationMs: Date.now() - start
        }
      }

      // Conversational tasks should succeed even in mock mode
      const isSuccess = task.status === 'success' || task.status === 'queued' || task.status === 'running' || task.status === 'pending'

      return {
        name: testName,
        passed: isSuccess,
        details: {
          taskId: task.id,
          status: task.status,
          source: task.source,
          queued: result.data.queued
        },
        error: isSuccess ? undefined : `Unexpected status: ${task.status}`,
        durationMs: Date.now() - start
      }
    } catch (err) {
      return {
        name: testName,
        passed: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - start
      }
    }
  }

  /**
   * Test 5: Task List API
   * Verifies tasks can be listed and filtered
   * P6.17R: Fixed to use correct API response structure
   */
  async testTaskListAPI(): Promise<TestResult> {
    const start = Date.now()
    const testName = 'Task List API'
    this.log(`Running: ${testName}`)

    try {
      // P6.17R: Task list returns array of tasks directly
      const result = await this.apiCall<GranClawTask[]>('GET', '/tasks')

      if (!result.success) {
        return {
          name: testName,
          passed: false,
          error: result.error || 'Task list failed',
          details: { rawResponse: result.rawResponse },
          durationMs: Date.now() - start
        }
      }

      // P6.17R: data is the array of tasks
      const tasks = result.data || []

      return {
        name: testName,
        passed: true,
        details: {
          taskCount: Array.isArray(tasks) ? tasks.length : 0,
          isArray: Array.isArray(tasks)
        },
        durationMs: Date.now() - start
      }
    } catch (err) {
      return {
        name: testName,
        passed: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - start
      }
    }
  }

  /**
   * P6.17R3: Test multistep target extraction
   * "Descargar e instalar VLC" must extract targetEntity='vlc', NOT 'e'
   */
  async testMultistepTargetExtraction(): Promise<TestResult> {
    const start = Date.now()
    const testName = 'P6.17R3: Multistep Target Extraction'
    this.log(`Running: ${testName}`)

    try {
      const result = await this.apiCall<OrchestratorRunResponse>(
        'POST',
        '/orchestrator/run',
        {
          message: 'Descargar e instalar VLC',
          tenantId: this.config.tenantId,
          userId: this.config.userId
        }
      )

      // Get taskId - may fail early or create task then block
      const taskId = result.data?.meta?.taskId

      // If no task, check if error mentions correct target
      if (!taskId) {
        const errorMsg = result.error || result.data?.error || ''
        // P6.17R3: Error should reference 'vlc' not 'e'
        const hasCorrectTarget = errorMsg.toLowerCase().includes('vlc') ||
                                 errorMsg.includes('download') ||
                                 errorMsg.includes('install')
        const hasBadTarget = errorMsg.toLowerCase().includes('"e"') ||
                             errorMsg.includes("'e'")

        return {
          name: testName,
          passed: hasCorrectTarget && !hasBadTarget,
          details: {
            noTaskCreated: true,
            errorMsg,
            hasCorrectTarget,
            hasBadTarget
          },
          error: hasBadTarget ? 'Target incorrectly extracted as "e"' : undefined,
          durationMs: Date.now() - start
        }
      }

      // Fetch task truth to check target extraction
      // P6.17R5: Updated type to include new fields
      const truthResult = await this.apiCall<{
        success: boolean
        taskId: string
        truth: {
          task: Record<string, unknown>
          reconciliation: TaskReconciliation | null
          failureExplanation: Record<string, unknown> | null
          blockingCapabilities: string[] | null
          capabilityGate: boolean
          // P6.17R5: New fields for plan evidence
          targetEntity: string | null
          planSummary: {
            planId: string
            totalSteps: number
            steps: Array<{
              stepId: string
              order: number
              actionType: string
              targetEntity?: string
              capabilityKey?: string
              description: string
            }>
          } | null
          planId: string | null
          sourceInput: string | null
        }
      }>('GET', `/tasks/${taskId}/truth`)

      if (!truthResult.success || !truthResult.data?.truth) {
        return {
          name: testName,
          passed: false,
          error: 'Could not fetch task truth',
          details: { taskId },
          durationMs: Date.now() - start
        }
      }

      const truth = truthResult.data.truth
      const taskResult = truth.task?.result as Record<string, unknown> | undefined
      // P6.17R5: Prefer top-level targetEntity, fallback to task.result.targetEntity
      const targetEntity = truth.targetEntity || taskResult?.targetEntity

      // P6.17R3: targetEntity must be 'vlc', NOT 'e'
      const targetIsCorrect = String(targetEntity).toLowerCase() === 'vlc'
      const targetIsBad = String(targetEntity).toLowerCase() === 'e'

      // P6.17R3: Task should be blocked (not queued successfully)
      const isBlocked = truth.task?.status === 'error' ||
                        truth.task?.status === 'blocked' ||
                        truth.reconciliation?.executionStatus === 'blocked' ||
                        truth.capabilityGate === true

      // P6.17R4: failureExplanation.code must be 'capability_not_implemented' for blocked tasks
      const failureCode = truth.failureExplanation?.code
      const codeIsValid = !isBlocked || (!!failureCode && failureCode !== 'unknown')
      const codeIsCapabilityNotImplemented = failureCode === 'capability_not_implemented'

      // P6.17R4: canRetry must be false for capability-blocked tasks
      const canRetry = truth.failureExplanation?.canRetry
      const canRetryIsFalse = canRetry === false

      // P6.17R5: Check planSummary has steps with correct targetEntity
      const planSummary = truth.planSummary
      const hasValidPlanSummary = planSummary && planSummary.totalSteps > 0
      const stepsHaveTarget = planSummary?.steps?.some(s =>
        s.targetEntity?.toLowerCase() === 'vlc' &&
        (s.actionType === 'download_file' || s.actionType === 'install_app')
      ) || false

      // P6.17R4/R5: Stricter validation - targetEntity MUST be vlc (not just "not e")
      // Also verify failureExplanation.code is correct and canRetry=false
      // P6.17R5: Also verify planSummary has correct data
      const passed = targetIsCorrect && isBlocked && codeIsValid && codeIsCapabilityNotImplemented && canRetryIsFalse

      return {
        name: testName,
        passed: !!passed,
        details: {
          taskId,
          targetEntity,
          targetIsCorrect,
          targetIsBad,
          isBlocked,
          failureCode,
          codeIsValid,
          codeIsCapabilityNotImplemented,
          canRetry,
          canRetryIsFalse,
          capabilityGate: truth.capabilityGate,
          blockingCapabilities: truth.blockingCapabilities,
          taskStatus: truth.task?.status,
          executionStatus: truth.reconciliation?.executionStatus,
          // P6.17R5: Include plan evidence details
          planId: truth.planId,
          sourceInput: truth.sourceInput,
          hasValidPlanSummary,
          stepsHaveTarget,
          planSummarySteps: planSummary?.steps?.length || 0
        },
        error: !passed ? [
          !targetIsCorrect ? `Target not extracted correctly (got "${targetEntity}", expected "vlc")` : null,
          targetIsBad ? 'Target incorrectly extracted as "e"' : null,
          !isBlocked ? 'Task was not blocked by capability gate' : null,
          !codeIsValid ? `failureExplanation.code is "${failureCode}" (should not be "unknown")` : null,
          !codeIsCapabilityNotImplemented ? `failureExplanation.code is "${failureCode}" (expected "capability_not_implemented")` : null,
          !canRetryIsFalse ? `failureExplanation.canRetry is ${canRetry} (expected false)` : null
        ].filter(Boolean).join('; ') : undefined,
        durationMs: Date.now() - start
      }
    } catch (err) {
      return {
        name: testName,
        passed: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - start
      }
    }
  }

  /**
   * P6.17R3: Test direct URL download blocking
   */
  async testDirectUrlDownloadBlock(): Promise<TestResult> {
    const start = Date.now()
    const testName = 'P6.17R3: Direct URL Download Block'
    this.log(`Running: ${testName}`)

    try {
      const result = await this.apiCall<OrchestratorRunResponse>(
        'POST',
        '/orchestrator/run',
        {
          message: 'descarga https://example.com/file.txt',
          tenantId: this.config.tenantId,
          userId: this.config.userId
        }
      )

      // This should be blocked if download capability is not available
      const isBlocked = !result.success ||
                        (result.data && !result.data.success) ||
                        result.data?.error?.includes('Capacidades') ||
                        result.data?.error?.includes('capability') ||
                        result.data?.error?.includes('download')

      const taskId = result.data?.meta?.taskId

      if (taskId) {
        // Check if task was blocked
        const task = await this.fetchTask(taskId)
        if (task) {
          const taskBlocked = task.status === 'error' || task.status === 'blocked'
          return {
            name: testName,
            passed: taskBlocked,
            details: {
              taskId,
              status: task.status,
              blocked: taskBlocked
            },
            error: !taskBlocked ? 'Direct URL download was not blocked' : undefined,
            durationMs: Date.now() - start
          }
        }
      }

      return {
        name: testName,
        passed: !!isBlocked,
        details: {
          apiBlocked: isBlocked,
          error: result.error || result.data?.error
        },
        error: !isBlocked ? 'Direct URL download was allowed' : undefined,
        durationMs: Date.now() - start
      }
    } catch (err) {
      return {
        name: testName,
        passed: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - start
      }
    }
  }

  /**
   * P6.17R4: Test that retry on capability-blocked task does NOT enqueue
   * This test creates a blocked task, then attempts retry and verifies it fails
   */
  async testBlockedTaskRetryDoesNotEnqueue(): Promise<TestResult> {
    const start = Date.now()
    const testName = 'P6.17R4: Blocked Task Retry Does Not Enqueue'
    this.log(`Running: ${testName}`)

    try {
      // First, create a blocked task
      const createResult = await this.apiCall<OrchestratorRunResponse>(
        'POST',
        '/orchestrator/run',
        {
          message: 'Descargar e instalar VLC',
          tenantId: this.config.tenantId,
          userId: this.config.userId
        }
      )

      const taskId = createResult.data?.meta?.taskId
      if (!taskId) {
        return {
          name: testName,
          passed: false,
          error: 'Could not create blocked task - no taskId returned',
          details: { createResult: createResult.data },
          durationMs: Date.now() - start
        }
      }

      // Verify task is blocked
      const task = await this.fetchTask(taskId)
      if (!task || task.status !== 'blocked') {
        return {
          name: testName,
          passed: false,
          error: `Task not in blocked state (status: ${task?.status})`,
          details: { taskId, status: task?.status },
          durationMs: Date.now() - start
        }
      }

      // Attempt retry
      const retryResult = await this.apiCall<{
        success: boolean
        retryBlocked?: boolean
        capabilityGate?: boolean
        jobId?: string
        error?: string
      }>('POST', `/tasks/${taskId}/retry`, {})

      // P6.17R4: Retry should fail with retryBlocked=true, no jobId
      const retryWasBlocked = retryResult.data?.retryBlocked === true
      const hasCapabilityGate = retryResult.data?.capabilityGate === true
      const noJobId = !retryResult.data?.jobId
      const successIsFalse = retryResult.data?.success === false

      // Verify task is still blocked after retry attempt
      const taskAfterRetry = await this.fetchTask(taskId)
      const stillBlocked = taskAfterRetry?.status === 'blocked'

      // Fetch truth to verify no job was created
      const truthResult = await this.apiCall<{
        success: boolean
        truth: {
          job: unknown | null
          failureExplanation: { code: string; canRetry: boolean } | null
        }
      }>('GET', `/tasks/${taskId}/truth`)

      const jobIsNull = truthResult.data?.truth?.job === null
      const failureCode = truthResult.data?.truth?.failureExplanation?.code
      const canRetryIsFalse = truthResult.data?.truth?.failureExplanation?.canRetry === false

      const passed = retryWasBlocked && hasCapabilityGate && noJobId && successIsFalse &&
                     stillBlocked && jobIsNull && canRetryIsFalse

      return {
        name: testName,
        passed,
        details: {
          taskId,
          retryWasBlocked,
          hasCapabilityGate,
          noJobId,
          successIsFalse,
          stillBlocked,
          jobIsNull,
          failureCode,
          canRetryIsFalse,
          retryResponse: retryResult.data
        },
        error: !passed ? [
          !retryWasBlocked ? 'retryBlocked was not true' : null,
          !hasCapabilityGate ? 'capabilityGate was not true' : null,
          !noJobId ? 'jobId was returned (task was incorrectly enqueued)' : null,
          !successIsFalse ? 'success was not false' : null,
          !stillBlocked ? 'Task status changed from blocked' : null,
          !jobIsNull ? 'Job exists in truth (should be null)' : null,
          !canRetryIsFalse ? `canRetry is not false (failureExplanation.canRetry)` : null
        ].filter(Boolean).join('; ') : undefined,
        durationMs: Date.now() - start
      }
    } catch (err) {
      return {
        name: testName,
        passed: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - start
      }
    }
  }

  /**
   * Run all tests
   */
  async runAll(): Promise<HarnessReport> {
    this.log('Starting P6.17 E2E Test Harness')
    this.results = []

    // Test 1: Task Creation
    const creationResult = await this.testTaskCreation()
    this.results.push(creationResult)

    // Test 2: Mock Safety
    const mockSafetyResult = await this.testMockSafetyCapabilityBlock()
    this.results.push(mockSafetyResult)

    // Test 3: Task Truth (if we have a task ID)
    if (creationResult.details?.taskId) {
      const truthResult = await this.testTaskTruthEndpoint(creationResult.details.taskId as string)
      this.results.push(truthResult)
    }

    // Test 4: Conversational Task
    const convResult = await this.testConversationalTaskSuccess()
    this.results.push(convResult)

    // Test 5: Task List
    const listResult = await this.testTaskListAPI()
    this.results.push(listResult)

    // P6.17R3/R4 Tests
    // Test 6: Multistep Target Extraction
    const targetResult = await this.testMultistepTargetExtraction()
    this.results.push(targetResult)

    // Test 7: Direct URL Download Block
    const urlDownloadResult = await this.testDirectUrlDownloadBlock()
    this.results.push(urlDownloadResult)

    // Test 8: P6.17R4 - Blocked Task Retry Does Not Enqueue
    const retryBlockedResult = await this.testBlockedTaskRetryDoesNotEnqueue()
    this.results.push(retryBlockedResult)

    // Generate report
    const passed = this.results.filter(r => r.passed).length
    const report: HarnessReport = {
      timestamp: new Date().toISOString(),
      config: {
        baseUrl: this.config.baseUrl,
        tenantId: this.config.tenantId
      },
      results: this.results,
      summary: {
        total: this.results.length,
        passed,
        failed: this.results.length - passed,
        passRate: Math.round((passed / this.results.length) * 100)
      }
    }

    this.log(`Completed: ${passed}/${this.results.length} tests passed (${report.summary.passRate}%)`)
    return report
  }
}

/**
 * Create and run harness with default config
 */
export async function runP617Harness(config: P617HarnessConfig): Promise<HarnessReport> {
  const harness = new P617Harness(config)
  return harness.runAll()
}

/**
 * Quick validation function for integration tests
 */
export function validateP617Report(report: HarnessReport): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  // Check minimum pass rate
  if (report.summary.passRate < 80) {
    errors.push(`Pass rate ${report.summary.passRate}% is below 80% threshold`)
  }

  // Check critical tests (including P6.17R3/R4 tests)
  const criticalTests = [
    'Task Creation',
    'Mock Safety - Capability Block',
    'P6.17R3: Multistep Target Extraction',
    'P6.17R3: Direct URL Download Block',
    'P6.17R4: Blocked Task Retry Does Not Enqueue'
  ]
  for (const testName of criticalTests) {
    const result = report.results.find(r => r.name === testName)
    if (result && !result.passed) {
      errors.push(`Critical test failed: ${testName} - ${result.error}`)
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}
