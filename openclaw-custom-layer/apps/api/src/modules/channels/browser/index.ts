/**
 * Browser Automation Channel
 * P3: Real Integrations & Operational Channels
 *
 * Browser automation via Playwright (separate provider, not coupled to core).
 */

import type {
  BrowserAction,
  BrowserPageState
} from '../../channels-runtime/types'
import { emitChannelEvent } from '../../channels-runtime/event-adapter'
import { enqueueChannelAction } from '../../channels-runtime/runtime-integration'
import { getChannel, updateChannelMetrics } from '../../channels-runtime/channel-manager'

/**
 * Browser channel configuration
 */
export interface BrowserChannelConfig {
  browserType: 'chromium' | 'firefox' | 'webkit'
  headless: boolean
  timeout: number
  viewport: {
    width: number
    height: number
  }
  userAgent?: string
  proxy?: {
    server: string
    username?: string
    password?: string
  }
}

/**
 * Browser session tracking
 */
interface BrowserSession {
  id: string
  channelId: string
  startedAt: string
  currentUrl?: string
  pageTitle?: string
  isActive: boolean
}

const activeSessions: Map<string, BrowserSession> = new Map()

/**
 * Navigate to a URL
 */
export async function navigateTo(
  channelId: string,
  url: string,
  options: {
    userId?: string
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle'
    timeout?: number
  } = {}
): Promise<{ queued: boolean; requestId?: string; error?: string }> {
  const channel = getChannel(channelId)
  if (!channel) {
    return { queued: false, error: 'Channel not found' }
  }

  if (channel.config.type !== 'browser') {
    return { queued: false, error: 'Not a browser channel' }
  }

  return enqueueChannelAction(
    channel.config,
    'navigate',
    { url, waitUntil: options.waitUntil, timeout: options.timeout },
    { userId: options.userId }
  )
}

/**
 * Click on an element
 */
export async function clickElement(
  channelId: string,
  selector: string,
  options: {
    userId?: string
    button?: 'left' | 'right' | 'middle'
    clickCount?: number
    delay?: number
  } = {}
): Promise<{ queued: boolean; requestId?: string; error?: string }> {
  const channel = getChannel(channelId)
  if (!channel) {
    return { queued: false, error: 'Channel not found' }
  }

  return enqueueChannelAction(
    channel.config,
    'click',
    { selector, ...options },
    { userId: options.userId }
  )
}

/**
 * Type text into an element
 */
export async function typeText(
  channelId: string,
  selector: string,
  text: string,
  options: {
    userId?: string
    delay?: number
    clearFirst?: boolean
  } = {}
): Promise<{ queued: boolean; requestId?: string; error?: string }> {
  const channel = getChannel(channelId)
  if (!channel) {
    return { queued: false, error: 'Channel not found' }
  }

  return enqueueChannelAction(
    channel.config,
    'type',
    { selector, text, delay: options.delay, clearFirst: options.clearFirst },
    { userId: options.userId }
  )
}

/**
 * Take a screenshot
 */
export async function takeScreenshot(
  channelId: string,
  options: {
    userId?: string
    fullPage?: boolean
    selector?: string
    format?: 'png' | 'jpeg'
    quality?: number
  } = {}
): Promise<{ queued: boolean; requestId?: string; error?: string }> {
  const channel = getChannel(channelId)
  if (!channel) {
    return { queued: false, error: 'Channel not found' }
  }

  return enqueueChannelAction(
    channel.config,
    'screenshot',
    options,
    { userId: options.userId }
  )
}

/**
 * Extract data from page
 */
export async function extractData(
  channelId: string,
  extractions: Array<{
    name: string
    selector: string
    attribute?: string // 'text' | 'href' | 'src' | custom attribute
    multiple?: boolean
  }>,
  options: {
    userId?: string
  } = {}
): Promise<{ queued: boolean; requestId?: string; error?: string }> {
  const channel = getChannel(channelId)
  if (!channel) {
    return { queued: false, error: 'Channel not found' }
  }

  return enqueueChannelAction(
    channel.config,
    'extract',
    { extractions },
    { userId: options.userId }
  )
}

/**
 * Wait for element or condition
 */
export async function waitFor(
  channelId: string,
  params: {
    selector?: string
    condition?: 'visible' | 'hidden' | 'attached' | 'detached'
    timeout?: number
    state?: 'load' | 'domcontentloaded' | 'networkidle'
  },
  options: {
    userId?: string
  } = {}
): Promise<{ queued: boolean; requestId?: string; error?: string }> {
  const channel = getChannel(channelId)
  if (!channel) {
    return { queued: false, error: 'Channel not found' }
  }

  return enqueueChannelAction(
    channel.config,
    'wait',
    params,
    { userId: options.userId }
  )
}

/**
 * Scroll page or element
 */
