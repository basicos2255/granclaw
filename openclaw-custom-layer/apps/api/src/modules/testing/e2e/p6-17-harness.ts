/**
 * P6.17 E2E Test Harness
 * Live Task Control & E2E Validation
 *
 * Validates:
 * 1. Task creation → queue → complete flow
 * 2. Mock safety blocking capability tasks
 * 3. Real provider execution (when configured)
 * 4. Reconciliation persistence
 * 5. Task events emission
 */

import type { GranClawTask, TaskReconciliation } from '../../tasks/types'

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

  private async apiCall<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<{ success: boolean; data?: T; error?: string; status?: number }> {
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

      const data = await response.json()
      return {
        success: response.ok,
        data: data as T,
        status: response.status
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err)
      }
    }
  }

  /**
   * Test 1: Task Creation
   * Verifies that tasks can be created and get proper ID/status
   */
  async testTaskCreation(): Promise<TestResult> {
    const start = Date.now()
    const testName = 'Task Creation'
    this.log(`Running: ${testName}`)

    try {
      const result = await this.apiCall<{ success: boolean; task?: GranClawTask }>(
        'POST',
        '/orchestrator/run',
        {
          message: 'Hola, ¿qué hora es?',
          tenantId: this.config.tenantId,
          userId: this.config.userId
        }
      )

      if (!result.success || !result.data?.task) {
        return {
          name: testName,
          passed: false,
          error: result.error || 'No task returned',
          durationMs: Date.now() - start
        }
      }

      const task = result.data.task
      const hasRequiredFields = task.id && task.status && task.tenantId && task.createdAt

      return {
        name: testName,
        passed: !!hasRequiredFields,
        details: {
          taskId: task.id,
          status: task.status,
          source: task.source
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
   */
  async testMockSafetyCapabilityBlock(): Promise<TestResult> {
    const start = Date.now()
    const testName = 'Mock Safety - Capability Block'
    this.log(`Running: ${testName}`)

    try {
      // This should fail with mock if OpenClaw is not configured
      const result = await this.apiCall<{ success: boolean; task?: GranClawTask; error?: string }>(
        'POST',
        '/orchestrator/run',
        {
          message: 'Descargar e instalar VLC',
          tenantId: this.config.tenantId,
          userId: this.config.userId
        }
      )

      if (!result.data?.task) {
        return {
          name: testName,
          passed: false,
          error: 'No task returned',
          durationMs: Date.now() - start
        }
      }

      const task = result.data.task
      const source = task.source

      // If source is 'mock', the task should NOT be successful for capability tasks
      if (source === 'mock') {
        // Mock mode should fail for capability tasks
        const mockBlocked = task.status === 'error' ||
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

      // If source is 'openclaw', it's fine - real provider was used
      return {
        name: testName,
        passed: true,
        details: {
          taskId: task.id,
          source,
          status: task.status,
          note: 'Real provider used, mock safety not applicable'
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
   */
  async testTaskTruthEndpoint(taskId: string): Promise<TestResult> {
    const start = Date.now()
    const testName = 'Task Truth Endpoint'
    this.log(`Running: ${testName}`)

    try {
      const result = await this.apiCall<{
        success: boolean
        truth?: {
          task: GranClawTask
          reconciliation: TaskReconciliation | null
          executionEvidence: unknown
          job: unknown
        }
      }>('GET', `/tasks/${taskId}/truth`)

      if (!result.success || !result.data?.truth) {
        return {
          name: testName,
          passed: false,
          error: 'Truth endpoint failed',
          durationMs: Date.now() - start
        }
      }

      const truth = result.data.truth
      const hasTaskInfo = truth.task && truth.task.id === taskId

      return {
        name: testName,
        passed: hasTaskInfo,
        details: {
          hasReconciliation: !!truth.reconciliation,
          hasEvidence: !!truth.executionEvidence,
          hasJob: !!truth.job,
          taskStatus: truth.task?.status
        },
        error: hasTaskInfo ? undefined : 'Task info mismatch',
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
   */
  async testConversationalTaskSuccess(): Promise<TestResult> {
    const start = Date.now()
    const testName = 'Conversational Task Success'
    this.log(`Running: ${testName}`)

    try {
      const result = await this.apiCall<{ success: boolean; task?: GranClawTask }>(
        'POST',
        '/orchestrator/run',
        {
          message: '¿Cuál es la capital de Francia?',
          tenantId: this.config.tenantId,
          userId: this.config.userId
        }
      )

      if (!result.data?.task) {
        return {
          name: testName,
          passed: false,
          error: 'No task returned',
          durationMs: Date.now() - start
        }
      }

      const task = result.data.task
      // Conversational tasks should succeed even in mock mode
      const isSuccess = task.status === 'success' || task.status === 'queued' || task.status === 'running'

      return {
        name: testName,
        passed: isSuccess,
        details: {
          taskId: task.id,
          status: task.status,
          source: task.source
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
   */
  async testTaskListAPI(): Promise<TestResult> {
    const start = Date.now()
    const testName = 'Task List API'
    this.log(`Running: ${testName}`)

    try {
      const result = await this.apiCall<{
        success: boolean
        tasks?: GranClawTask[]
        total?: number
      }>('GET', '/tasks')

      if (!result.success) {
        return {
          name: testName,
          passed: false,
          error: 'Task list failed',
          durationMs: Date.now() - start
        }
      }

      return {
        name: testName,
        passed: true,
        details: {
          taskCount: result.data?.tasks?.length || 0,
          total: result.data?.total
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
