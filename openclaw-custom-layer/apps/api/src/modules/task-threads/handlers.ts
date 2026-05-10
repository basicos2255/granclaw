/**
 * Task Threads Handlers
 * P6.6: Human Interaction Layer, Task Threads & Conversational Control
 *
 * Native HTTP handlers for task threads API.
 */

import type { IncomingMessage, ServerResponse } from 'http'
import {
  createThread,
  getThread,
  getThreadByTaskId,
  getActiveThread,
  listThreads,
  updateThreadStatus,
  addUserMessage,
  addRuntimeMessage,
  addAssistantMessage,
  setThreadPlan,
  refinePlan,
  createApproval,
  resolveApproval,
  getPendingApprovals,
  pauseThread,
  resumeThread,
  cancelThread,
  completeThread,
  failThread,
  updateContext
} from './service'
import type { CreateThreadInput, HumanReadablePlan } from './types'

// =============================================================================
// Helpers
// =============================================================================

function jsonResponse(res: ServerResponse, data: unknown, status: number = 200): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

function errorResponse(res: ServerResponse, error: string, status: number = 400): void {
  jsonResponse(res, { success: false, error }, status)
}

async function parseBody<T>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'))
      } catch {
        reject(new Error('Invalid JSON'))
      }
    })
    req.on('error', reject)
  })
}

// =============================================================================
// Thread Handlers
// =============================================================================

/**
 * GET /threads
 */
export async function handleListThreads(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url || '/', `http://${req.headers.host}`)
  const tenantId = url.searchParams.get('tenantId') || 'default'
  const limit = parseInt(url.searchParams.get('limit') || '50')

  const threads = listThreads(tenantId, limit)
  jsonResponse(res, { success: true, data: threads })
}

/**
 * GET /threads/active
 */
export async function handleGetActiveThread(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url || '/', `http://${req.headers.host}`)
  const tenantId = url.searchParams.get('tenantId') || 'default'

  const thread = getActiveThread(tenantId)
  jsonResponse(res, { success: true, data: thread })
}

/**
 * GET /threads/:id
 */
export async function handleGetThread(req: IncomingMessage, res: ServerResponse, threadId: string): Promise<void> {
  const thread = getThread(threadId)
  if (!thread) {
    return errorResponse(res, 'Thread not found', 404)
  }
  jsonResponse(res, { success: true, data: thread })
}

/**
 * GET /threads/by-task/:taskId
 */
export async function handleGetThreadByTask(req: IncomingMessage, res: ServerResponse, taskId: string): Promise<void> {
  const thread = getThreadByTaskId(taskId)
  jsonResponse(res, { success: true, data: thread })
}

/**
 * POST /threads
 */
export async function handleCreateThread(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const body = await parseBody<CreateThreadInput>(req)

    if (!body.tenantId || !body.title) {
      return errorResponse(res, 'tenantId and title are required')
    }

    const thread = createThread(body)
    jsonResponse(res, { success: true, data: thread }, 201)
  } catch (err) {
    errorResponse(res, 'Invalid request body')
  }
}

/**
 * PATCH /threads/:id/status
 */
export async function handleUpdateStatus(req: IncomingMessage, res: ServerResponse, threadId: string): Promise<void> {
  try {
    const body = await parseBody<{ status: string }>(req)
    const thread = updateThreadStatus(threadId, body.status as any)
    if (!thread) {
      return errorResponse(res, 'Thread not found', 404)
    }
    jsonResponse(res, { success: true, data: thread })
  } catch (err) {
    errorResponse(res, 'Invalid request body')
  }
}

// =============================================================================
// Message Handlers
// =============================================================================

/**
 * POST /threads/:id/messages
 */
