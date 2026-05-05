/**
 * Auth context middleware
 * Extrae y valida token, proporciona contexto de usuario/tenant
 */

import type { IncomingMessage, ServerResponse } from 'http'
import { validateToken, type AuthContext } from '../modules/auth'
import { unauthorized } from './response'

/**
 * Endpoints públicos que no requieren autenticación
 * PROTEGIDOS (requieren auth): /tools, /openclaw/tools-status
 * FEATURE 070: Added /auth/register
 */
const PUBLIC_ENDPOINTS = [
  '/health',
  '/auth/login',
  '/auth/register',
  '/openclaw/status',
  '/openclaw/ws-status',
  '/openclaw/ws-rpc-status'
]

/**
 * Verifica si un endpoint es público
 */
export function isPublicEndpoint(pathname: string): boolean {
  return PUBLIC_ENDPOINTS.some((ep) => pathname === ep || pathname.startsWith(`${ep}/`))
}

/**
 * Extrae token del header Authorization
 */
export function extractToken(req: IncomingMessage): string | null {
  const authHeader = req.headers.authorization
  if (!authHeader) return null

  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }

  return null
}

/**
 * Obtiene contexto de autenticación de la request
 * Retorna null si no hay token o es inválido
 */
export function getAuthContext(req: IncomingMessage): AuthContext | null {
  const token = extractToken(req)
  if (!token) return null

  return validateToken(token)
}

/**
 * Middleware que requiere autenticación
 * Retorna true si autorizado, false si no (y envía respuesta 401)
 */
export function requireAuth(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string
): { authorized: boolean; context: AuthContext | null } {
  // Endpoints públicos no requieren auth
  if (isPublicEndpoint(pathname)) {
    return { authorized: true, context: null }
  }

  const context = getAuthContext(req)

  if (!context) {
    unauthorized(res, 'Authentication required')
    return { authorized: false, context: null }
  }

  return { authorized: true, context }
}

/**
 * Tipo para handlers con contexto de autenticación
 */
export type AuthenticatedHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  context: AuthContext | null
) => void

/**
 * Wrapper para crear handlers autenticados
 */
export function withAuth(handler: AuthenticatedHandler): (req: IncomingMessage, res: ServerResponse, pathname: string) => void {
  return (req: IncomingMessage, res: ServerResponse, pathname: string) => {
    const { authorized, context } = requireAuth(req, res, pathname)

    if (!authorized) {
      return // Response already sent by requireAuth
    }

    handler(req, res, context)
  }
}
