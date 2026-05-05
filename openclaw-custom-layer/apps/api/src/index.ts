import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'

const envPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../../.env'),
  path.resolve(__dirname, '../../.env')
]

let loaded = false

for (const p of envPaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p })
    console.log('[ENV] Loaded from:', p)
    loaded = true
    break
  }
}

if (!loaded) {
  console.warn('[ENV] No .env file found in expected paths')
}

// Validación de variables de entorno críticas
if (!process.env.OPENCLAW_BASE_URL) {
  console.warn('[ENV] OPENCLAW_BASE_URL not loaded')
}

if (!process.env.OPENCLAW_API_KEY) {
  console.warn('[ENV] OPENCLAW_API_KEY not loaded')
}

/**
 * GranClaw API - Servidor HTTP nativo
 * Sin Express, sin Fastify
 * Con autenticación real y tenant isolation
 */

import { createServer, IncomingMessage, ServerResponse } from 'http'
import { URL } from 'url'

import { handleHealth } from './modules/health'
import { handleTenants } from './modules/tenants'
import { handleUsers } from './modules/users'
import { handlePresets, handleCreatePreset } from './modules/presets'
import { handleAgents, handleCreateAgent } from './modules/agents'
import { handleListSessions, handleGetSession, handleCreateSession, handleAddMessage } from './modules/sessions'
import { handleTasks, handleGetTaskById, handleExecuteSteps } from './modules/tasks'
import { handleGetToolProposals, handleGetToolProposalById, handleApproveToolProposal, handleRejectToolProposal, handleArchiveToolProposal } from './modules/tool-proposals'
import { handleGetCapabilities, handleGetCapabilityById, handleEnableCapability, handleDisableCapability, handleDeleteCapability } from './modules/capabilities'
// FIX 113: OS Tools routes
import { handleGetOSTools, handleGetPendingConfirmations, handleConfirmOSTool, handleCleanupOSTools } from './modules/os-tools'
// FEATURE 120: Execution Policy routes
import { handleGetExecutionPolicy, handleSetExecutionPolicy } from './modules/execution-policy'
import { handleAudit } from './modules/audit'
import { handleOpenClawStatus, handleOpenClawWsStatus, handleWebhookTest, handleWsRpcStatus, handleToolsStatus, handleAuthStatus, handleCheckAuth } from './modules/openclaw'
// FIX 123: System State routes
import { handleGetSystemState, handleGetPendingAction, handleClearPendingAction, handleConsumePendingAction, handleMarkOpenClawReady } from './modules/system-state'
// FIX 125: OpenClaw Repair routes
import {
  handleStartRepair,
  handleGetRepairSession,
  handleCheckRepair,
  handleCancelRepair,
  handleRetryRepair,
  handleGetActiveRepairs,
  handleGetRepairHistory
} from './modules/openclaw-repair'
import { handleOrchestratorRun, handleOrchestratorRunStream } from './modules/orchestrator'
import { handleLogin, handleGetMe, handleRegister, handleLogout } from './modules/auth'
import { handleListTools, handleGetTool } from './modules/tools'
import { handleGetAllConfig, handleGetTenantConfig, handleSetTenantConfig, handleDeleteTenantConfig } from './modules/granclaw-hub'
import { notFound } from './shared/response'
import { requireAuth, isPublicEndpoint } from './shared/auth-context'
import type { AuthContext } from './modules/auth'

const PORT = process.env.APP_PORT || 3001

type RouteHandler = (req: IncomingMessage, res: ServerResponse, context: AuthContext | null) => void | Promise<void>
type DynamicRouteHandler = (req: IncomingMessage, res: ServerResponse, param: string, context: AuthContext | null) => void | Promise<void>

// Wrappers para adaptar handlers sin contexto a handlers con contexto
const wrapHandler = (handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>): RouteHandler => {
  return (req, res, _context) => handler(req, res)
}

const wrapDynamicHandler = (handler: (req: IncomingMessage, res: ServerResponse, param: string) => void): DynamicRouteHandler => {
  return (req, res, param, _context) => handler(req, res, param)
}

