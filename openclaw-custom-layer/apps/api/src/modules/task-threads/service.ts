/**
 * Task Threads Service
 * P6.6: Human Interaction Layer, Task Threads & Conversational Control
 * P6.18D6: Simple task output visibility - assistant message with real response
 * P6.18D6B: Terminal task thread hydration - create completed thread for finished tasks
 *
 * Service for managing conversational task threads.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

// P6.18D6: Import getTask to retrieve task result for assistant message
import { getTask } from '../tasks/service'
import type {
  TaskThread,
  ThreadMessage,
  ThreadContext,
  HumanReadablePlan,
  PendingApproval,
  HumanTaskState,
  CreateThreadInput,
  AddMessageInput,
  UpdateContextInput,
  RefinementInput,
  TaskThreadState
} from './types'
import { DEFAULT_THREAD_STATE, DEFAULT_THREAD_CONTEXT } from './types'

// Data directory
const DATA_DIR = join(process.cwd(), 'data')
const STATE_FILE = join(DATA_DIR, 'task-threads.json')

// In-memory state
let state: TaskThreadState = DEFAULT_THREAD_STATE

/**
 * Ensure data directory exists
 */
function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }
}

/**
 * Load state from disk
 */
export function loadState(): TaskThreadState {
  ensureDataDir()
  if (existsSync(STATE_FILE)) {
    try {
      const data = readFileSync(STATE_FILE, 'utf-8')
      state = JSON.parse(data)
      console.log(`[TaskThreads] Loaded ${state.threads.length} threads`)
    } catch (err) {
      console.error('[TaskThreads] Error loading state:', err)
      state = DEFAULT_THREAD_STATE
    }
  }
  return state
}

/**
 * Save state to disk
 */
function saveState(): void {
  ensureDataDir()
  state.lastUpdated = new Date().toISOString()
  state.stats = computeStats()
  try {
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
  } catch (err) {
    console.error('[TaskThreads] Error saving state:', err)
  }
}

/**
 * Compute stats
 */
function computeStats(): TaskThreadState['stats'] {
  const threads = state.threads
  const active = threads.filter(t =>
    !['completed', 'failed', 'cancelled'].includes(t.status)
  ).length
  const completed = threads.filter(t => t.status === 'completed').length

  return {
    totalThreads: threads.length,
    activeThreads: active,
    completedThreads: completed
  }
}

/**
 * Generate unique ID
 */
function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `${prefix}-${timestamp}-${random}`
}

// =============================================================================
// Thread CRUD
// =============================================================================

/**
 * Create a new thread
 * P6.18D6B: If taskId corresponds to a terminal task, create hydrated thread
 */
export function createThread(input: CreateThreadInput): TaskThread {
  const now = new Date().toISOString()

  // P6.18D6B: Check if task is already terminal - hydrate thread from task result
  let initialStatus: HumanTaskState = 'thinking'
  let assistantResponse: string | null = null

  if (input.taskId) {
    const task = getTask(input.taskId)
    if (task) {
      if (task.status === 'success') {
        // Task already completed - create completed thread
        initialStatus = 'completed'
        assistantResponse = task.result ? extractAssistantResponseFromResult(task.result) : null
        console.log(`[TaskThreads] P6.18D6B: Task ${input.taskId} is success, creating completed thread`)
      } else if (task.status === 'error') {
        // Task errored - create failed thread
        initialStatus = 'failed'
        console.log(`[TaskThreads] P6.18D6B: Task ${input.taskId} is error, creating failed thread`)
      }
      // Note: blocked tasks should NOT auto-create threads (P6.17R7B)
    }
  }

  const thread: TaskThread = {
    id: generateId('thread'),
    taskId: input.taskId,
    tenantId: input.tenantId,
    userId: input.userId,
    title: input.title,
    status: initialStatus,
    messages: [],
    activeContext: { ...DEFAULT_THREAD_CONTEXT },
    pendingApprovals: [],
    createdAt: now,
    updatedAt: now,
    lastActivityAt: now
  }

  // Add initial user message if provided
  if (input.initialMessage) {
    thread.messages.push({
      id: generateId('msg'),
      role: 'user',
      content: input.initialMessage,
      timestamp: now
    })
    thread.lastUserIntent = input.initialMessage
  }

  // P6.18D6B: Add assistant message for completed tasks
  if (initialStatus === 'completed' && assistantResponse) {
    thread.messages.push({
      id: generateId('msg'),
      role: 'assistant',
      content: assistantResponse,
      timestamp: now
    })
    console.log(`[TaskThreads] P6.18D6B: Added assistant message to hydrated thread`)
  } else if (initialStatus === 'completed' && !assistantResponse) {
    // Fallback: system message if no response extracted
    thread.messages.push({
      id: generateId('msg'),
      role: 'system',
      content: 'Tarea completada exitosamente',
      timestamp: now
    })
  } else if (initialStatus === 'failed') {
    // Add error message for failed tasks
    const task = input.taskId ? getTask(input.taskId) : null
    const errorMsg = task?.error || task?.reason || 'La tarea falló'
    thread.messages.push({
      id: generateId('msg'),
      role: 'system',
      content: `Tarea finalizada: ${errorMsg}`,
      timestamp: now
    })
  }

  state.threads.push(thread)
  saveState()

  console.log(`[TaskThreads] Created thread ${thread.id} for task ${input.taskId} with status ${initialStatus}`)
  return thread
}

