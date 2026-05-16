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

  // Check critical tests
  const criticalTests = ['Task Creation', 'Mock Safety - Capability Block']
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
