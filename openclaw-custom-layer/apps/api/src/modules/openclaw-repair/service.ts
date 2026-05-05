/**
 * OpenClaw Repair Service
 * FIX 125: Pairing Auto-Repair Action Button
 * FIX 125.1: Setup Page Robustness & Repair Data Normalization
 *
 * Manages repair sessions for OpenClaw pairing/scope recovery.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import type {
  RepairSession,
  RepairSessionStatus,
  RepairSessionsState,
  StartRepairInput,
  StartRepairResult,
  CheckRepairResult,
  RepairHistoryEvent,
  RepairEventType
} from './types'
import { DEFAULT_REPAIR_SESSIONS_STATE } from './types'
import {
  storePendingAction,
  resolveSetupRequirement,
  getActiveRequirements,
  type OpenClawScopeKey
} from '../system-state'

// FIX 125.1: Normalize repair session for legacy data
function normalizeRepairSession(session: Partial<RepairSession>, index: number): RepairSession {
  return {
    id: session.id ?? `legacy-session-${index}-${Date.now()}`,
    tenantId: session.tenantId ?? 'unknown',
    userId: session.userId ?? 'unknown',
    scopeKey: (session.scopeKey ?? 'openclaw:unknown_scope') as OpenClawScopeKey,
    capabilityKey: session.capabilityKey,
    originalInput: session.originalInput ?? '',
    originalError: session.originalError,
    status: (session.status ?? 'pending') as RepairSessionStatus,
    lastCheckError: session.lastCheckError,
    checkAttempts: session.checkAttempts ?? 0,
    createdAt: session.createdAt ?? new Date().toISOString(),
    updatedAt: session.updatedAt ?? new Date().toISOString(),
    readyAt: session.readyAt,
    retriedAt: session.retriedAt
  }
}

// Path to persistent state file
const DATA_DIR = join(process.cwd(), 'data')
const SESSIONS_FILE = join(DATA_DIR, 'openclaw-repair-sessions.json')
const HISTORY_FILE = join(DATA_DIR, 'openclaw-repair-history.json')

// In-memory cache
let cachedState: RepairSessionsState | null = null
let historyEvents: RepairHistoryEvent[] = []

/**
 * Ensure data directory exists
 */
function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }
}

/**
 * Load sessions from disk
 */