/**
 * Get thread by ID
 */
export function getThread(threadId: string): TaskThread | null {
  return state.threads.find(t => t.id === threadId) || null
}

/**
 * Get thread by task ID
 */
export function getThreadByTaskId(taskId: string): TaskThread | null {
  return state.threads.find(t => t.taskId === taskId) || null
}

/**
 * Get active thread for tenant (most recent non-completed)
 */
export function getActiveThread(tenantId: string): TaskThread | null {
  const active = state.threads
    .filter(t =>
      t.tenantId === tenantId &&
      !['completed', 'failed', 'cancelled'].includes(t.status)
    )
    .sort((a, b) =>
      new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()
    )

  return active[0] || null
}

/**
 * List threads for tenant
 */
export function listThreads(tenantId: string, limit: number = 50): TaskThread[] {
  return state.threads
    .filter(t => t.tenantId === tenantId)
    .sort((a, b) =>
      new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()
    )
    .slice(0, limit)
}

/**
 * Update thread status
 */
export function updateThreadStatus(threadId: string, status: HumanTaskState): TaskThread | null {
  const thread = getThread(threadId)
  if (!thread) return null

  thread.status = status
  thread.updatedAt = new Date().toISOString()
  thread.lastActivityAt = thread.updatedAt

  saveState()
  return thread
}

// =============================================================================
// Messages
// =============================================================================

/**
 * Add message to thread
 */
export function addMessage(input: AddMessageInput): ThreadMessage | null {
  const thread = getThread(input.threadId)
  if (!thread) return null

  const now = new Date().toISOString()
  const message: ThreadMessage = {
    id: generateId('msg'),
    role: input.role,
    content: input.content,
    timestamp: now,
    taskAction: input.taskAction,
    workflowStep: input.workflowStep,
    artifacts: input.artifacts,
    outputs: input.outputs,
    pendingApproval: input.pendingApproval,
    explanation: input.explanation
  }

  thread.messages.push(message)
  thread.updatedAt = now
  thread.lastActivityAt = now

  // Track user intent
  if (input.role === 'user') {
    thread.lastUserIntent = input.content
  }

  saveState()
  return message
}

/**
 * Add user message with intent detection
 */
export function addUserMessage(threadId: string, content: string): {
  message: ThreadMessage | null
  detectedAction?: string
  shouldContinue?: boolean
} {
  const thread = getThread(threadId)
  if (!thread) return { message: null }

  // Detect intent from message
  const action = detectUserAction(content)

  const message = addMessage({
    threadId,
    role: 'user',
    content,
    taskAction: action
  })

  return {
    message,
    detectedAction: action,
    shouldContinue: action === 'continue' || action === 'resume'
  }
}

/**
 * Detect user action from message content
 */
function detectUserAction(content: string): ThreadMessage['taskAction'] | undefined {
  const lower = content.toLowerCase().trim()

  // Continue patterns
  if (/^(continúa|continua|sigue|adelante|ok|vale|proceed|continue)$/i.test(lower)) {
    return 'continue'
  }

  // Pause patterns
  if (/^(para|pausa|pause|stop|espera|wait)$/i.test(lower)) {
    return 'pause'
  }

  // Resume patterns
  if (/^(reanuda|resume|sigue|continue from)$/i.test(lower)) {
    return 'resume'
  }

  // Approval patterns
  if (/^(sí|si|yes|apruebo|approve|acepto|confirm)$/i.test(lower)) {
    return 'approve'
  }

  // Rejection patterns
  if (/^(no|rechaza|reject|denegar|deny|cancel)$/i.test(lower)) {
    return 'reject'
  }

  // Retry patterns
  if (/^(reintenta|retry|otra vez|again)$/i.test(lower)) {
    return 'retry'
  }

  // Cancel patterns
  if (/^(cancela|cancel|aborta|abort|termina)$/i.test(lower)) {
    return 'cancel'
  }

  // Explanation patterns
  if (/^(explica|explain|qué|que|por qué|why|cómo|como|how)/.test(lower)) {
    return 'explain'
  }

  // If has refinement keywords, it's a refinement
  if (/(usa|use|con|with|sin|without|solo|only|máximo|max|mínimo|min|evita|avoid|prefiero|prefer)/i.test(lower)) {
    return 'refine'
  }

  return undefined
}