export async function scroll(
  channelId: string,
  params: {
    direction?: 'up' | 'down' | 'left' | 'right'
    amount?: number
    selector?: string
    toBottom?: boolean
    toTop?: boolean
  },
  options: {
    userId?: string
  } = {}
): Promise<{ queued: boolean; requestId?: string; error?: string }> {
  const channel = getChannel(channelId)
  if (!channel) {
    return { queued: false, error: 'Channel not found' }
  }

  return enqueueChannelAction(
    channel.config,
    'scroll',
    params,
    { userId: options.userId }
  )
}

/**
 * Execute JavaScript on page
 */
export async function evaluate(
  channelId: string,
  script: string,
  args?: unknown[],
  options: {
    userId?: string
  } = {}
): Promise<{ queued: boolean; requestId?: string; error?: string }> {
  const channel = getChannel(channelId)
  if (!channel) {
    return { queued: false, error: 'Channel not found' }
  }

  // Script execution is high-risk
  return enqueueChannelAction(
    channel.config,
    'evaluate',
    { script, args },
    { userId: options.userId, priority: 'high' }
  )
}

/**
 * Execute a sequence of browser actions
 */
export async function executeWorkflow(
  channelId: string,
  actions: BrowserAction[],
  options: {
    userId?: string
    stopOnError?: boolean
    screenshotOnError?: boolean
  } = {}
): Promise<{ queued: boolean; requestId?: string; error?: string }> {
  const channel = getChannel(channelId)
  if (!channel) {
    return { queued: false, error: 'Channel not found' }
  }

  return enqueueChannelAction(
    channel.config,
    'workflow',
    { actions, stopOnError: options.stopOnError, screenshotOnError: options.screenshotOnError },
    { userId: options.userId }
  )
}

/**
 * Handle page loaded event
 */
export async function handlePageLoaded(
  channelId: string,
  state: BrowserPageState,
  tenantId: string
): Promise<void> {
  await emitChannelEvent(
    channelId,
    'browser',
    'browser:page_loaded',
    state,
    {
      tenantId,
      metadata: {
        url: state.url,
        title: state.title
      }
    }
  )

  // Update session
  const session = activeSessions.get(channelId)
  if (session) {
    session.currentUrl = state.url
    session.pageTitle = state.title
  }

  console.log(`[BrowserChannel] Page loaded: ${state.url}`)
}

/**
 * Handle action complete event
 */
export async function handleActionComplete(
  channelId: string,
  action: string,
  result: unknown,
  tenantId: string
): Promise<void> {
  await emitChannelEvent(
    channelId,
    'browser',
    'browser:action_complete',
    { action, result },
    { tenantId }
  )

  // Update metrics
  const channel = getChannel(channelId)
  if (channel) {
    updateChannelMetrics(channelId, {
      messagesProcessed: (channel.metrics?.messagesProcessed || 0) + 1
    })
  }
}

/**
 * Handle screenshot taken event
 */
export async function handleScreenshotTaken(
  channelId: string,
  screenshot: {
    data: string // base64
    url: string
    timestamp: string
  },
  tenantId: string
): Promise<void> {
  await emitChannelEvent(
    channelId,
    'browser',
    'browser:screenshot_taken',
    screenshot,
    { tenantId }
  )

  console.log(`[BrowserChannel] Screenshot taken at ${screenshot.url}`)
}

/**
 * Handle browser error
 */
export async function handleBrowserError(
  channelId: string,
  error: {
    type: 'navigation' | 'timeout' | 'selector' | 'script' | 'network'
    message: string
    url?: string
    selector?: string
  },
  tenantId: string
): Promise<void> {
  await emitChannelEvent(
    channelId,
    'browser',
    'browser:error',
    error,
    { tenantId }
  )

  // Update metrics
  const channel = getChannel(channelId)
  if (channel) {
    updateChannelMetrics(channelId, {
      errorsLastHour: (channel.metrics?.errorsLastHour || 0) + 1
    })
  }

  console.error(`[BrowserChannel] Error: ${error.type} - ${error.message}`)
}

/**
 * Validate page content
 */
export async function validatePage(
  channelId: string,
  validations: Array<{
    name: string
    type: 'exists' | 'text_contains' | 'text_equals' | 'visible' | 'count'
    selector: string
    expected?: string | number
  }>
): Promise<Array<{
  name: string
  passed: boolean
  actual?: unknown
  error?: string
}>> {
  const channel = getChannel(channelId)
  if (!channel) return []

  // TODO: Implement actual validation via browser
  console.log(`[BrowserChannel] Validating page with ${validations.length} checks`)
  return validations.map(v => ({ name: v.name, passed: false, error: 'Not implemented' }))
}

/**
 * Get active session info
 */
export function getActiveSession(channelId: string): BrowserSession | undefined {
  return activeSessions.get(channelId)
}

/**
 * Start a browser session
 */
export function startSession(channelId: string): BrowserSession {
  const session: BrowserSession = {
    id: `bs_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    channelId,
    startedAt: new Date().toISOString(),
    isActive: true
  }
  activeSessions.set(channelId, session)
  return session
}

/**
 * End a browser session
 */
export function endSession(channelId: string): void {
  const session = activeSessions.get(channelId)
  if (session) {
    session.isActive = false
    activeSessions.delete(channelId)
  }
}