export async function handleAddMessage(req: IncomingMessage, res: ServerResponse, threadId: string): Promise<void> {
  try {
    const body = await parseBody<{ content: string }>(req)

    if (!body.content) {
      return errorResponse(res, 'content is required')
    }

    const result = addUserMessage(threadId, body.content)
    if (!result.message) {
      return errorResponse(res, 'Thread not found', 404)
    }

    jsonResponse(res, {
      success: true,
      data: {
        message: result.message,
        detectedAction: result.detectedAction,
        shouldContinue: result.shouldContinue
      }
    }, 201)
  } catch (err) {
    errorResponse(res, 'Invalid request body')
  }
}

/**
 * POST /threads/:id/messages/runtime
 */
export async function handleAddRuntimeMessage(req: IncomingMessage, res: ServerResponse, threadId: string): Promise<void> {
  try {
    const body = await parseBody<{
      content: string
      workflowStep?: any
      outputs?: any[]
      artifacts?: any[]
    }>(req)

    const message = addRuntimeMessage(threadId, body.content, body.workflowStep, body.outputs, body.artifacts)
    if (!message) {
      return errorResponse(res, 'Thread not found', 404)
    }

    jsonResponse(res, { success: true, data: message }, 201)
  } catch (err) {
    errorResponse(res, 'Invalid request body')
  }
}

/**
 * POST /threads/:id/messages/assistant
 */
export async function handleAddAssistantMessage(req: IncomingMessage, res: ServerResponse, threadId: string): Promise<void> {
  try {
    const body = await parseBody<{
      content: string
      explanation?: any
    }>(req)

    const message = addAssistantMessage(threadId, body.content, body.explanation)
    if (!message) {
      return errorResponse(res, 'Thread not found', 404)
    }

    jsonResponse(res, { success: true, data: message }, 201)
  } catch (err) {
    errorResponse(res, 'Invalid request body')
  }
}

// =============================================================================
// Plan Handlers
// =============================================================================

/**
 * POST /threads/:id/plan
 */
export async function handleSetPlan(req: IncomingMessage, res: ServerResponse, threadId: string): Promise<void> {
  try {
    const plan = await parseBody<HumanReadablePlan>(req)
    const thread = setThreadPlan(threadId, plan)
    if (!thread) {
      return errorResponse(res, 'Thread not found', 404)
    }
    jsonResponse(res, { success: true, data: thread.currentPlan })
  } catch (err) {
    errorResponse(res, 'Invalid request body')
  }
}

/**
 * POST /threads/:id/refine
 */
export async function handleRefinePlan(req: IncomingMessage, res: ServerResponse, threadId: string): Promise<void> {
  try {
    const body = await parseBody<{ refinement: string; applyTo?: string }>(req)

    if (!body.refinement) {
      return errorResponse(res, 'refinement is required')
    }

    const plan = refinePlan({
      threadId,
      refinement: body.refinement,
      applyTo: body.applyTo as any
    })

    jsonResponse(res, { success: true, data: plan })
  } catch (err) {
    errorResponse(res, 'Invalid request body')
  }
}

// =============================================================================
// Context Handlers
// =============================================================================

/**
 * PATCH /threads/:id/context
 */
export async function handleUpdateContext(req: IncomingMessage, res: ServerResponse, threadId: string): Promise<void> {
  try {
    const body = await parseBody<{
      preferences?: Record<string, any>
      filters?: string[]
      decision?: any
      entity?: any
    }>(req)

    const context = updateContext({
      threadId,
      ...body
    })

    if (!context) {
      return errorResponse(res, 'Thread not found', 404)
    }

    jsonResponse(res, { success: true, data: context })
  } catch (err) {
    errorResponse(res, 'Invalid request body')
  }
}

// =============================================================================
// Approval Handlers
// =============================================================================

/**
 * GET /threads/:id/approvals
 */
export async function handleGetApprovals(req: IncomingMessage, res: ServerResponse, threadId: string): Promise<void> {
  const approvals = getPendingApprovals(threadId)
  jsonResponse(res, { success: true, data: approvals })
}

/**
 * POST /threads/:id/approvals
 */