/**
 * Add runtime message (step completed, error, etc.)
 */
export function addRuntimeMessage(
  threadId: string,
  content: string,
  workflowStep?: ThreadMessage['workflowStep'],
  outputs?: ThreadMessage['outputs'],
  artifacts?: ThreadMessage['artifacts']
): ThreadMessage | null {
  return addMessage({
    threadId,
    role: 'runtime',
    content,
    workflowStep,
    outputs,
    artifacts
  })
}

/**
 * Add assistant message with explanation
 */
export function addAssistantMessage(
  threadId: string,
  content: string,
  explanation?: ThreadMessage['explanation']
): ThreadMessage | null {
  return addMessage({
    threadId,
    role: 'assistant',
    content,
    explanation
  })
}

// =============================================================================
// Context Management
// =============================================================================

/**
 * Update thread context
 */
export function updateContext(input: UpdateContextInput): ThreadContext | null {
  const thread = getThread(input.threadId)
  if (!thread) return null

  const now = new Date().toISOString()

  // Merge preferences
  if (input.preferences) {
    thread.activeContext.preferences = {
      ...thread.activeContext.preferences,
      ...input.preferences
    }
  }

  // Add filters
  if (input.filters) {
    const existing = new Set(thread.activeContext.filters)
    input.filters.forEach(f => existing.add(f))
    thread.activeContext.filters = Array.from(existing)
  }

  // Add decision
  if (input.decision) {
    thread.activeContext.decisions.push({
      ...input.decision,
      timestamp: now
    })
  }

  // Add entity
  if (input.entity) {
    const exists = thread.activeContext.entities.find(
      e => e.type === input.entity!.type && e.name === input.entity!.name
    )
    if (!exists) {
      thread.activeContext.entities.push({
        ...input.entity,
        firstMentioned: now
      })
    }
  }

  thread.updatedAt = now
  saveState()

  return thread.activeContext
}

/**
 * Extract context from user message
 */
export function extractContextFromMessage(threadId: string, content: string): void {
  const thread = getThread(threadId)
  if (!thread) return

  const lower = content.toLowerCase()

  // Extract filters
  const filters: string[] = []
  if (/gratis|gratuito|free/i.test(lower)) filters.push('free_only')
  if (/sin anuncios|no ads|ad-free/i.test(lower)) filters.push('no_ads')
  if (/open source|código abierto/i.test(lower)) filters.push('open_source')
  if (/seguro|secure|safe/i.test(lower)) filters.push('secure')

  // Extract preferences
  const preferences: Record<string, string | number | boolean> = {}

  // Browser preference
  const browserMatch = lower.match(/(chrome|firefox|safari|edge|brave)/i)
  if (browserMatch) {
    preferences.browser = browserMatch[1].toLowerCase()
  }

  // Price limit
  const priceMatch = lower.match(/máximo?\s*(\d+)\s*(€|eur|usd|\$)/i)
  if (priceMatch) {
    preferences.maxPrice = parseInt(priceMatch[1])
    preferences.currency = priceMatch[2].replace('$', 'USD').replace('€', 'EUR')
  }

  if (filters.length > 0 || Object.keys(preferences).length > 0) {
    updateContext({
      threadId,
      filters: filters.length > 0 ? filters : undefined,
      preferences: Object.keys(preferences).length > 0 ? preferences : undefined
    })
  }
}

// =============================================================================
// Plan Management
// =============================================================================

/**
 * Set current plan for thread
 */
export function setThreadPlan(threadId: string, plan: HumanReadablePlan): TaskThread | null {
  const thread = getThread(threadId)
  if (!thread) return null

  thread.currentPlan = plan
  thread.updatedAt = new Date().toISOString()

  // Add assistant message explaining the plan
  addAssistantMessage(
    threadId,
    `Voy a:\n${plan.steps.map((s, i) => `${i + 1}. ${s.description}`).join('\n')}`,
    {
      what: plan.summary,
      why: 'Plan basado en tu solicitud',
      nextSteps: plan.steps.map(s => s.description)
    }
  )

  saveState()
  return thread
}

