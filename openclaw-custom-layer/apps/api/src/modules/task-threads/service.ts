/**
 * Task Threads Service
 * P6.6: Human Interaction Layer, Task Threads & Conversational Control
 *
 * Service for managing conversational task threads.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
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
 */
export function createThread(input: CreateThreadInput): TaskThread {
  const now = new Date().toISOString()

  const thread: TaskThread = {
    id: generateId('thread'),
    taskId: input.taskId,
    tenantId: input.tenantId,
    userId: input.userId,
    title: input.title,
    status: 'thinking',
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

  state.threads.push(thread)
  saveState()

  console.log(`[TaskThreads] Created thread ${thread.id} for task ${input.taskId}`)
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
// Initialization
// =============================================================================

// Load state on module init
loadState()
