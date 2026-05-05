/**
 * Orchestrator routes
 * Con tenant isolation via auth context
 * FEATURE 050: GranClaw Hub integration
 * FEATURE 051: Hub v2 con decisionLog
 * FEATURE 073: Real execution trace
 * FEATURE 074: Execution guarantees
 * FEATURE 075: Debug Snapshot & Bottom Status Bar
 * FEATURE 080: Task System v1
 * FEATURE 090: Tool Proposal System v1
 */

import type { IncomingMessage, ServerResponse } from 'http'
import { ok, badRequest, unauthorized } from '../../shared/response'
import { runSimpleAgentTask, runStreamingTask, getAdapterStatus } from './service'
import type { RunTaskInput, StreamTaskInput } from './types'
import type { AuthContext } from '../auth'
import { getGranClawHubService } from '../granclaw-hub'
import { ExecutionTraceBuilder, type DebugSnapshot } from './trace'
import { createTask, completeTask, type TaskStatus } from '../tasks'
import { detectMissingCapability, createToolProposal, findExistingProposal, countDuplicateProposals } from '../tool-proposals'
import { getEnabledCapabilityByKey, getCapabilityByKey, normalizeCapabilityKey, countCapabilitiesByKey, dispatchCapabilityExecution, type ExecutionMode } from '../capabilities'
// FEATURE 110: OS Tools - keeping imports for whitelist check
import { isOSToolCapability, getOSToolConfig } from '../os-tools'

/**
 * FIX 111: Capability execution is now handled by capability-dispatcher.ts
 * This removes the large switch statement and centralizes execution logic.
 */

/**
 * FEATURE 075: Logs sanitizados de debug
 */
function logDebug(snapshot: DebugSnapshot): void {
  console.log(`[GranClaw Debug] requestId=${snapshot.requestId}`)
  console.log(`[GranClaw Debug] hubEvaluated=${snapshot.hubEvaluated} allowed=${snapshot.hubAllowed ?? 'N/A'}`)
  console.log(`[GranClaw Debug] orchestratorCalled=${snapshot.orchestratorCalled}`)
  console.log(`[GranClaw Debug] source=${snapshot.source ?? 'unknown'}`)
  console.log(`[GranClaw Debug] executionConfirmed=${snapshot.executionConfirmed}`)
  if (snapshot.error) {
    console.log(`[GranClaw Debug] error=${snapshot.error}`)
  }
}