/**
 * Update plan based on refinement
 */
export function refinePlan(input: RefinementInput): HumanReadablePlan | null {
  const thread = getThread(input.threadId)
  if (!thread || !thread.currentPlan) return null

  // Extract context from refinement
  extractContextFromMessage(input.threadId, input.refinement)

  // Add user message
  addUserMessage(input.threadId, input.refinement)

  // Note: In a real implementation, this would call AI to regenerate the plan
  // For now, we just acknowledge the refinement
  addAssistantMessage(
    input.threadId,
    `Entendido. Actualizando el plan con: "${input.refinement}"`,
    {
      what: 'Plan actualizado',
      why: input.refinement,
      nextSteps: thread.currentPlan.steps.map(s => s.description)
    }
  )

  thread.updatedAt = new Date().toISOString()
  saveState()

  return thread.currentPlan
}

// =============================================================================
// Approvals
// =============================================================================

/**
 * Create pending approval
 */
export function createApproval(
  threadId: string,
  type: PendingApproval['type'],
  action: string,
  description: string,
  risks: string[] = []
): PendingApproval | null {
  const thread = getThread(threadId)
  if (!thread) return null

  const now = new Date().toISOString()
  const approval: PendingApproval = {
    id: generateId('approval'),
    type,
    action,
    description,
    risks,
    createdAt: now,
    status: 'pending'
  }

  thread.pendingApprovals.push(approval)
  thread.status = 'waiting_approval'
  thread.updatedAt = now

  // Add message asking for approval
  addMessage({
    threadId,
    role: 'assistant',
    content: `${description}\n\n¿Quieres que proceda?`,
    pendingApproval: {
      id: approval.id,
      action,
      description,
      risks,
      options: ['Sí, continúa', 'No, cancelar', 'Muéstrame más detalles']
    }
  })

  saveState()
  return approval
}

/**
 * Resolve approval
 */
export function resolveApproval(
  threadId: string,
  approvalId: string,
  approved: boolean,
  userId?: string
): PendingApproval | null {
  const thread = getThread(threadId)
  if (!thread) return null

  const approval = thread.pendingApprovals.find(a => a.id === approvalId)
  if (!approval || approval.status !== 'pending') return null

  const now = new Date().toISOString()
  approval.status = approved ? 'approved' : 'rejected'
  approval.resolvedAt = now
  approval.resolvedBy = userId

  // Update thread status
  const stillPending = thread.pendingApprovals.filter(a => a.status === 'pending')
  if (stillPending.length === 0) {
    thread.status = approved ? 'executing' : 'paused'
  }

  // Add user response
  addMessage({
    threadId,
    role: 'user',
    content: approved ? 'Sí, continúa' : 'No, cancelar',
    taskAction: approved ? 'approve' : 'reject'
  })

  thread.updatedAt = now
  saveState()

  return approval
}

/**
 * Get pending approvals for thread
 */
export function getPendingApprovals(threadId: string): PendingApproval[] {
  const thread = getThread(threadId)
  if (!thread) return []
  return thread.pendingApprovals.filter(a => a.status === 'pending')
}

// =============================================================================
// Thread Actions
// =============================================================================

/**
 * Pause thread
 */
export function pauseThread(threadId: string): TaskThread | null {
  const thread = getThread(threadId)
  if (!thread) return null

  thread.status = 'paused'
  thread.updatedAt = new Date().toISOString()

  addMessage({
    threadId,
    role: 'system',
    content: 'Tarea pausada por el usuario'
  })

  saveState()
  return thread
}

/**
 * Resume thread
 */
export function resumeThread(threadId: string): TaskThread | null {
  const thread = getThread(threadId)
  if (!thread) return null

  if (thread.status === 'paused') {
    thread.status = 'executing'
    thread.updatedAt = new Date().toISOString()

    addMessage({
      threadId,
      role: 'system',
      content: 'Tarea reanudada'
    })

    saveState()
  }

  return thread
}

/**
 * Cancel thread
 */
export function cancelThread(threadId: string, reason?: string): TaskThread | null {
  const thread = getThread(threadId)
  if (!thread) return null

  thread.status = 'cancelled'
  thread.updatedAt = new Date().toISOString()

  addMessage({
    threadId,
    role: 'system',
    content: reason || 'Tarea cancelada por el usuario'
  })

  saveState()
  return thread
}

/**
 * Complete thread
 */