// FIX 113: Wrapper for handleGetPendingConfirmations to extract sessionId from query
const wrapPendingConfirmationsHandler: RouteHandler = (req, res, context) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`)
  const sessionId = url.searchParams.get('sessionId') || undefined
  handleGetPendingConfirmations(req, res, context, sessionId)
}

// FIX 125: Wrappers for repair handlers (swap param/context order)
const wrapRepairGetHandler: DynamicRouteHandler = (req, res, param, context) => {
  handleGetRepairSession(req, res, context, param)
}
const wrapRepairCheckHandler: DynamicRouteHandler = (req, res, param, context) => {
  handleCheckRepair(req, res, context, param)
}
const wrapRepairCancelHandler: DynamicRouteHandler = (req, res, param, context) => {
  handleCancelRepair(req, res, context, param)
}
const wrapRepairRetryHandler: DynamicRouteHandler = (req, res, param, context) => {
  handleRetryRepair(req, res, context, param)
}

// GET routes - public endpoints usan wrapper sin contexto
const getRoutes: Record<string, RouteHandler> = {
  '/health': wrapHandler(handleHealth),
  '/tenants': handleTenants,
  '/users': handleUsers,
  '/presets': handlePresets,
  '/agents': handleAgents,
  '/sessions': handleListSessions,
  '/tasks': handleTasks,
  '/tool-proposals': handleGetToolProposals,
  '/capabilities': handleGetCapabilities,
  '/audit': handleAudit,
  '/tools': wrapHandler(handleListTools),
  '/openclaw/status': wrapHandler(handleOpenClawStatus),
  '/openclaw/ws-status': wrapHandler(handleOpenClawWsStatus),
  '/openclaw/ws-rpc-status': wrapHandler(handleWsRpcStatus),
  '/openclaw/tools-status': wrapHandler(handleToolsStatus),
  '/openclaw/auth-status': wrapHandler(handleAuthStatus),
  '/openclaw/check-auth': wrapHandler(handleCheckAuth),
  // FIX 123: System State routes
  '/system/state': handleGetSystemState,
  '/system/pending-action': handleGetPendingAction,
  '/auth/me': wrapHandler(handleGetMe),
  '/granclaw-hub/config': handleGetAllConfig,
  // FIX 113: OS Tools routes
  '/os-tools': handleGetOSTools,
  '/os-tools/pending': wrapPendingConfirmationsHandler,
  // FEATURE 120: Execution Policy
  '/execution-policy': handleGetExecutionPolicy,
  // FIX 125: OpenClaw Repair routes
  '/openclaw/repair/active': handleGetActiveRepairs,
  '/openclaw/repair/history': handleGetRepairHistory
}

// POST routes
const postRoutes: Record<string, RouteHandler> = {
  '/auth/login': wrapHandler(handleLogin),
  '/auth/register': wrapHandler(handleRegister),
  '/auth/logout': wrapHandler(handleLogout),
  '/presets': handleCreatePreset,
  '/agents': handleCreateAgent,
  '/sessions': handleCreateSession,
  '/openclaw/webhook/test': wrapHandler(handleWebhookTest),
  '/orchestrator/run': handleOrchestratorRun,
  '/orchestrator/run-stream': handleOrchestratorRunStream,
  // FIX 113: OS Tools routes
  '/os-tools/confirm': handleConfirmOSTool,
  '/os-tools/cleanup': handleCleanupOSTools,
  // FEATURE 120: Execution Policy
  '/execution-policy': handleSetExecutionPolicy,
  // FIX 123: System State routes
  '/system/clear-pending-action': handleClearPendingAction,
  '/system/consume-pending-action': handleConsumePendingAction,
  '/system/mark-openclaw-ready': handleMarkOpenClawReady,
  // FIX 125: OpenClaw Repair routes
  '/openclaw/repair/start': handleStartRepair,
  // FIX 126: Execute steps for timeout recovery
  '/tasks/execute-steps': handleExecuteSteps
}

// Rutas dinámicas con parámetros
interface DynamicRoute {
  pattern: RegExp
  handler: DynamicRouteHandler
}

const getDynamicRoutes: DynamicRoute[] = [
  {
    pattern: /^\/sessions\/([^/]+)$/,
    handler: handleGetSession
  },
  {
    pattern: /^\/tasks\/([^/]+)$/,
    handler: handleGetTaskById
  },
  {
    pattern: /^\/tools\/([^/]+)$/,
    handler: wrapDynamicHandler(handleGetTool)
  },
  {
    pattern: /^\/tool-proposals\/([^/]+)$/,
    handler: handleGetToolProposalById
  },
  {
    pattern: /^\/capabilities\/([^/]+)$/,
    handler: handleGetCapabilityById
  },
  {
    pattern: /^\/granclaw-hub\/config\/([^/]+)$/,
    handler: handleGetTenantConfig
  },
  // FIX 125: OpenClaw Repair
  {
    pattern: /^\/openclaw\/repair\/([^/]+)$/,
    handler: wrapRepairGetHandler
  }
]

const postDynamicRoutes: DynamicRoute[] = [
  {
    pattern: /^\/sessions\/([^/]+)\/message$/,
    handler: handleAddMessage
  },
  {
    pattern: /^\/tool-proposals\/([^/]+)\/approve$/,
    handler: handleApproveToolProposal
  },
  {
    pattern: /^\/tool-proposals\/([^/]+)\/reject$/,
    handler: handleRejectToolProposal
  },
  {
    pattern: /^\/tool-proposals\/([^/]+)\/archive$/,
    handler: handleArchiveToolProposal
  },
  {
    pattern: /^\/capabilities\/([^/]+)\/enable$/,
    handler: handleEnableCapability
  },
  {
    pattern: /^\/capabilities\/([^/]+)\/disable$/,
    handler: handleDisableCapability
  },
  {
    pattern: /^\/granclaw-hub\/config\/([^/]+)$/,
    handler: handleSetTenantConfig
  },
  // FIX 125: OpenClaw Repair
  {
    pattern: /^\/openclaw\/repair\/([^/]+)\/check$/,
    handler: wrapRepairCheckHandler
  },
  {
    pattern: /^\/openclaw\/repair\/([^/]+)\/cancel$/,
    handler: wrapRepairCancelHandler
  },
  {
    pattern: /^\/openclaw\/repair\/([^/]+)\/retry$/,
    handler: wrapRepairRetryHandler
  }
]

const deleteDynamicRoutes: DynamicRoute[] = [
  {
    pattern: /^\/granclaw-hub\/config\/([^/]+)$/,
    handler: handleDeleteTenantConfig
  },
  // FIX 104: Eliminar capability
  {
    pattern: /^\/capabilities\/([^/]+)$/,
    handler: handleDeleteCapability
  }
]

function matchDynamicRoute(pathname: string, routes: DynamicRoute[]): { handler: DynamicRouteHandler; param: string } | null {
  for (const route of routes) {
    const match = pathname.match(route.pattern)
    if (match) {
      return { handler: route.handler, param: match[1] }
    }
  }
  return null
}

function handleRequest(req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`)
  const pathname = url.pathname

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  // Auth check - siempre se ejecuta, pero solo bloquea en rutas protegidas
  const { authorized, context } = requireAuth(req, res, pathname)
  if (!authorized) {
    return // Response ya enviada por requireAuth
  }

  if (req.method === 'GET') {
    // Rutas estáticas
    const handler = getRoutes[pathname]
    if (handler) {
      handler(req, res, context)
      return
    }

    // Rutas dinámicas
    const dynamicMatch = matchDynamicRoute(pathname, getDynamicRoutes)
    if (dynamicMatch) {
      dynamicMatch.handler(req, res, dynamicMatch.param, context)
      return
    }
  }

  if (req.method === 'POST') {
    // Rutas estáticas
    const handler = postRoutes[pathname]
    if (handler) {
      handler(req, res, context)
      return
    }

    // Rutas dinámicas
    const dynamicMatch = matchDynamicRoute(pathname, postDynamicRoutes)
    if (dynamicMatch) {
      dynamicMatch.handler(req, res, dynamicMatch.param, context)
      return
    }
  }

  if (req.method === 'DELETE') {
    // Rutas dinámicas
    const dynamicMatch = matchDynamicRoute(pathname, deleteDynamicRoutes)
    if (dynamicMatch) {
      dynamicMatch.handler(req, res, dynamicMatch.param, context)
      return
    }
  }

  notFound(res, `Route ${pathname} not found`)
}

