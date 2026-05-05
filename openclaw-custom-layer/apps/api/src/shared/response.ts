/**
 * Response helpers - Respuestas estándar de la API
 */

import { ServerResponse } from 'http'

interface ApiResponse<T> {
  success: boolean
  data: T | null
  error: string | null
}

export function ok<T>(res: ServerResponse, data: T, statusCode = 200): void {
  const response: ApiResponse<T> = {
    success: true,
    data,
    error: null
  }
  sendJson(res, response, statusCode)
}

export function error(res: ServerResponse, message: string, statusCode = 400): void {
  const response: ApiResponse<null> = {
    success: false,
    data: null,
    error: message
  }
  sendJson(res, response, statusCode)
}

export function notFound(res: ServerResponse, message = 'Not found'): void {
  error(res, message, 404)
}

export function badRequest(res: ServerResponse, message = 'Bad request'): void {
  error(res, message, 400)
}

export function serverError(res: ServerResponse, message = 'Internal server error'): void {
  error(res, message, 500)
}

export function unauthorized(res: ServerResponse, message = 'Unauthorized'): void {
  error(res, message, 401)
}

export function forbidden(res: ServerResponse, message = 'Forbidden'): void {
  error(res, message, 403)
}

/**
 * Envía respuesta JSON directa (sin wrapper ApiResponse)
 * Útil para respuestas que no siguen el formato estándar
 */
export function json<T>(res: ServerResponse, data: T, statusCode = 200): void {
  sendJson(res, data, statusCode)
}

function sendJson<T>(res: ServerResponse, data: T, statusCode: number): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}
