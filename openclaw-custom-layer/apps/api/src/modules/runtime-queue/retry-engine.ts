/**
 * Retry Engine
 * PHASE H1: Runtime Hardening & Platform Stabilization
 *
 * Intelligent retry logic with error classification and backoff strategies.
 */

import type {
  QueuedJob,
  JobError,
  RetryPolicy,
  ErrorCategory,
  JobHandlerResult
} from './types'
import { DEFAULT_RETRY_POLICIES, DEFAULT_QUEUE_CONFIG } from './types'

/**
 * Error patterns for classification
 */
interface ErrorPattern {
  category: ErrorCategory
  patterns: Array<{
    code?: string | RegExp
    message?: string | RegExp
    type?: string
  }>
}

/**
 * Known error patterns for classification
 */
const ERROR_PATTERNS: ErrorPattern[] = [
  {
    category: 'transient',
    patterns: [
      { code: 'ETIMEDOUT' },
      { code: 'ECONNRESET' },
      { code: 'ECONNREFUSED' },
      { code: 'ENOTFOUND' },
      { code: /^5\d{2}$/ }, // 5xx HTTP errors
      { message: /timeout/i },
      { message: /network/i },
      { message: /connection refused/i },
      { message: /rate limit/i },
      { message: /too many requests/i },
      { code: '429' },
      { code: '503' },
      { code: '504' }
    ]
  },
  {
    category: 'resource',
    patterns: [
      { code: 'ENOMEM' },
      { code: 'ENOSPC' },
      { message: /out of memory/i },
      { message: /disk full/i },
      { message: /resource exhausted/i },
      { message: /quota exceeded/i },
      { message: /too many open files/i }
    ]
  },
  {
    category: 'validation',
    patterns: [
      { code: '400' },
      { code: '422' },
      { message: /validation/i },
      { message: /invalid input/i },
      { message: /invalid parameter/i },
      { message: /missing required/i },
      { message: /malformed/i },
      { type: 'ValidationError' }
    ]
  },
  {
    category: 'auth',
    patterns: [
      { code: '401' },
      { code: '403' },
      { message: /unauthorized/i },
      { message: /forbidden/i },
      { message: /authentication/i },
      { message: /invalid token/i },
      { message: /expired token/i },
      { message: /access denied/i }
    ]
  },
  {
    category: 'dependency',
    patterns: [
      { message: /dependency/i },
      { message: /prerequisite/i },
      { message: /depends on/i },
      { message: /waiting for/i }
    ]
  },
  {
    category: 'internal',
    patterns: [
      { code: '500' },
      { message: /internal error/i },
      { message: /unexpected error/i },
      { type: 'InternalError' }
    ]
  }
]

/**
 * Classify an error into a category
 */
export function classifyError(error: {
  message?: string
  code?: string
  name?: string
  type?: string
  statusCode?: number
}): ErrorCategory {
  const errorCode = error.code || (error.statusCode ? String(error.statusCode) : undefined)
  const errorMessage = error.message || ''
  const errorType = error.type || error.name

  for (const pattern of ERROR_PATTERNS) {
    for (const matcher of pattern.patterns) {
      // Check code
      if (matcher.code && errorCode) {
        if (typeof matcher.code === 'string' && matcher.code === errorCode) {
          return pattern.category
        }
        if (matcher.code instanceof RegExp && matcher.code.test(errorCode)) {
          return pattern.category
        }
      }

      // Check message
      if (matcher.message && errorMessage) {
        if (typeof matcher.message === 'string' && errorMessage.includes(matcher.message)) {
          return pattern.category
        }
        if (matcher.message instanceof RegExp && matcher.message.test(errorMessage)) {
          return pattern.category
        }
      }

      // Check type
      if (matcher.type && errorType === matcher.type) {
        return pattern.category
      }
    }
  }

  return 'unknown'
}

/**
 * Create a JobError from various error formats
 */
