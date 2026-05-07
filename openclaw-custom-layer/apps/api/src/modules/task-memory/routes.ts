/**
 * Task Memory Routes
 * FEATURE 130: Advanced Tasks (Persistent, Reusable, Optimized Execution)
 * FIX 130.1: Safe Task Memory Matching & Validation
 *
 * API endpoints for task memory management.
 * Uses native http (not Express) to match project conventions.
 */

import type { IncomingMessage, ServerResponse } from 'http'
import { URL } from 'url'
import { ok, badRequest, serverError, notFound } from '../../shared/response'
import {
  findPatternByInput,
  getRecentPatterns,
  getTopPatterns,
  getTaskMemoryStats,
  getAllPatterns,
  deletePattern,
  clearAllPatterns,
  normalizeTaskInput,
  invalidatePattern,
  validatePattern
} from './service'

/**
 * GET /task-memory/patterns
 * Get all patterns with optional filtering
 */
export function handleGetPatterns(req: IncomingMessage, res: ServerResponse): void {
  try {
    const url = new URL(req.url || '/', 'http://localhost')
    const sort = url.searchParams.get('sort')
    const limit = url.searchParams.get('limit')

    let patterns
    const limitNum = limit ? parseInt(limit, 10) : 50

    switch (sort) {
      case 'recent':
        patterns = getRecentPatterns(limitNum)
        break
      case 'top':
        patterns = getTopPatterns(limitNum)
        break
      default:
        patterns = getAllPatterns().slice(0, limitNum)
    }

    ok(res, {
      success: true,
      patterns,
      count: patterns.length
    })
  } catch (err) {
    console.error('[TaskMemory] Error getting patterns:', err)
    serverError(res, 'Error al obtener patrones')
  }
}

/**
 * GET /task-memory/stats
 * Get task memory statistics
 */
export function handleGetStats(req: IncomingMessage, res: ServerResponse): void {
  try {
    const stats = getTaskMemoryStats()
    ok(res, {
      success: true,
      stats
    })
  } catch (err) {
    console.error('[TaskMemory] Error getting stats:', err)
    serverError(res, 'Error al obtener estadísticas')
  }
}

/**
 * POST /task-memory/find
 * Find a matching pattern for an input
 * FIX 130.1: Now requires tenantId for safe matching
 */
export function handleFindPattern(req: IncomingMessage, res: ServerResponse): void {
  let body = ''

  req.on('data', (chunk) => {
    body += chunk.toString()
  })

  req.on('end', () => {
    try {
      const data = body ? JSON.parse(body) : {}
      const { input, tenantId } = data

      if (!input || typeof input !== 'string') {
        badRequest(res, 'Se requiere input')
        return
      }

      if (!tenantId || typeof tenantId !== 'string') {
        badRequest(res, 'Se requiere tenantId')
        return
      }

      const normalizedIntent = normalizeTaskInput(input)
      const result = findPatternByInput({ input, tenantId })

      ok(res, {
        success: true,
        ...result,
        normalizedIntent,
        signature: normalizedIntent.signature
      })
    } catch (err) {
      console.error('[TaskMemory] Error finding pattern:', err)
      serverError(res, 'Error al buscar patrón')
    }
  })

  req.on('error', () => {
    badRequest(res, 'Error reading request body')
  })
}

/**
 * DELETE /task-memory/patterns/:id
 * Delete a specific pattern
 */
export function handleDeletePattern(req: IncomingMessage, res: ServerResponse, patternId?: string): void {
  try {
    // patternId comes from the dynamic route parameter
    if (!patternId) {
      badRequest(res, 'Se requiere ID del patrón')
      return
    }

    const deleted = deletePattern(patternId)

    if (deleted) {
      ok(res, {
        success: true,
        message: 'Patrón eliminado'
      })
    } else {
      notFound(res, 'Patrón no encontrado')
    }
  } catch (err) {
    console.error('[TaskMemory] Error deleting pattern:', err)
    serverError(res, 'Error al eliminar patrón')
  }
}

/**
 * POST /task-memory/clear
 * Clear all patterns (admin only)
 */
export function handleClearPatterns(req: IncomingMessage, res: ServerResponse): void {
  let body = ''

  req.on('data', (chunk) => {
    body += chunk.toString()
  })

  req.on('end', () => {
    try {
      const data = body ? JSON.parse(body) : {}
      const { confirm } = data

      if (confirm !== 'CLEAR_ALL') {
        badRequest(res, 'Se requiere confirmación: { "confirm": "CLEAR_ALL" }')
        return
      }

      clearAllPatterns()

      ok(res, {
        success: true,
        message: 'Todos los patrones eliminados'
      })
    } catch (err) {
      console.error('[TaskMemory] Error clearing patterns:', err)
      serverError(res, 'Error al limpiar patrones')
    }
  })

  req.on('error', () => {
    badRequest(res, 'Error reading request body')
  })
}

/**
 * POST /task-memory/normalize
 * Normalize an input (for testing/debugging)
 * FIX 130.1: Returns full NormalizedIntent
 */
export function handleNormalizeInput(req: IncomingMessage, res: ServerResponse): void {
  let body = ''

  req.on('data', (chunk) => {
    body += chunk.toString()
  })

  req.on('end', () => {
    try {
      const data = body ? JSON.parse(body) : {}
      const { input } = data

      if (!input || typeof input !== 'string') {
        badRequest(res, 'Se requiere input')
        return
      }

      const normalizedIntent = normalizeTaskInput(input)

      ok(res, {
        success: true,
        original: input,
        ...normalizedIntent
      })
    } catch (err) {
      console.error('[TaskMemory] Error normalizing input:', err)
      serverError(res, 'Error al normalizar input')
    }
  })

  req.on('error', () => {
    badRequest(res, 'Error reading request body')
  })
}

/**
 * POST /task-memory/patterns/:id/invalidate
 * FIX 130.1: Manually invalidate a pattern
 */
export function handleInvalidatePattern(req: IncomingMessage, res: ServerResponse, patternId?: string): void {
  let body = ''

  req.on('data', (chunk) => {
    body += chunk.toString()
  })

  req.on('end', () => {
    try {
      if (!patternId) {
        badRequest(res, 'Se requiere ID del patrón')
        return
      }

      const data = body ? JSON.parse(body) : {}
      const reason = data.reason || 'Invalidado manualmente'

      const success = invalidatePattern(patternId, reason)

      if (success) {
        ok(res, {
          success: true,
          message: 'Patrón invalidado',
          patternId,
          reason
        })
      } else {
        notFound(res, 'Patrón no encontrado')
      }
    } catch (err) {
      console.error('[TaskMemory] Error invalidating pattern:', err)
      serverError(res, 'Error al invalidar patrón')
    }
  })

  req.on('error', () => {
    badRequest(res, 'Error reading request body')
  })
}

/**
 * POST /task-memory/patterns/:id/validate
 * FIX 130.1: Revalidate an invalidated pattern
 */
export function handleValidatePattern(req: IncomingMessage, res: ServerResponse, patternId?: string): void {
  try {
    if (!patternId) {
      badRequest(res, 'Se requiere ID del patrón')
      return
    }

    const success = validatePattern(patternId)

    if (success) {
      ok(res, {
        success: true,
        message: 'Patrón revalidado',
        patternId
      })
    } else {
      notFound(res, 'Patrón no encontrado')
    }
  } catch (err) {
    console.error('[TaskMemory] Error validating pattern:', err)
    serverError(res, 'Error al validar patrón')
  }
}