export function completeThread(
  threadId: string,
  summary: string,
  outputs?: ThreadMessage['outputs'],
  artifacts?: ThreadMessage['artifacts']
): TaskThread | null {
  const thread = getThread(threadId)
  if (!thread) return null

  thread.status = 'completed'
  thread.updatedAt = new Date().toISOString()

  addMessage({
    threadId,
    role: 'assistant',
    content: summary,
    outputs,
    artifacts,
    explanation: {
      what: summary,
      why: 'Tarea completada exitosamente',
      nextSteps: []
    }
  })

  saveState()
  return thread
}

/**
 * Mark thread as failed
 */
export function failThread(threadId: string, error: string, recoverable: boolean = false): TaskThread | null {
  const thread = getThread(threadId)
  if (!thread) return null

  thread.status = recoverable ? 'needs_repair' : 'failed'
  thread.updatedAt = new Date().toISOString()

  addMessage({
    threadId,
    role: 'runtime',
    content: error,
    explanation: {
      what: 'Error en la ejecución',
      why: error,
      nextSteps: recoverable
        ? ['Revisar el error', 'Intentar de nuevo', 'Modificar parámetros']
        : ['Revisar los logs', 'Contactar soporte']
    }
  })

  saveState()
  return thread
}

// =============================================================================
// P6.8: THREAD LIFECYCLE SYNCHRONIZATION
// =============================================================================

/**
 * P6.8: Terminal task statuses
 */
const TERMINAL_TASK_STATUSES = ['success', 'error', 'cancelled', 'blocked']

/**
 * P6.8: Check if task status is terminal
 */
export function isTerminalTaskStatus(status: string): boolean {
  return TERMINAL_TASK_STATUSES.includes(status)
}

/**
 * P6.8: Terminal thread statuses
 */
const TERMINAL_THREAD_STATUSES = ['completed', 'failed', 'cancelled']

/**
 * P6.8: Check if thread status is terminal
 */
export function isTerminalThreadStatus(status: HumanTaskState): boolean {
  return TERMINAL_THREAD_STATUSES.includes(status)
}

/**
 * P6.8: Active thread statuses (can become zombie if task completes)
 */
const ACTIVE_THREAD_STATUSES: HumanTaskState[] = ['thinking', 'planning', 'reusing_strategy', 'queued', 'executing', 'validating']

/**
 * P6.8: Get ALL threads for a taskId (for duplicate detection)
 */
export function getThreadsByTaskId(taskId: string): TaskThread[] {
  return state.threads.filter(t => t.taskId === taskId)
}

/**
 * P6.8: Input for getOrCreateThreadForTask - taskId is REQUIRED
 */
interface GetOrCreateThreadInput extends CreateThreadInput {
  taskId: string  // Required for this operation
}

/**
 * P6.8: Get or create thread for task - SINGLE THREAD GUARANTEE
 *
 * This is the FIX for duplicate threads. Instead of blindly creating,
 * this function checks if a thread already exists and returns it.
 */
export function getOrCreateThreadForTask(input: GetOrCreateThreadInput): {
  thread: TaskThread
  created: boolean
  existingCount: number
} {
  const taskId = input.taskId
  const existingThreads = getThreadsByTaskId(taskId)

  if (existingThreads.length > 0) {
    // Return the most recent active thread, or the first one
    const activeThread = existingThreads.find(t => !isTerminalThreadStatus(t.status))
    const thread = activeThread || existingThreads[0]

    console.log(`[TaskThreads] P6.8: Returning existing thread ${thread.id} for task ${taskId} (${existingThreads.length} existing)`)

    return {
      thread,
      created: false,
      existingCount: existingThreads.length
    }
  }

  // No existing thread, create new one
  const thread = createThread(input)
  console.log(`[TaskThreads] P6.8: Created new thread ${thread.id} for task ${taskId}`)

  return {
    thread,
    created: true,
    existingCount: 0
  }
}

/**
 * P6.18D6: Extract assistant response from task result
 *
 * Handles multiple result formats:
 * - ChatCompletionResponse: { choices: [{ message: { content: 'response' } }] }
 * - Direct response: { response: 'response' }
 * - Summary: { summary: 'response' }
 * - Mock result: { result: { message: 'response' } }
 */