export function handleOrchestratorRun(req: IncomingMessage, res: ServerResponse, context: AuthContext | null): void {
  // Rutas protegidas requieren contexto
  if (!context) {
    unauthorized(res, 'Authentication required')
    return
  }

  let body = ''

  req.on('data', (chunk) => {
    body += chunk.toString()
  })

  req.on('end', async () => {
    let input: RunTaskInput

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

    if (!input.message) {
      badRequest(res, 'Field "message" is required')
      return
    }

    // FEATURE 073/075: Crear trace builder con requestId
    const trace = new ExecutionTraceBuilder()
    trace.setRoute('/run')
    trace.setTenantId(context.tenant.id)
    trace.setUserId(context.user.id)
    trace.setSessionPresent(true)

    // FIX 077: Log al inicio del flujo
    console.log(`[GranClaw] Starting request ${trace.requestId} for tenant ${context.tenant.id}`)

    // FEATURE 080: Crear tarea al inicio
    const task = createTask({
      tenantId: context.tenant.id,
      userId: context.user.id,
      requestId: trace.requestId,
      input: input.message
    })
    console.log(`[GranClaw] Created task ${task.id}`)

    // FIX 077: Try/catch para garantizar meta en todas las respuestas
    try {
      trace.hubStart()

      // FEATURE 050: GranClaw Hub - control previo al orchestrator
      const hub = getGranClawHubService()
      const hubResult = hub.process({
        sessionId: input.sessionId || 'anonymous',
        agentId: input.agentId,
        message: input.message,
        tenantId: context.tenant.id,
        userId: context.user.id
      })

      // FEATURE 074: Obtener estado del adaptador
      const adapterStatus = getAdapterStatus()

      if (!hubResult.allowed) {
        // FEATURE 073: Trace bloqueado
        trace.hubBlocked(hubResult.reason || 'Politicas de empresa')

        // FEATURE 075: Debug snapshot y logs
        const debugSnapshot = trace.getDebugSnapshot()
        logDebug(debugSnapshot)

        // FEATURE 080: Actualizar tarea como bloqueada
        completeTask(
          task.id,
          'blocked',
          undefined,
          undefined,
          trace.getSteps(),
          debugSnapshot,
          trace.getTotalDurationMs(),
          hubResult.reason
        )

        ok(res, {
          success: false,
          error: 'Blocked by GranClaw Hub',
          reason: hubResult.reason,
          // FEATURE 051: Incluir decision log
          // FEATURE 073/074/075: Incluir execution trace, diagnostico y debugSnapshot
          meta: {
            requestId: trace.requestId,
            taskId: task.id,
            hubDecision: hubResult.decisionLog,
            executionTrace: trace.getSteps(),
            executionDurationMs: trace.getTotalDurationMs(),
            tenantId: context.tenant.id,
            adapterStatus,
            debugSnapshot
          }
        })
        return
      }

      // FEATURE 073: Hub permitio
      trace.hubAllowed(context.tenant.id)
      trace.orchestratorStart()

      // FEATURE 090/091 + FIX 104/105: Detectar capacidad con lookup robusto
      const missingCapability = detectMissingCapability(input.message)
      if (missingCapability) {
        // FIX 104: Usar capabilityKey normalizada para lookup
        const capabilityKey = missingCapability.capabilityKey || normalizeCapabilityKey(missingCapability.proposedToolName)

        // FIX 105: Diagnostic logs y lookup completo
        const capabilityAny = getCapabilityByKey(context.tenant.id, capabilityKey)
        const capabilityEnabled = getEnabledCapabilityByKey(context.tenant.id, capabilityKey)
        const proposalCount = countDuplicateProposals(context.tenant.id, capabilityKey)
        const capabilityCount = countCapabilitiesByKey(context.tenant.id, capabilityKey)

        console.log(`[Capability Lookup] tenantId=${context.tenant.id}`)
        console.log(`[Capability Lookup] capabilityKey=${capabilityKey}`)
        console.log(`[Capability Lookup] capabilityFound=${!!capabilityAny}`)
        console.log(`[Capability Lookup] enabled=${capabilityAny?.enabled ?? false}`)
        console.log(`[Capability Lookup] proposalCount=${proposalCount}`)
        console.log(`[Capability Lookup] duplicateCapabilities=${capabilityCount}`)

        // Case A: Capability exists and enabled - execute via dispatcher (FIX 111)
        if (capabilityEnabled) {
          console.log(`[GranClaw] Executing approved capability: ${capabilityEnabled.toolName} (key: ${capabilityKey})`)

          // FIX 111: Use dispatcher instead of direct execution
          // FIX 112: Get mode from hub config, not hubResult
          const hubConfig = hub.getConfig(context.tenant.id)
          const executionMode: ExecutionMode = hubConfig.mode === 'passthrough' ? 'passthrough' : 'strict'

          const dispatchResult = await dispatchCapabilityExecution(capabilityEnabled, {
            tenantId: context.tenant.id,
            userId: context.user.id,
            sessionId: input.sessionId || 'default',
            mode: executionMode,
            requestedAction: input.message
          })

          // Handle confirmation required
          if (dispatchResult.confirmationRequired) {
            trace.addStep({
              stage: 'tool',
              status: 'pending',
              label: 'Confirmacion requerida',
              detail: `OS Tool: ${capabilityEnabled.toolName} requiere confirmacion`
            })

            const debugSnapshot = trace.getDebugSnapshot()
            debugSnapshot.toolCalled = false
            debugSnapshot.executionConfirmed = false
            debugSnapshot.source = 'granclaw' as const
            logDebug(debugSnapshot)

            completeTask(
              task.id,
              'pending',
              dispatchResult.result,
              'granclaw-os-tool',
              trace.getSteps(),
              debugSnapshot,
              trace.getTotalDurationMs()
            )

            ok(res, {
              success: true,
              result: dispatchResult.result,
              mode: dispatchResult.mode,
              meta: {
                requestId: trace.requestId,
                taskId: task.id,
                capabilityId: capabilityEnabled.id,
                capabilityName: capabilityEnabled.toolName,
                capabilityKey,
                pendingConfirmation: true,
                confirmationId: dispatchResult.confirmationId,
                hubDecision: hubResult.decisionLog,
                executionTrace: trace.getSteps(),
                executionDurationMs: trace.getTotalDurationMs(),
                tenantId: context.tenant.id,
                source: 'granclaw-os-tool',
                adapterStatus,
                debugSnapshot,
                ...dispatchResult.meta
              }
            })
            return
          }

          // Handle executed result
          trace.addStep({
            stage: 'tool',
            status: dispatchResult.success ? 'success' : 'error',
            label: dispatchResult.success ? 'Capacidad ejecutada' : 'Error en ejecucion',
            detail: `Capability: ${capabilityEnabled.toolName} via dispatcher`
          })

          const debugSnapshot = trace.getDebugSnapshot()
          debugSnapshot.toolCalled = true
          debugSnapshot.executionConfirmed = dispatchResult.success
          debugSnapshot.source = 'granclaw'
          logDebug(debugSnapshot)

          completeTask(
            task.id,
            dispatchResult.success ? 'success' : 'error',
            dispatchResult.result,
            dispatchResult.source,
            trace.getSteps(),
            debugSnapshot,
            trace.getTotalDurationMs()
          )

          ok(res, {
            success: dispatchResult.success,
            result: dispatchResult.result,
            mode: dispatchResult.mode,
            error: dispatchResult.error,
            meta: {
              requestId: trace.requestId,
              taskId: task.id,
              capabilityId: capabilityEnabled.id,
              capabilityName: capabilityEnabled.toolName,
              capabilityKey,
              hubDecision: hubResult.decisionLog,
              executionTrace: trace.getSteps(),
              executionDurationMs: trace.getTotalDurationMs(),
              tenantId: context.tenant.id,
              source: dispatchResult.source,
              adapterStatus,
              debugSnapshot,
              ...dispatchResult.meta
            }
          })
          return
        }

        // FIX 105 Case B: Capability exists but disabled - inform user
        if (capabilityAny && !capabilityAny.enabled) {
          console.log(`[GranClaw] Capability disabled: ${capabilityAny.toolName} (key: ${capabilityKey})`)

          trace.addStep({
            stage: 'tool',
            status: 'blocked',
            label: 'Capacidad desactivada',
            detail: `Capability ${capabilityAny.toolName} existe pero esta desactivada`
          })

          const debugSnapshot = trace.getDebugSnapshot()
          debugSnapshot.toolCalled = false
          debugSnapshot.executionConfirmed = false
          debugSnapshot.source = 'granclaw'
          debugSnapshot.error = 'Capability disabled'
          logDebug(debugSnapshot)

          completeTask(
            task.id,
            'blocked',
            undefined,
            'granclaw',
            trace.getSteps(),
            debugSnapshot,
            trace.getTotalDurationMs(),
            'Capacidad desactivada'
          )

          ok(res, {
            success: false,
            error: 'Capability disabled',
            message: 'Esta capacidad esta aprobada pero desactivada. Activala en Herramientas.',
            meta: {
              requestId: trace.requestId,
              taskId: task.id,
              capabilityId: capabilityAny.id,
              capabilityKey,
              capabilityName: capabilityAny.toolName,
              hubDecision: hubResult.decisionLog,
              executionTrace: trace.getSteps(),
              executionDurationMs: trace.getTotalDurationMs(),
              tenantId: context.tenant.id,
              source: 'granclaw',
              adapterStatus,
              debugSnapshot
            }
          })
          return
        }

        // FIX 102 + FIX 104/105: Buscar proposal pendiente existente por capabilityKey
        // Case C/D/E/F: No capability or deleted - check proposals
        let proposal = findExistingProposal(context.tenant.id, capabilityKey, 'pending')

        if (proposal) {
          console.log(`[GranClaw] Found existing proposal ${proposal.id} for capabilityKey: ${capabilityKey}`)
        } else {
          // Check if there's an approved proposal without capability (edge case D)
          const approvedProposal = findExistingProposal(context.tenant.id, capabilityKey, 'approved')
          if (approvedProposal) {
            console.log(`[GranClaw] Found approved proposal without capability, this shouldn't happen: ${approvedProposal.id}`)
          }

          // FIX 104: No hay proposal existente: crear nueva con capabilityKey
          proposal = createToolProposal({
            tenantId: context.tenant.id,
            userId: context.user.id,
            requestedAction: input.message,
            detectedCapability: missingCapability.detectedCapability,
            proposedToolName: missingCapability.proposedToolName,
            capabilityKey,
            description: missingCapability.description,
            riskLevel: missingCapability.riskLevel,
            requiresOsAccess: missingCapability.requiresOsAccess,
            requiresNetworkAccess: missingCapability.requiresNetworkAccess
          })
        }

        // Trazar como capacidad faltante
        trace.addStep({
          stage: 'tool',
          status: 'blocked',
          label: 'Capacidad no disponible',
          detail: `Se genero propuesta de tool: ${proposal.proposedToolName}`
        })

        const debugSnapshot = trace.getDebugSnapshot()
        debugSnapshot.toolCalled = false
        debugSnapshot.executionConfirmed = false
        debugSnapshot.source = 'granclaw'
        debugSnapshot.error = 'Missing capability'
        logDebug(debugSnapshot)

        // Actualizar tarea como pendiente de capacidad
        completeTask(
          task.id,
          'unconfirmed',
          undefined,
          'granclaw',
          trace.getSteps(),
          debugSnapshot,
          trace.getTotalDurationMs(),
          'Capacidad no disponible - propuesta creada'
        )

        ok(res, {
          success: false,
          error: 'Missing capability',
          message: 'GranClaw no tiene todavia una herramienta para ejecutar esta accion.',
          meta: {
            requestId: trace.requestId,
            taskId: task.id,
            toolProposalId: proposal.id,
            missingCapability: missingCapability.detectedCapability,
            proposedTool: proposal.proposedToolName,
            capabilityKey, // FIX 104: Incluir para diagnóstico
            riskLevel: proposal.riskLevel,
            hubDecision: hubResult.decisionLog,
            executionTrace: trace.getSteps(),
            executionDurationMs: trace.getTotalDurationMs(),
            tenantId: context.tenant.id,
            source: 'granclaw',
            adapterStatus,
            debugSnapshot
          }
        })
        return
      }

      // Añadir tenantId al input
      const taskInput: RunTaskInput = {
        ...input,
        tenantId: context.tenant.id,
        // FEATURE 050: Usar mensaje modificado si el Hub lo cambió
        message: hubResult.modifiedMessage || input.message
      }

      const result = await runSimpleAgentTask(taskInput)

      // FEATURE 073: Trazar resultado del orchestrator
      if (result.success) {
        trace.orchestratorSuccess()
        // Trazar source de la respuesta
        if (result.source) {
          trace.resultSource(result.source)
        }
      } else {
        trace.orchestratorError(result.error || 'Error desconocido')
      }

      // FEATURE 074/075: Verificar que hay resultado real
      const hasRealResult = result.success && result.result !== null && result.result !== undefined
      const source = result.source || 'unknown'

      // FEATURE 075: Debug snapshot y logs
      const debugSnapshot = trace.getDebugSnapshot()
      logDebug(debugSnapshot)

      // FEATURE 075: Determinar warnings
      const tracePresent = trace.getSteps().length > 0
      let warning: string | undefined
      if (!tracePresent) {
        warning = 'No se recibio trazabilidad real de esta ejecucion'
      } else if (result.success && !hasRealResult) {
        warning = 'No execution result available'
      }

      // FEATURE 075: Corregir success falso
      const finalSuccess = result.success && debugSnapshot.executionConfirmed

      // FEATURE 080: Determinar estado de tarea y actualizar
      let taskStatus: TaskStatus
      if (!result.success) {
        taskStatus = 'error'
      } else if (!debugSnapshot.executionConfirmed) {
        taskStatus = 'unconfirmed'
      } else {
        taskStatus = 'success'
      }

      completeTask(
        task.id,
        taskStatus,
        result.result,
        source,
        trace.getSteps(),
        debugSnapshot,
        trace.getTotalDurationMs(),
        undefined,
        result.error
      )

      // FEATURE 051/073/074/075/080: Respuesta completa
      ok(res, {
        ...result,
        success: finalSuccess,
        // Si success original pero no confirmado, cambiar mensaje
        ...(result.success && !debugSnapshot.executionConfirmed ? {
          message: 'Permitido, pero no se pudo confirmar la ejecucion real'
        } : {}),
        warning,
        meta: {
          requestId: trace.requestId,
          taskId: task.id,
          hubDecision: hubResult.decisionLog,
          executionTrace: trace.getSteps(),
          executionDurationMs: trace.getTotalDurationMs(),
          tenantId: context.tenant.id,
          source,
          adapterStatus,
          debugSnapshot
        }
      })
    } catch (err) {
      // FIX 077: Garantizar meta incluso en excepciones
      const errorMessage = err instanceof Error ? err.message : 'Error interno del servidor'
      trace.orchestratorError(errorMessage)
      const debugSnapshot = trace.getDebugSnapshot()
      logDebug(debugSnapshot)

      // FEATURE 080: Actualizar tarea como error
      completeTask(
        task.id,
        'error',
        undefined,
        'error',
        trace.getSteps(),
        debugSnapshot,
        trace.getTotalDurationMs(),
        undefined,
        errorMessage
      )

      console.error(`[GranClaw] Exception in request ${trace.requestId}:`, err)

      ok(res, {
        success: false,
        error: errorMessage,
        meta: {
          requestId: trace.requestId,
          taskId: task.id,
          executionTrace: trace.getSteps(),
          executionDurationMs: trace.getTotalDurationMs(),
          tenantId: context.tenant.id,
          source: 'error',
          debugSnapshot
        }
      })
    }
  })

  req.on('error', () => {
    badRequest(res, 'Error reading request body')
  })
}

