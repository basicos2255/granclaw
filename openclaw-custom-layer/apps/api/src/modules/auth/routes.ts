/**
 * Auth routes
 * FEATURE 070: Added /auth/register
 * FEATURE 071: Password auth + logout
 */

import type { IncomingMessage, ServerResponse } from 'http'
import { ok, badRequest, unauthorized } from '../../shared/response'
import { login, register, logout, validateToken } from './service'
import type { LoginInput, RegisterInput } from './types'

/**
 * Extract token from Authorization header
 */
function extractToken(req: IncomingMessage): string | null {
  const authHeader = req.headers.authorization
  if (!authHeader) return null

  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }

  return null
}

/**
 * POST /auth/login
 * FEATURE 071: Requires password
 */
export function handleLogin(req: IncomingMessage, res: ServerResponse): void {
  let body = ''

  req.on('data', (chunk) => {
    body += chunk.toString()
  })

  req.on('end', () => {
    let input: LoginInput

    if (!body) {
      badRequest(res, 'Request body is required')
      return
    }

    try {
      input = JSON.parse(body)
    } catch {
      badRequest(res, 'Invalid JSON body')
      return
    }

    if (!input.email) {
      badRequest(res, 'Email es requerido')
      return
    }

    if (!input.password) {
      badRequest(res, 'Password es requerido')
      return
    }

    const result = login(input)

    if (!result.success) {
      unauthorized(res, result.error || 'Login fallido')
      return
    }

    ok(res, {
      token: result.token,
      user: result.user
    })
  })

  req.on('error', () => {
    badRequest(res, 'Error reading request body')
  })
}

/**
 * GET /auth/me
 */
export function handleGetMe(req: IncomingMessage, res: ServerResponse): void {
  const token = extractToken(req)

  if (!token) {
    unauthorized(res, 'Authorization token required')
    return
  }

  const authContext = validateToken(token)

  if (!authContext) {
    unauthorized(res, 'Invalid or expired token')
    return
  }

  ok(res, {
    user: authContext.user,
    tenant: authContext.tenant
  })
}

/**
 * POST /auth/register
 * FEATURE 070: Public registration endpoint
 * FEATURE 071: Requires password
 */
export function handleRegister(req: IncomingMessage, res: ServerResponse): void {
  let body = ''

  req.on('data', (chunk) => {
    body += chunk.toString()
  })

  req.on('end', () => {
    let input: RegisterInput

    if (!body) {
      badRequest(res, 'Request body is required')
      return
    }

    try {
      input = JSON.parse(body)
    } catch {
      badRequest(res, 'Invalid JSON body')
      return
    }

    if (!input.email) {
      badRequest(res, 'Email es requerido')
      return
    }

    if (!input.password) {
      badRequest(res, 'Password es requerido')
      return
    }

    const result = register(input)

    if (!result.success) {
      badRequest(res, result.error || 'Registro fallido')
      return
    }

    ok(res, {
      token: result.token,
      user: result.user
    })
  })

  req.on('error', () => {
    badRequest(res, 'Error reading request body')
  })
}

/**
 * POST /auth/logout
 * FEATURE 071: Logout endpoint
 */
export function handleLogout(req: IncomingMessage, res: ServerResponse): void {
  const token = extractToken(req)

  if (!token) {
    ok(res, { success: true })
    return
  }

  logout(token)
  ok(res, { success: true })
}