function extractAssistantResponseFromResult(result: unknown): string | null {
  if (!result || typeof result !== 'object') {
    if (typeof result === 'string' && result.length > 0) {
      return result
    }
    return null
  }

  const obj = result as Record<string, unknown>

  // ChatCompletionResponse from OpenClaw
  if (Array.isArray(obj.choices) && obj.choices.length > 0) {
    const firstChoice = obj.choices[0] as Record<string, unknown> | undefined
    if (firstChoice && typeof firstChoice === 'object') {
      const msg = firstChoice.message as Record<string, unknown> | undefined
      if (msg && typeof msg.content === 'string' && msg.content.length > 0) {
        return msg.content
      }
    }
  }

  // Direct response field
  if (typeof obj.response === 'string' && obj.response.length > 0) {
    return obj.response
  }

  // Summary field
  if (typeof obj.summary === 'string' && obj.summary.length > 0) {
    return obj.summary
  }

  // Message field
  if (typeof obj.message === 'string' && obj.message.length > 0) {
    return obj.message
  }

  // Nested result.message
  if (obj.result && typeof obj.result === 'object') {
    const nested = obj.result as Record<string, unknown>
    if (typeof nested.message === 'string' && nested.message.length > 0) {
      return nested.message
    }
  }

  return null
}

/**
 * P6.8: Sync thread status with task status
 * P6.18D6: Adds assistant message with real response for completed tasks
 * P6.18D6B: Creates hydrated thread if missing for terminal success tasks
 *
 * This is the FIX for zombie threads. When a task completes,
 * this function updates the thread to match.
 */
export function syncThreadWithTask(taskId: string, taskStatus: string, taskError?: string): TaskThread | null {
  let thread = getThreadByTaskId(taskId)

  // P6.18D6B: If no thread exists and task is terminal success, create hydrated thread
  if (!thread) {
    if (taskStatus === 'success') {
      const task = getTask(taskId)
      if (task) {
        console.log(`[TaskThreads] P6.18D6B: No thread for success task ${taskId}, creating hydrated thread`)
        thread = createThread({
          taskId: taskId,
          tenantId: task.tenantId,
          title: task.input?.substring(0, 100) || 'Tarea completada',
          initialMessage: task.input
        })
        // Thread was already created with completed status by createThread P6.18D6B
        return thread
      }
    }
    console.log(`[TaskThreads] P6.8: No thread found for task ${taskId}, skipping sync`)
    return null
  }

  // If thread is already terminal, don't update
  if (isTerminalThreadStatus(thread.status)) {
    console.log(`[TaskThreads] P6.8: Thread ${thread.id} already terminal (${thread.status}), skipping sync`)
    return thread
  }

  // Map task status to thread status
  let newThreadStatus: HumanTaskState = thread.status

  if (taskStatus === 'success') {
    newThreadStatus = 'completed'
  } else if (taskStatus === 'error') {
    newThreadStatus = 'failed'
  } else if (taskStatus === 'cancelled') {
    newThreadStatus = 'cancelled'
  } else if (taskStatus === 'blocked') {
    // Keep current status or set to paused
    newThreadStatus = 'paused'
  } else if (taskStatus === 'running') {
    newThreadStatus = 'executing'
  } else if (taskStatus === 'unconfirmed') {
    newThreadStatus = 'waiting_approval'
  } else if (taskStatus === 'queued') {
    // P6.9R: Handle queued status
    newThreadStatus = 'queued'
  }

  if (newThreadStatus !== thread.status) {
    const oldStatus = thread.status
    thread.status = newThreadStatus
    thread.updatedAt = new Date().toISOString()
    thread.lastActivityAt = thread.updatedAt

    // Add sync message
    if (isTerminalThreadStatus(newThreadStatus)) {
      // P6.18D6: For successful completion, add assistant message with real response
      if (newThreadStatus === 'completed') {
        const task = getTask(taskId)
        const assistantResponse = task?.result ? extractAssistantResponseFromResult(task.result) : null

        if (assistantResponse) {
          // Add assistant message with the actual response
          addMessage({
            threadId: thread.id,
            role: 'assistant',
            content: assistantResponse
          })
          console.log(`[TaskThreads] P6.18D6: Added assistant response for task ${taskId}`)
        } else {
          // Fallback: system message if no response extracted
          addMessage({
            threadId: thread.id,
            role: 'system',
            content: 'Tarea completada exitosamente'
          })
        }
      } else {
        // For other terminal states (failed, cancelled), use system message
        const message = taskError
          ? `Tarea finalizada: ${taskError}`
          : `Tarea finalizada (${newThreadStatus})`

        addMessage({
          threadId: thread.id,
          role: 'system',
          content: message
        })
      }
    }

    saveState()
    console.log(`[TaskThreads] P6.8: Synced thread ${thread.id} from ${oldStatus} to ${newThreadStatus} for task ${taskId}`)
  }

  return thread
}

/**
 * P6.8: Detect zombie threads
 *
 * A zombie thread is one that:
 * - Has an active status (thinking, executing, etc.)
 * - But its associated task is already terminal (success, error, etc.)
 */