export function handleOrchestratorRunStream(req: IncomingMessage, res: ServerResponse, context: AuthContext | null): void {
  // Rutas protegidas requieren contexto
  if (!context) {
    unauthorized(res, 'Authentication required')
    return
  }

  let body = ''

  req.on('data', (chunk) => {
    body += chunk.toString()
  })

  req.on('end', async () => {
    let input: StreamTaskInput

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

    if (!input.message) {
      badRequest(res, 'Field "message" is required')
      return
    }

    // FEATURE 073/075: Crear trace builder con requestId
    const trace = new ExecutionTraceBuilder()
    trace.setRoute('/run/stream')
    trace.setTenantId(context.tenant.id)
    trace.setUserId(context.user.id)
    trace.setSessionPresent(true)

    // FIX 077: Log al inicio del flujo
    console.log(`[GranClaw] Starting stream request ${trace.requestId} for tenant ${context.tenant.id}`)

    // FEATURE 080: Crear tarea al inicio
    const task = createTask({
      tenantId: context.tenant.id,
      userId: context.user.id,
      requestId: trace.requestId,
      input: input.message
    })
    console.log(`[GranClaw] Created task ${task.id}`)

    // FIX 077: Try/catch para garantizar meta en todas las respuestas
    try {
      trace.hubStart()

      // FEATURE 050: GranClaw Hub - control previo al orchestrator
      const hub = getGranClawHubService()
      const hubResult = hub.process({
        sessionId: input.sessionId || 'anonymous',
        agentId: input.agentId,
        message: input.message,
        tenantId: context.tenant.id,
        userId: context.user.id
      })

      // FEATURE 074: Obtener estado del adaptador
      const adapterStatus = getAdapterStatus()

      if (!hubResult.allowed) {
        // FEATURE 073: Trace bloqueado
        trace.hubBlocked(hubResult.reason || 'Politicas de empresa')

        // FEATURE 075: Debug snapshot y logs
        const debugSnapshot = trace.getDebugSnapshot()
        logDebug(debugSnapshot)

        // FEATURE 080: Actualizar tarea como bloqueada
        completeTask(
          task.id,
          'blocked',
          undefined,
          undefined,
          trace.getSteps(),
          debugSnapshot,
          trace.getTotalDurationMs(),
          hubResult.reason
        )

        ok(res, {
          success: false,
          error: 'Blocked by GranClaw Hub',
          reason: hubResult.reason,
          // FEATURE 051/073/074/075/080
          meta: {
            requestId: trace.requestId,
            taskId: task.id,
            hubDecision: hubResult.decisionLog,
            executionTrace: trace.getSteps(),
            executionDurationMs: trace.getTotalDurationMs(),
            tenantId: context.tenant.id,
            adapterStatus,
            debugSnapshot
          }
        })
        return
      }

      // FEATURE 073: Hub permitio
      trace.hubAllowed(context.tenant.id)
      trace.orchestratorStart()

      // FEATURE 090/091 + FIX 104/105: Detectar capacidad con lookup robusto
      const missingCapability = detectMissingCapability(input.message)
      if (missingCapability) {
        // FIX 104: Usar capabilityKey normalizada para lookup
        const capabilityKey = missingCapability.capabilityKey || normalizeCapabilityKey(missingCapability.proposedToolName)

        // FIX 105: Diagnostic logs y lookup completo
        const capabilityAny = getCapabilityByKey(context.tenant.id, capabilityKey)
        const capabilityEnabled = getEnabledCapabilityByKey(context.tenant.id, capabilityKey)
        const proposalCount = countDuplicateProposals(context.tenant.id, capabilityKey)
        const capabilityCount = countCapabilitiesByKey(context.tenant.id, capabilityKey)

        console.log(`[Capability Lookup] tenantId=${context.tenant.id}`)
        console.log(`[Capability Lookup] capabilityKey=${capabilityKey}`)
        console.log(`[Capability Lookup] capabilityFound=${!!capabilityAny}`)
        console.log(`[Capability Lookup] enabled=${capabilityAny?.enabled ?? false}`)
        console.log(`[Capability Lookup] proposalCount=${proposalCount}`)
        console.log(`[Capability Lookup] duplicateCapabilities=${capabilityCount}`)

        // Case A: Capability exists and enabled - execute via dispatcher (FIX 111)
        if (capabilityEnabled) {
          console.log(`[GranClaw] Executing approved capability: ${capabilityEnabled.toolName} (key: ${capabilityKey})`)

          // FIX 111: Use dispatcher instead of direct execution
          // FIX 112: Get mode from hub config, not hubResult
          const hubConfig = hub.getConfig(context.tenant.id)
          const executionMode: ExecutionMode = hubConfig.mode === 'passthrough' ? 'passthrough' : 'strict'

          const dispatchResult = await dispatchCapabilityExecution(capabilityEnabled, {
            tenantId: context.tenant.id,
            userId: context.user.id,
            sessionId: input.sessionId || 'default',
            mode: executionMode,
            requestedAction: input.message
          })

          // Handle confirmation required
          if (dispatchResult.confirmationRequired) {
            trace.addStep({
              stage: 'tool',
              status: 'pending',
              label: 'Confirmacion requerida',
              detail: `OS Tool: ${capabilityEnabled.toolName} requiere confirmacion`
            })

            const debugSnapshot = trace.getDebugSnapshot()
            debugSnapshot.toolCalled = false
            debugSnapshot.executionConfirmed = false
            debugSnapshot.source = 'granclaw' as const
            logDebug(debugSnapshot)

            completeTask(
              task.id,
              'pending',
              dispatchResult.result,
              'granclaw-os-tool',
              trace.getSteps(),
              debugSnapshot,
              trace.getTotalDurationMs()
            )

            ok(res, {
              success: true,
              result: dispatchResult.result,
              mode: dispatchResult.mode,
              meta: {
                requestId: trace.requestId,
                taskId: task.id,
                capabilityId: capabilityEnabled.id,
                capabilityName: capabilityEnabled.toolName,
                capabilityKey,
                pendingConfirmation: true,
                confirmationId: dispatchResult.confirmationId,
                hubDecision: hubResult.decisionLog,
                executionTrace: trace.getSteps(),
                executionDurationMs: trace.getTotalDurationMs(),
                tenantId: context.tenant.id,
                source: 'granclaw-os-tool',
                adapterStatus,
                debugSnapshot,
                ...dispatchResult.meta
              }
            })
            return
          }

          // Handle executed result
          trace.addStep({
            stage: 'tool',
            status: dispatchResult.success ? 'success' : 'error',
            label: dispatchResult.success ? 'Capacidad ejecutada' : 'Error en ejecucion',
            detail: `Capability: ${capabilityEnabled.toolName} via dispatcher`
          })

          const debugSnapshot = trace.getDebugSnapshot()
          debugSnapshot.toolCalled = true
          debugSnapshot.executionConfirmed = dispatchResult.success
          debugSnapshot.source = 'granclaw'
          logDebug(debugSnapshot)

          completeTask(
            task.id,
            dispatchResult.success ? 'success' : 'error',
            dispatchResult.result,
            dispatchResult.source,
            trace.getSteps(),
            debugSnapshot,
            trace.getTotalDurationMs()
          )

          ok(res, {
            success: dispatchResult.success,
            result: dispatchResult.result,
            mode: dispatchResult.mode,
            error: dispatchResult.error,
            meta: {
              requestId: trace.requestId,
              taskId: task.id,
              capabilityId: capabilityEnabled.id,
              capabilityName: capabilityEnabled.toolName,
              capabilityKey,
              hubDecision: hubResult.decisionLog,
              executionTrace: trace.getSteps(),
              executionDurationMs: trace.getTotalDurationMs(),
              tenantId: context.tenant.id,
              source: dispatchResult.source,
              adapterStatus,
              debugSnapshot,
              ...dispatchResult.meta
            }
          })
          return
        }

        // FIX 105 Case B: Capability exists but disabled - inform user
        if (capabilityAny && !capabilityAny.enabled) {
          console.log(`[GranClaw] Capability disabled: ${capabilityAny.toolName} (key: ${capabilityKey})`)

          trace.addStep({
            stage: 'tool',
            status: 'blocked',
            label: 'Capacidad desactivada',
            detail: `Capability ${capabilityAny.toolName} existe pero esta desactivada`
          })

          const debugSnapshot = trace.getDebugSnapshot()
          debugSnapshot.toolCalled = false
          debugSnapshot.executionConfirmed = false
          debugSnapshot.source = 'granclaw'
          debugSnapshot.error = 'Capability disabled'
          logDebug(debugSnapshot)

          completeTask(
            task.id,
            'blocked',
            undefined,
            'granclaw',
            trace.getSteps(),
            debugSnapshot,
            trace.getTotalDurationMs(),
            'Capacidad desactivada'
          )

          ok(res, {
            success: false,
            error: 'Capability disabled',
            message: 'Esta capacidad esta aprobada pero desactivada. Activala en Herramientas.',
            meta: {
              requestId: trace.requestId,
              taskId: task.id,
              capabilityId: capabilityAny.id,
              capabilityKey,
              capabilityName: capabilityAny.toolName,
              hubDecision: hubResult.decisionLog,
              executionTrace: trace.getSteps(),
              executionDurationMs: trace.getTotalDurationMs(),
              tenantId: context.tenant.id,
              source: 'granclaw',
              adapterStatus,
              debugSnapshot
            }
          })
          return
        }

        // FIX 102 + FIX 104/105: Buscar proposal pendiente existente por capabilityKey
        // Case C/D/E/F: No capability or deleted - check proposals
        let proposal = findExistingProposal(context.tenant.id, capabilityKey, 'pending')

        if (proposal) {
          console.log(`[GranClaw] Found existing proposal ${proposal.id} for capabilityKey: ${capabilityKey}`)
        } else {
          // Check if there's an approved proposal without capability (edge case D)
          const approvedProposal = findExistingProposal(context.tenant.id, capabilityKey, 'approved')
          if (approvedProposal) {
            console.log(`[GranClaw] Found approved proposal without capability, this shouldn't happen: ${approvedProposal.id}`)
          }

          // FIX 104: No hay proposal existente: crear nueva con capabilityKey
          proposal = createToolProposal({
            tenantId: context.tenant.id,
            userId: context.user.id,
            requestedAction: input.message,
            detectedCapability: missingCapability.detectedCapability,
            proposedToolName: missingCapability.proposedToolName,
            capabilityKey,
            description: missingCapability.description,
            riskLevel: missingCapability.riskLevel,
            requiresOsAccess: missingCapability.requiresOsAccess,
            requiresNetworkAccess: missingCapability.requiresNetworkAccess
          })
        }

        // Trazar como capacidad faltante
        trace.addStep({
          stage: 'tool',
          status: 'blocked',
          label: 'Capacidad no disponible',
          detail: `Se genero propuesta de tool: ${proposal.proposedToolName}`
        })

        const debugSnapshot = trace.getDebugSnapshot()
        debugSnapshot.toolCalled = false
        debugSnapshot.executionConfirmed = false
        debugSnapshot.source = 'granclaw'
        debugSnapshot.error = 'Missing capability'
        logDebug(debugSnapshot)

        // Actualizar tarea como pendiente de capacidad
        completeTask(
          task.id,
          'unconfirmed',
          undefined,
          'granclaw',
          trace.getSteps(),
          debugSnapshot,
          trace.getTotalDurationMs(),
          'Capacidad no disponible - propuesta creada'
        )

        ok(res, {
          success: false,
          error: 'Missing capability',
          message: 'GranClaw no tiene todavia una herramienta para ejecutar esta accion.',
          meta: {
            requestId: trace.requestId,
            taskId: task.id,
            toolProposalId: proposal.id,
            missingCapability: missingCapability.detectedCapability,
            proposedTool: proposal.proposedToolName,
            capabilityKey, // FIX 104: Incluir para diagnóstico
            riskLevel: proposal.riskLevel,
            hubDecision: hubResult.decisionLog,
            executionTrace: trace.getSteps(),
            executionDurationMs: trace.getTotalDurationMs(),
            tenantId: context.tenant.id,
            source: 'granclaw',
            adapterStatus,
            debugSnapshot
          }
        })
        return
      }

      // Añadir tenantId al input
      const taskInput: StreamTaskInput = {
        ...input,
        tenantId: context.tenant.id,
        // FEATURE 050: Usar mensaje modificado si el Hub lo cambió
        message: hubResult.modifiedMessage || input.message
      }

      const result = await runStreamingTask(taskInput)

      // FEATURE 073: Trazar resultado
      let source: string = 'unknown'
      if (result.success) {
        trace.orchestratorSuccess()
        // Trazar source si existe
        if (result.mode === 'tool' && result.toolId) {
          trace.resultSource('tool')
          source = 'tool'
        } else if (result.mode === 'ack') {
          trace.resultSource('openclaw')
          source = 'openclaw'
        } else if (result.mode === 'fallback') {
          trace.resultSource('mock')
          source = 'mock'
        }
      } else {
        trace.orchestratorError(result.error || 'Error desconocido')
      }

      // FEATURE 074/075: Verificar que hay resultado real
      const hasRealResult = result.success && result.result !== null && result.result !== undefined

      // FEATURE 075: Debug snapshot y logs
      const debugSnapshot = trace.getDebugSnapshot()
      logDebug(debugSnapshot)

      // FEATURE 075: Determinar warnings
      const tracePresent = trace.getSteps().length > 0
      let warning: string | undefined
      if (!tracePresent) {
        warning = 'No se recibio trazabilidad real de esta ejecucion'
      } else if (result.success && !hasRealResult) {
        warning = 'No execution result available'
      }

      // FEATURE 075: Corregir success falso
      const finalSuccess = result.success && debugSnapshot.executionConfirmed

      // FEATURE 080: Determinar estado de tarea y actualizar
      let taskStatus: TaskStatus
      if (!result.success) {
        taskStatus = 'error'
      } else if (!debugSnapshot.executionConfirmed) {
        taskStatus = 'unconfirmed'
      } else {
        taskStatus = 'success'
      }

      completeTask(
        task.id,
        taskStatus,
        result.result,
        source,
        trace.getSteps(),
        debugSnapshot,
        trace.getTotalDurationMs(),
        undefined,
        result.error
      )

      // FEATURE 051/073/074/075/080: Respuesta completa
      ok(res, {
        ...result,
        success: finalSuccess,
        // Si success original pero no confirmado, cambiar mensaje
        ...(result.success && !debugSnapshot.executionConfirmed ? {
          message: 'Permitido, pero no se pudo confirmar la ejecucion real'
        } : {}),
        warning,
        meta: {
          requestId: trace.requestId,
          taskId: task.id,
          hubDecision: hubResult.decisionLog,
          executionTrace: trace.getSteps(),
          executionDurationMs: trace.getTotalDurationMs(),
          tenantId: context.tenant.id,
          source,
          adapterStatus,
          debugSnapshot
        }
      })
    } catch (err) {
      // FIX 077: Garantizar meta incluso en excepciones
      const errorMessage = err instanceof Error ? err.message : 'Error interno del servidor'
      trace.orchestratorError(errorMessage)
      const debugSnapshot = trace.getDebugSnapshot()
      logDebug(debugSnapshot)

      // FEATURE 080: Actualizar tarea como error
      completeTask(
        task.id,
        'error',
        undefined,
        'error',
        trace.getSteps(),
        debugSnapshot,
        trace.getTotalDurationMs(),
        undefined,
        errorMessage
      )

      console.error(`[GranClaw] Exception in stream request ${trace.requestId}:`, err)

      ok(res, {
        success: false,
        error: errorMessage,
        meta: {
          requestId: trace.requestId,
          taskId: task.id,
          executionTrace: trace.getSteps(),
          executionDurationMs: trace.getTotalDurationMs(),
          tenantId: context.tenant.id,
          source: 'error',
          debugSnapshot
        }
      })
    }
  })

  req.on('error', () => {
    badRequest(res, 'Error reading request body')
  })
}