export async function handleCreateApproval(req: IncomingMessage, res: ServerResponse, threadId: string): Promise<void> {
  try {
    const body = await parseBody<{
      type: string
      action: string
      description: string
      risks?: string[]
    }>(req)

    if (!body.type || !body.action || !body.description) {
      return errorResponse(res, 'type, action, and description are required')
    }

    const approval = createApproval(
      threadId,
      body.type as any,
      body.action,
      body.description,
      body.risks
    )

    if (!approval) {
      return errorResponse(res, 'Thread not found', 404)
    }

    jsonResponse(res, { success: true, data: approval }, 201)
  } catch (err) {
    errorResponse(res, 'Invalid request body')
  }
}

/**
 * POST /threads/:id/approvals/:approvalId/resolve
 */
export async function handleResolveApproval(
  req: IncomingMessage,
  res: ServerResponse,
  threadId: string,
  approvalId: string
): Promise<void> {
  try {
    const body = await parseBody<{ approved: boolean; userId?: string }>(req)

    const approval = resolveApproval(threadId, approvalId, body.approved, body.userId)
    if (!approval) {
      return errorResponse(res, 'Thread or approval not found', 404)
    }

    jsonResponse(res, { success: true, data: approval })
  } catch (err) {
    errorResponse(res, 'Invalid request body')
  }
}

// =============================================================================
// Action Handlers
// =============================================================================

/**
 * POST /threads/:id/pause
 */
export async function handlePauseThread(req: IncomingMessage, res: ServerResponse, threadId: string): Promise<void> {
  const thread = pauseThread(threadId)
  if (!thread) {
    return errorResponse(res, 'Thread not found', 404)
  }
  jsonResponse(res, { success: true, data: thread })
}

/**
 * POST /threads/:id/resume
 */
export async function handleResumeThread(req: IncomingMessage, res: ServerResponse, threadId: string): Promise<void> {
  const thread = resumeThread(threadId)
  if (!thread) {
    return errorResponse(res, 'Thread not found', 404)
  }
  jsonResponse(res, { success: true, data: thread })
}

/**
 * POST /threads/:id/cancel
 */
export async function handleCancelThread(req: IncomingMessage, res: ServerResponse, threadId: string): Promise<void> {
  try {
    const body = await parseBody<{ reason?: string }>(req)
    const thread = cancelThread(threadId, body.reason)
    if (!thread) {
      return errorResponse(res, 'Thread not found', 404)
    }
    jsonResponse(res, { success: true, data: thread })
  } catch (err) {
    const thread = cancelThread(threadId)
    if (!thread) {
      return errorResponse(res, 'Thread not found', 404)
    }
    jsonResponse(res, { success: true, data: thread })
  }
}

/**
 * POST /threads/:id/complete
 */
export async function handleCompleteThread(req: IncomingMessage, res: ServerResponse, threadId: string): Promise<void> {
  try {
    const body = await parseBody<{
      summary: string
      outputs?: any[]
      artifacts?: any[]
    }>(req)

    if (!body.summary) {
      return errorResponse(res, 'summary is required')
    }

    const thread = completeThread(threadId, body.summary, body.outputs, body.artifacts)
    if (!thread) {
      return errorResponse(res, 'Thread not found', 404)
    }

    jsonResponse(res, { success: true, data: thread })
  } catch (err) {
    errorResponse(res, 'Invalid request body')
  }
}

/**
 * POST /threads/:id/fail
 */
export async function handleFailThread(req: IncomingMessage, res: ServerResponse, threadId: string): Promise<void> {
  try {
    const body = await parseBody<{
      error: string
      recoverable?: boolean
    }>(req)

    if (!body.error) {
      return errorResponse(res, 'error is required')
    }

    const thread = failThread(threadId, body.error, body.recoverable)
    if (!thread) {
      return errorResponse(res, 'Thread not found', 404)
    }

    jsonResponse(res, { success: true, data: thread })
  } catch (err) {
    errorResponse(res, 'Invalid request body')
  }
}