export function detectZombieThreads(): Array<{
  thread: TaskThread
  taskId: string
  taskStatus: string | null
  reason: string
}> {
  const zombies: Array<{
    thread: TaskThread
    taskId: string
    taskStatus: string | null
    reason: string
  }> = []

  // Import task service dynamically to avoid circular deps
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getTask } = require('../tasks/service')

  for (const thread of state.threads) {
    // Skip already terminal threads
    if (isTerminalThreadStatus(thread.status)) continue

    // Check if thread is in an active state
    if (!ACTIVE_THREAD_STATUSES.includes(thread.status)) continue

    // Skip threads without taskId (they can't be zombie since they're standalone)
    const taskId = thread.taskId
    if (!taskId) continue

    // Get the associated task
    const task = getTask(taskId)

    if (!task) {
      // Thread has no associated task - orphan zombie
      zombies.push({
        thread,
        taskId,
        taskStatus: null,
        reason: 'orphan_no_task'
      })
    } else if (isTerminalTaskStatus(task.status)) {
      // Task is terminal but thread is still active - lifecycle zombie
      zombies.push({
        thread,
        taskId,
        taskStatus: task.status,
        reason: 'task_terminal_thread_active'
      })
    }
  }

  console.log(`[TaskThreads] P6.8: Detected ${zombies.length} zombie threads`)
  return zombies
}

/**
 * P6.8: Repair zombie threads by syncing them with task status
 */
export function repairZombieThreads(): {
  repaired: number
  failed: number
  details: Array<{ threadId: string; oldStatus: HumanTaskState; newStatus: HumanTaskState; reason: string }>
} {
  const zombies = detectZombieThreads()
  const details: Array<{ threadId: string; oldStatus: HumanTaskState; newStatus: HumanTaskState; reason: string }> = []
  let repaired = 0
  let failed = 0

  for (const zombie of zombies) {
    const oldStatus = zombie.thread.status
    let newStatus: HumanTaskState

    if (zombie.reason === 'orphan_no_task') {
      // Orphan thread - mark as failed
      newStatus = 'failed'
    } else if (zombie.taskStatus === 'success') {
      newStatus = 'completed'
    } else if (zombie.taskStatus === 'error') {
      newStatus = 'failed'
    } else if (zombie.taskStatus === 'cancelled') {
      newStatus = 'cancelled'
    } else {
      newStatus = 'failed'
    }

    try {
      zombie.thread.status = newStatus
      zombie.thread.updatedAt = new Date().toISOString()

      addMessage({
        threadId: zombie.thread.id,
        role: 'system',
        content: `[P6.8] Thread reparado: ${oldStatus} → ${newStatus} (${zombie.reason})`
      })

      details.push({ threadId: zombie.thread.id, oldStatus, newStatus, reason: zombie.reason })
      repaired++
    } catch (err) {
      failed++
      console.error(`[TaskThreads] P6.8: Failed to repair thread ${zombie.thread.id}:`, err)
    }
  }

  if (repaired > 0) {
    saveState()
  }

  console.log(`[TaskThreads] P6.8: Repaired ${repaired} zombie threads, ${failed} failed`)
  return { repaired, failed, details }
}

/**
 * P6.8: Detect duplicate threads (multiple threads for same task)
 */
export function detectDuplicateThreads(): Map<string, TaskThread[]> {
  const byTaskId = new Map<string, TaskThread[]>()

  for (const thread of state.threads) {
    // Skip threads without taskId
    const taskId = thread.taskId
    if (!taskId) continue

    const existing = byTaskId.get(taskId) || []
    existing.push(thread)
    byTaskId.set(taskId, existing)
  }

  // Filter to only those with duplicates
  const duplicates = new Map<string, TaskThread[]>()
  for (const [taskId, threads] of byTaskId) {
    if (threads.length > 1) {
      duplicates.set(taskId, threads)
    }
  }

  console.log(`[TaskThreads] P6.8: Detected ${duplicates.size} tasks with duplicate threads`)
  return duplicates
}

/**
 * P6.8: Merge duplicate threads for a task
 *
 * Strategy:
 * 1. Keep the thread with most messages
 * 2. Merge messages from other threads
 * 3. Mark other threads as merged (remove from active list)
 */