export function createJobError(
  error: unknown,
  retryAttempt: number,
  categoryOverride?: ErrorCategory
): JobError {
  let message = 'Unknown error'
  let code: string | undefined
  let stack: string | undefined
  let details: Record<string, unknown> | undefined

  if (error instanceof Error) {
    message = error.message
    stack = error.stack?.substring(0, 1000) // Truncate stack
    code = (error as NodeJS.ErrnoException).code
    if ('details' in error) {
      details = (error as { details?: Record<string, unknown> }).details
    }
  } else if (typeof error === 'string') {
    message = error
  } else if (error && typeof error === 'object') {
    const errorObj = error as Record<string, unknown>
    message = String(errorObj.message || errorObj.error || 'Unknown error')
    code = errorObj.code as string | undefined
    details = errorObj.details as Record<string, unknown> | undefined
  }

  const category = categoryOverride || classifyError({
    message,
    code,
    type: error instanceof Error ? error.constructor.name : undefined
  })

  return {
    message,
    code,
    category,
    stack,
    occurredAt: new Date().toISOString(),
    retryAttempt,
    details
  }
}

/**
 * Create JobError from handler result
 */
export function createJobErrorFromResult(
  result: JobHandlerResult,
  retryAttempt: number
): JobError {
  if (!result.error) {
    return {
      message: 'Job failed without error details',
      category: 'unknown',
      occurredAt: new Date().toISOString(),
      retryAttempt
    }
  }

  return {
    message: result.error.message,
    code: result.error.code,
    category: result.error.category || classifyError(result.error),
    occurredAt: new Date().toISOString(),
    retryAttempt,
    details: result.error.details
  }
}

/**
 * Get effective retry policy for a job
 */
export function getEffectiveRetryPolicy(job: QueuedJob): RetryPolicy {
  const defaultPolicy = DEFAULT_QUEUE_CONFIG.defaultRetryPolicy
  const categoryPolicy = job.lastError?.category
    ? DEFAULT_RETRY_POLICIES[job.lastError.category]
    : {}
  const jobPolicy = job.retryPolicy || {}

  return {
    maxRetries: jobPolicy.maxRetries ?? categoryPolicy.maxRetries ?? defaultPolicy.maxRetries,
    initialDelayMs: jobPolicy.initialDelayMs ?? categoryPolicy.initialDelayMs ?? defaultPolicy.initialDelayMs,
    maxDelayMs: jobPolicy.maxDelayMs ?? categoryPolicy.maxDelayMs ?? defaultPolicy.maxDelayMs,
    backoffMultiplier: jobPolicy.backoffMultiplier ?? categoryPolicy.backoffMultiplier ?? defaultPolicy.backoffMultiplier,
    jitterFactor: jobPolicy.jitterFactor ?? defaultPolicy.jitterFactor,
    nonRetryableCategories: jobPolicy.nonRetryableCategories ?? defaultPolicy.nonRetryableCategories
  }
}

/**
 * Determine if a job should be retried
 */
export interface RetryDecision {
  shouldRetry: boolean
  reason: string
  nextRetryAt?: string
  delayMs?: number
}

export function shouldRetry(
  job: QueuedJob,
  error: JobError,
  forceRetry?: boolean,
  skipRetry?: boolean
): RetryDecision {
  // Force skip
  if (skipRetry) {
    return {
      shouldRetry: false,
      reason: 'Retry skipped by handler'
    }
  }

  // Force retry
  if (forceRetry) {
    const policy = getEffectiveRetryPolicy(job)
    const delayMs = calculateRetryDelay(job.retryCount, policy)
    return {
      shouldRetry: true,
      reason: 'Retry forced by handler',
      nextRetryAt: new Date(Date.now() + delayMs).toISOString(),
      delayMs
    }
  }

  const policy = getEffectiveRetryPolicy(job)

  // Check if error category is non-retryable
  if (policy.nonRetryableCategories.includes(error.category)) {
    return {
      shouldRetry: false,
      reason: `Error category '${error.category}' is non-retryable`
    }
  }

  // Check max retries
  if (job.retryCount >= policy.maxRetries) {
    return {
      shouldRetry: false,
      reason: `Max retries reached (${job.retryCount}/${policy.maxRetries})`
    }
  }

  // Check deadline
  if (job.deadlineAt) {
    const deadline = new Date(job.deadlineAt)
    const delayMs = calculateRetryDelay(job.retryCount, policy)
    const nextRetryTime = new Date(Date.now() + delayMs)

    if (nextRetryTime >= deadline) {
      return {
        shouldRetry: false,
        reason: 'Deadline would be exceeded before next retry'
      }
    }
  }

  // Should retry
  const delayMs = calculateRetryDelay(job.retryCount, policy)
  return {
    shouldRetry: true,
    reason: `Retrying (attempt ${job.retryCount + 1}/${policy.maxRetries})`,
    nextRetryAt: new Date(Date.now() + delayMs).toISOString(),
    delayMs
  }
}

