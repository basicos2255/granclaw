/**
 * Runtime WebSocket Authentication
 * P1.2: Realtime Product Shell & WS Runtime
 *
 * Handles WebSocket connection authentication and authorization.
 */

import type { IncomingMessage } from 'http'
import { validateToken } from '../auth'

/**
 * Authentication result
 */
export interface WsAuthResult {
  authenticated: boolean
  tenantId?: string
  userId?: string
  error?: string
}

/**
 * Authenticate WebSocket connection from upgrade request
 *
 * Extracts token from:
 * 1. Query parameter: ?token=xxx
 * 2. Authorization header: Bearer xxx
 * 3. Cookie: auth_token=xxx
 */
export function authenticateWsConnection(req: IncomingMessage): WsAuthResult {
  try {
    // Extract token from various sources
    const token = extractToken(req)

    if (!token) {
      return {
        authenticated: false,
        error: 'No authentication token provided'
      }
    }

    // Verify token
    const context = validateToken(token)

    if (!context) {
      return {
        authenticated: false,
        error: 'Invalid or expired token'
      }
    }

    return {
      authenticated: true,
      tenantId: context.tenant.id,
      userId: context.user.id
    }
  } catch (err) {
    console.error('[WsAuth] Authentication error:', err)
    return {
      authenticated: false,
      error: 'Authentication failed'
    }
  }
}

/**
 * Extract token from request
 */
function extractToken(req: IncomingMessage): string | null {
  // 1. Query parameter
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  const queryToken = url.searchParams.get('token')
  if (queryToken) {
    return queryToken
  }

  // 2. Authorization header
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }

  // 3. Cookie
  const cookies = req.headers.cookie
  if (cookies) {
    const tokenCookie = cookies
      .split(';')
      .map(c => c.trim())
      .find(c => c.startsWith('auth_token='))

    if (tokenCookie) {
      return tokenCookie.split('=')[1]
    }
  }

  return null
}

/**
 * Check if user can access a specific workflow
 */
export function canAccessWorkflow(
  tenantId: string,
  _userId: string,
  workflowTenantId: string
): boolean {
  // Tenant isolation: can only access own tenant's workflows
  return tenantId === workflowTenantId
}

/**
 * Check if user can subscribe to a channel
 */
export function canSubscribeToChannel(
  tenantId: string,
  _userId: string,
  channel: string,
  workflowTenantId?: string
): boolean {
  // Debug channel restricted (could be configurable)
  if (channel === 'debug') {
    // For now, allow all authenticated users
    // Could add admin check here
    return true
  }

  // Workflow channel requires matching tenant
  if (channel === 'workflow' && workflowTenantId) {
    return tenantId === workflowTenantId
  }

  // Other channels allowed for authenticated users
  return true
}

/**
 * Validate message from client
 */
export function validateClientMessage(
  message: unknown,
  clientTenantId: string
): { valid: boolean; error?: string } {
  if (typeof message !== 'object' || message === null) {
    return { valid: false, error: 'Invalid message format' }
  }

  const msg = message as Record<string, unknown>

  // Check for tenant spoofing
  if (msg.tenantId && msg.tenantId !== clientTenantId) {
    return { valid: false, error: 'Tenant mismatch' }
  }

  // Required fields
  if (!msg.type) {
    return { valid: false, error: 'Missing message type' }
  }

  const validTypes = ['subscribe', 'unsubscribe', 'ping', 'ack']
  if (!validTypes.includes(msg.type as string)) {
    return { valid: false, error: 'Invalid message type' }
  }

  return { valid: true }
}