export function mergeDuplicateThreadsForTask(taskId: string): {
  kept: TaskThread | null
  merged: number
  totalMessages: number
} {
  const threads = getThreadsByTaskId(taskId)

  if (threads.length <= 1) {
    return { kept: threads[0] || null, merged: 0, totalMessages: threads[0]?.messages.length || 0 }
  }

  // Sort by message count (most messages first), then by creation date (oldest first)
  threads.sort((a, b) => {
    const msgDiff = b.messages.length - a.messages.length
    if (msgDiff !== 0) return msgDiff
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  })

  const kept = threads[0]
  const toMerge = threads.slice(1)

  // Collect all messages from threads to merge
  const allMessages: ThreadMessage[] = [...kept.messages]

  for (const thread of toMerge) {
    // Add messages that aren't duplicates
    for (const msg of thread.messages) {
      const isDuplicate = allMessages.some(
        m => m.content === msg.content && m.timestamp === msg.timestamp
      )
      if (!isDuplicate) {
        allMessages.push(msg)
      }
    }
  }

  // Sort messages by timestamp
  allMessages.sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )

  // Update kept thread with merged messages
  kept.messages = allMessages
  kept.updatedAt = new Date().toISOString()

  // Add merge note
  addMessage({
    threadId: kept.id,
    role: 'system',
    content: `[P6.8] Merged ${toMerge.length} duplicate thread(s) into this thread`
  })

  // Remove merged threads from state
  for (const thread of toMerge) {
    const index = state.threads.findIndex(t => t.id === thread.id)
    if (index !== -1) {
      state.threads.splice(index, 1)
    }
  }

  saveState()

  console.log(`[TaskThreads] P6.8: Merged ${toMerge.length} threads into ${kept.id} for task ${taskId}`)

  return {
    kept,
    merged: toMerge.length,
    totalMessages: allMessages.length
  }
}

/**
 * P6.8: Repair all duplicate threads
 */
export function repairDuplicateThreads(): {
  tasksProcessed: number
  threadsMerged: number
  details: Array<{ taskId: string; kept: string; merged: number }>
} {
  const duplicates = detectDuplicateThreads()
  const details: Array<{ taskId: string; kept: string; merged: number }> = []
  let threadsMerged = 0

  for (const [taskId] of duplicates) {
    const result = mergeDuplicateThreadsForTask(taskId)
    if (result.kept && result.merged > 0) {
      details.push({
        taskId,
        kept: result.kept.id,
        merged: result.merged
      })
      threadsMerged += result.merged
    }
  }

  console.log(`[TaskThreads] P6.8: Repaired duplicates for ${duplicates.size} tasks, merged ${threadsMerged} threads`)

  return {
    tasksProcessed: duplicates.size,
    threadsMerged,
    details
  }
}

/**
 * P6.8: Get execution truth for a task
 * Combines task status and thread status into a single truth
 */
export function getExecutionTruth(taskId: string): {
  taskId: string
  taskExists: boolean
  taskStatus: string | null
  threadExists: boolean
  threadId: string | null
  threadStatus: HumanTaskState | null
  threadCount: number
  isConsistent: boolean
  truthStatus: 'completed' | 'failed' | 'in_progress' | 'unknown'
  issues: string[]
} {
  // Import task service dynamically to avoid circular deps
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getTask } = require('../tasks/service')

  const task = getTask(taskId)
  const threads = getThreadsByTaskId(taskId)
  const thread = threads[0] || null

  const issues: string[] = []

  // Check for issues
  if (!task && thread) {
    issues.push('orphan_thread_no_task')
  }
  if (task && !thread) {
    issues.push('task_without_thread')
  }
  if (threads.length > 1) {
    issues.push(`duplicate_threads_${threads.length}`)
  }

  // Check consistency
  let isConsistent = true
  if (task && thread) {
    const taskTerminal = isTerminalTaskStatus(task.status)
    const threadTerminal = isTerminalThreadStatus(thread.status)

    if (taskTerminal !== threadTerminal) {
      isConsistent = false
      issues.push('lifecycle_mismatch')
    }

    // Check specific status mapping
    if (task.status === 'success' && thread.status !== 'completed') {
      isConsistent = false
      issues.push('success_not_completed')
    }
    if (task.status === 'error' && thread.status !== 'failed') {
      isConsistent = false
      issues.push('error_not_failed')
    }
  }

  // Determine truth status
  let truthStatus: 'completed' | 'failed' | 'in_progress' | 'unknown' = 'unknown'
  if (task) {
    if (task.status === 'success') truthStatus = 'completed'
    else if (task.status === 'error') truthStatus = 'failed'
    else if (task.status === 'running') truthStatus = 'in_progress'
  }

  return {
    taskId,
    taskExists: !!task,
    taskStatus: task?.status || null,
    threadExists: !!thread,
    threadId: thread?.id || null,
    threadStatus: thread?.status || null,
    threadCount: threads.length,
    isConsistent,
    truthStatus,
    issues
  }
}

// =============================================================================
// Initialization
// =============================================================================

// Load state on module init
loadState()