const server = createServer(handleRequest)

server.listen(PORT, () => {
  console.log(`GranClaw API running on http://localhost:${PORT}`)
  console.log('Available endpoints:')
  Object.keys(getRoutes).forEach((route) => {
    const isPublic = isPublicEndpoint(route)
    console.log(`  GET ${route}${isPublic ? ' (public)' : ''}`)
  })
  console.log('  GET /sessions/:id')
  console.log('  GET /tasks/:id')
  console.log('  GET /tools/:id')
  console.log('  GET /tool-proposals/:id')
  console.log('  GET /capabilities/:id')
  console.log('  GET /granclaw-hub/config/:tenantId')
  Object.keys(postRoutes).forEach((route) => {
    const isPublic = isPublicEndpoint(route)
    console.log(`  POST ${route}${isPublic ? ' (public)' : ''}`)
  })
  console.log('  POST /sessions/:id/message')
  console.log('  POST /tool-proposals/:id/approve')
  console.log('  POST /tool-proposals/:id/reject')
  console.log('  POST /capabilities/:id/enable')
  console.log('  POST /capabilities/:id/disable')
  console.log('  POST /granclaw-hub/config/:tenantId')
  console.log('  DELETE /granclaw-hub/config/:tenantId')
  // FIX 113: OS Tools endpoints
  console.log('  GET /os-tools')
  console.log('  GET /os-tools/pending?sessionId=xxx')
  console.log('  POST /os-tools/confirm')
  console.log('  POST /os-tools/cleanup')
  // FEATURE 120: Execution Policy endpoints
  console.log('  GET /execution-policy')
  console.log('  POST /execution-policy')
})