/**
 * Calculate retry delay with exponential backoff and jitter
 */
export function calculateRetryDelay(retryCount: number, policy: RetryPolicy): number {
  // Exponential backoff: initialDelay * (multiplier ^ retryCount)
  const exponentialDelay = policy.initialDelayMs * Math.pow(policy.backoffMultiplier, retryCount)

  // Cap at max delay
  const cappedDelay = Math.min(exponentialDelay, policy.maxDelayMs)

  // Add jitter: random value between 0 and jitterFactor * delay
  const jitter = cappedDelay * policy.jitterFactor * Math.random()

  return Math.round(cappedDelay + jitter)
}

/**
 * Analyze error history for patterns
 */
export interface ErrorAnalysis {
  /** Total errors */
  totalErrors: number
  /** Errors by category */
  byCategory: Record<ErrorCategory, number>
  /** Most common error category */
  dominantCategory: ErrorCategory | null
  /** Is error pattern consistent (same category) */
  isConsistent: boolean
  /** Time between errors (average ms) */
  avgTimeBetweenErrors: number
  /** Recommendation */
  recommendation: 'retry' | 'dead-letter' | 'investigate'
}

export function analyzeErrorHistory(job: QueuedJob): ErrorAnalysis {
  const errors = job.errorHistory

  if (errors.length === 0) {
    return {
      totalErrors: 0,
      byCategory: {} as Record<ErrorCategory, number>,
      dominantCategory: null,
      isConsistent: true,
      avgTimeBetweenErrors: 0,
      recommendation: 'retry'
    }
  }

  // Count by category
  const byCategory: Record<ErrorCategory, number> = {
    transient: 0,
    resource: 0,
    validation: 0,
    auth: 0,
    dependency: 0,
    internal: 0,
    unknown: 0
  }

  for (const error of errors) {
    byCategory[error.category]++
  }

  // Find dominant category
  let dominantCategory: ErrorCategory | null = null
  let maxCount = 0
  for (const [category, count] of Object.entries(byCategory)) {
    if (count > maxCount) {
      maxCount = count
      dominantCategory = category as ErrorCategory
    }
  }

  // Check consistency
  const isConsistent = maxCount === errors.length

  // Calculate average time between errors
  let totalTimeBetween = 0
  for (let i = 1; i < errors.length; i++) {
    const prev = new Date(errors[i - 1].occurredAt).getTime()
    const curr = new Date(errors[i].occurredAt).getTime()
    totalTimeBetween += curr - prev
  }
  const avgTimeBetweenErrors = errors.length > 1 ? totalTimeBetween / (errors.length - 1) : 0

  // Determine recommendation
  let recommendation: 'retry' | 'dead-letter' | 'investigate' = 'retry'

  if (dominantCategory === 'validation' || dominantCategory === 'auth') {
    recommendation = 'dead-letter'
  } else if (errors.length >= 3 && isConsistent && dominantCategory === 'internal') {
    recommendation = 'investigate'
  } else if (errors.length >= 5) {
    recommendation = 'dead-letter'
  }

  return {
    totalErrors: errors.length,
    byCategory,
    dominantCategory,
    isConsistent,
    avgTimeBetweenErrors,
    recommendation
  }
}

/**
 * Get human-readable retry status
 */
export function getRetryStatusMessage(job: QueuedJob): string {
  if (job.status !== 'retrying') {
    return ''
  }

  const policy = getEffectiveRetryPolicy(job)
  const remainingRetries = policy.maxRetries - job.retryCount

  if (!job.nextRetryAt) {
    return `Retrying... (${remainingRetries} attempts remaining)`
  }

  const nextRetry = new Date(job.nextRetryAt)
  const now = new Date()
  const waitMs = nextRetry.getTime() - now.getTime()

  if (waitMs <= 0) {
    return `Retry imminent (${remainingRetries} attempts remaining)`
  }

  const waitSecs = Math.ceil(waitMs / 1000)
  if (waitSecs < 60) {
    return `Retrying in ${waitSecs}s (${remainingRetries} attempts remaining)`
  }

  const waitMins = Math.ceil(waitSecs / 60)
  return `Retrying in ${waitMins}m (${remainingRetries} attempts remaining)`
}