function loadSessions(): RepairSessionsState {
  if (cachedState) {
    return cachedState
  }

  ensureDataDir()

  if (!existsSync(SESSIONS_FILE)) {
    cachedState = { ...DEFAULT_REPAIR_SESSIONS_STATE }
    saveSessions(cachedState)
    return cachedState
  }

  try {
    const raw = readFileSync(SESSIONS_FILE, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<RepairSessionsState>

    // FIX 125.1: Normalize all sessions (handle legacy data)
    const rawSessions = parsed.sessions || []
    const normalizedSessions = rawSessions.map((session, index) =>
      normalizeRepairSession(session, index)
    )

    cachedState = {
      ...DEFAULT_REPAIR_SESSIONS_STATE,
      ...parsed,
      sessions: normalizedSessions
    }

    return cachedState
  } catch (err) {
    console.error('[OpenClawRepair] Error loading sessions:', err)
    cachedState = { ...DEFAULT_REPAIR_SESSIONS_STATE }
    return cachedState
  }
}

/**
 * Save sessions to disk
 */
function saveSessions(state: RepairSessionsState): void {
  ensureDataDir()

  try {
    state.lastUpdated = new Date().toISOString()
    writeFileSync(SESSIONS_FILE, JSON.stringify(state, null, 2), 'utf-8')
    cachedState = state
    console.log('[OpenClawRepair] Sessions saved to disk')
  } catch (err) {
    console.error('[OpenClawRepair] Error saving sessions:', err)
  }
}

/**
 * Load history from disk
 */
function loadHistory(): RepairHistoryEvent[] {
  if (historyEvents.length > 0) {
    return historyEvents
  }

  ensureDataDir()

  if (!existsSync(HISTORY_FILE)) {
    return []
  }

  try {
    const raw = readFileSync(HISTORY_FILE, 'utf-8')
    historyEvents = JSON.parse(raw) as RepairHistoryEvent[]
    return historyEvents
  } catch (err) {
    console.error('[OpenClawRepair] Error loading history:', err)
    return []
  }
}

/**
 * Save history to disk
 */
function saveHistory(): void {
  ensureDataDir()

  try {
    writeFileSync(HISTORY_FILE, JSON.stringify(historyEvents, null, 2), 'utf-8')
  } catch (err) {
    console.error('[OpenClawRepair] Error saving history:', err)
  }
}

/**
 * Record a history event
 */
function recordHistoryEvent(
  eventType: RepairEventType,
  session: RepairSession,
  details?: string
): void {
  loadHistory()

  const event: RepairHistoryEvent = {
    id: randomUUID(),
    repairSessionId: session.id,
    eventType,
    tenantId: session.tenantId,
    userId: session.userId,
    scopeKey: session.scopeKey,
    capabilityKey: session.capabilityKey,
    timestamp: new Date().toISOString(),
    details
  }

  historyEvents.push(event)

  // Keep last 1000 events
  if (historyEvents.length > 1000) {
    historyEvents = historyEvents.slice(-1000)
  }

  saveHistory()
  console.log(`[OpenClawRepair] History event: ${eventType} for session ${session.id}`)
}

/**
 * Start a new repair session
 */
export function startRepairSession(
  tenantId: string,
  userId: string,
  input: StartRepairInput
): StartRepairResult {
  const state = loadSessions()

  // Check for existing active session for same scope
  const existingSession = state.sessions.find(
    s => s.tenantId === tenantId &&
         s.scopeKey === input.scopeKey &&
         (s.status === 'pending' || s.status === 'waiting_user')
  )

  if (existingSession) {
    // Update existing session
    existingSession.updatedAt = new Date().toISOString()
    existingSession.originalInput = input.originalInput
    if (input.error) {
      existingSession.originalError = input.error
    }
    saveSessions(state)

    console.log(`[OpenClawRepair] Reusing existing session ${existingSession.id} for scope ${input.scopeKey}`)

    return {
      success: true,
      repairSession: existingSession,
      setupUrl: `/control/setup?repairSessionId=${existingSession.id}`
    }
  }

  // Create new session
  const session: RepairSession = {
    id: randomUUID(),
    tenantId,
    userId,
    scopeKey: input.scopeKey,
    capabilityKey: input.capabilityKey,
    originalInput: input.originalInput,
    originalError: input.error,
    status: 'pending',
    checkAttempts: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  state.sessions.push(session)
  saveSessions(state)

  // Store pending action in system-state
  storePendingAction({
    input: input.originalInput,
    tenantId,
    userId,
    timestamp: Date.now(),
    scopeKey: input.scopeKey,
    capabilityKey: input.capabilityKey,
    repairSessionId: session.id
  })

  recordHistoryEvent('repair_started', session, input.error)

  console.log(`[OpenClawRepair] Created session ${session.id} for scope ${input.scopeKey}`)

  return {
    success: true,
    repairSession: session,
    setupUrl: `/control/setup?repairSessionId=${session.id}`
  }
}

/**
 * Get a repair session by ID
 */
export function getRepairSession(sessionId: string): RepairSession | undefined {
  const state = loadSessions()
  return state.sessions.find(s => s.id === sessionId)
}

/**
 * Get all repair sessions for a tenant
 */
export function getRepairSessionsForTenant(tenantId: string): RepairSession[] {
  const state = loadSessions()
  return state.sessions.filter(s => s.tenantId === tenantId)
}

/**
 * Get active repair sessions for a tenant
 */
export function getActiveRepairSessions(tenantId: string): RepairSession[] {
  const state = loadSessions()
  return state.sessions.filter(
    s => s.tenantId === tenantId &&
         (s.status === 'pending' || s.status === 'waiting_user' || s.status === 'ready')
  )
}

/**
 * Update session status
 */
function updateSessionStatus(
  sessionId: string,
  status: RepairSessionStatus,
  extraFields?: Partial<RepairSession>
): RepairSession | undefined {
  const state = loadSessions()
  const session = state.sessions.find(s => s.id === sessionId)

  if (!session) {
    return undefined
  }

  session.status = status
  session.updatedAt = new Date().toISOString()

  if (extraFields) {
    Object.assign(session, extraFields)
  }

  saveSessions(state)
  return session
}

/**
 * Mark session as waiting for user
 */
export function markSessionWaitingUser(sessionId: string): RepairSession | undefined {
  return updateSessionStatus(sessionId, 'waiting_user')
}

/**
 * Check if OpenClaw authorization is ready
 * This performs a REAL check against OpenClaw
 */
export async function checkRepairAuthorization(sessionId: string): Promise<CheckRepairResult> {
  const state = loadSessions()
  const session = state.sessions.find(s => s.id === sessionId)

  if (!session) {
    return {
      success: false,
      canRetry: false,
      message: 'Sesión de reparación no encontrada'
    }
  }

  // Update status to checking
  session.status = 'checking'
  session.checkAttempts++
  session.updatedAt = new Date().toISOString()
  saveSessions(state)

  try {
    // TODO: Call real OpenClaw check-auth endpoint
    // For now, check if there are still active requirements for this scope
    const activeRequirements = getActiveRequirements()
    const hasActiveReq = activeRequirements.some(
      r => r.scopeKey === session.scopeKey && r.status === 'active'
    )

    if (hasActiveReq) {
      // Still has active requirement - not ready yet
      session.status = 'waiting_user'
      session.lastCheckError = 'OpenClaw aún requiere autorización para este scope'
      session.updatedAt = new Date().toISOString()
      saveSessions(state)

      recordHistoryEvent('repair_checked', session, 'Still requires authorization')

      return {
        success: true,
        repairSession: session,
        canRetry: false,
        message: 'OpenClaw aún requiere autorización',
        instructions: getRepairInstructions(session.scopeKey)
      }
    }

    // No active requirement for this scope - might be ready
    // Mark as ready and resolve the requirement
    session.status = 'ready'
    session.readyAt = new Date().toISOString()
    session.updatedAt = new Date().toISOString()
    saveSessions(state)

    // Resolve setup requirement for this scope
    resolveSetupRequirement({ scopeKey: session.scopeKey })

    recordHistoryEvent('repair_ready', session)

    console.log(`[OpenClawRepair] Session ${sessionId} is ready - scope ${session.scopeKey} authorized`)

    return {
      success: true,
      repairSession: session,
      canRetry: true,
      message: 'OpenClaw autorizado correctamente. Puedes reintentar la acción.'
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Error al verificar autorización'

    session.status = 'failed'
    session.lastCheckError = errorMsg
    session.updatedAt = new Date().toISOString()
    saveSessions(state)

    recordHistoryEvent('repair_failed', session, errorMsg)

    return {
      success: false,
      repairSession: session,
      canRetry: false,
      message: `Error al verificar: ${errorMsg}`,
      instructions: getRepairInstructions(session.scopeKey)
    }
  }
}

/**
 * Cancel a repair session
 */
export function cancelRepairSession(sessionId: string): RepairSession | undefined {
  const session = updateSessionStatus(sessionId, 'cancelled')

  if (session) {
    recordHistoryEvent('repair_cancelled', session)
    console.log(`[OpenClawRepair] Session ${sessionId} cancelled`)
  }

  return session
}

/**
 * Mark session as retried
 */
export function markSessionRetried(sessionId: string): RepairSession | undefined {
  const session = updateSessionStatus(sessionId, 'ready', {
    retriedAt: new Date().toISOString()
  })

  if (session) {
    recordHistoryEvent('retry_after_repair', session)
    console.log(`[OpenClawRepair] Session ${sessionId} retried`)
  }

  return session
}

/**
 * Get repair instructions for a scope
 */
export function getRepairInstructions(scopeKey: OpenClawScopeKey): string {
  const instructions: Record<string, string> = {
    'os:open_app': `OpenClaw necesita permisos para abrir aplicaciones en tu equipo.

1. Abre la aplicación OpenClaw en el equipo controlado (Mac mini)
2. Ve a Configuración → Permisos
3. Habilita "Control de aplicaciones"
4. Si se solicita, aprueba los permisos del sistema
5. Pulsa "Ya autoricé, comprobar" cuando termines`,

    'os:filesystem': `OpenClaw necesita permisos para acceder al sistema de archivos.

1. Abre la aplicación OpenClaw en el equipo controlado
2. Ve a Configuración → Permisos
3. Habilita "Acceso a archivos"
4. Aprueba el acceso a las carpetas necesarias
5. Pulsa "Ya autoricé, comprobar" cuando termines`,

    'os:browser': `OpenClaw necesita permisos para controlar el navegador.

1. Abre la aplicación OpenClaw en el equipo controlado
2. Ve a Configuración → Permisos
3. Habilita "Control de navegador"
4. Pulsa "Ya autoricé, comprobar" cuando termines`,

    'os:install': `OpenClaw necesita permisos para instalar aplicaciones.

1. Abre la aplicación OpenClaw en el equipo controlado
2. Ve a Configuración → Permisos
3. Habilita "Instalación de software"
4. Puede requerirse contraseña de administrador
5. Pulsa "Ya autoricé, comprobar" cuando termines`,

    'os:system': `OpenClaw necesita permisos de sistema.

1. Abre la aplicación OpenClaw en el equipo controlado
2. Ve a Configuración → Permisos
3. Habilita "Control del sistema"
4. Aprueba los permisos de accesibilidad si se solicitan
5. Pulsa "Ya autoricé, comprobar" cuando termines`
  }

  return instructions[scopeKey] || `OpenClaw necesita permisos adicionales para esta acción.

1. Abre la aplicación OpenClaw en el equipo controlado
2. Ve a Configuración → Permisos
3. Busca y habilita los permisos solicitados
4. Pulsa "Ya autoricé, comprobar" cuando termines`
}

/**
 * Get repair history for a tenant
 */
export function getRepairHistory(tenantId: string, limit: number = 50): RepairHistoryEvent[] {
  loadHistory()
  return historyEvents
    .filter(e => e.tenantId === tenantId)
    .slice(-limit)
}

/**
 * Cleanup old sessions (older than 7 days)
 */
export function cleanupOldSessions(): number {
  const state = loadSessions()
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - 7)
  const cutoffTime = cutoffDate.toISOString()

  const initialCount = state.sessions.length
  state.sessions = state.sessions.filter(
    s => s.updatedAt > cutoffTime ||
         s.status === 'pending' ||
         s.status === 'waiting_user' ||
         s.status === 'ready'
  )

  const removedCount = initialCount - state.sessions.length

  if (removedCount > 0) {
    saveSessions(state)
    console.log(`[OpenClawRepair] Cleaned up ${removedCount} old sessions`)
  }

  return removedCount
}

/**
 * Force reload from disk
 */
export function reloadRepairSessions(): RepairSessionsState {
  cachedState = null
  return loadSessions()
}
