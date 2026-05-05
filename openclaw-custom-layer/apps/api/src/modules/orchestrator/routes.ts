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
 * FEATURE 120: Hybrid Execution Policy v1
 * FIX 121: Authoritative Hybrid Router & Intent Classification
 * FIX 124: Final Execution Status Resolution
 */

import type { IncomingMessage, ServerResponse } from 'http'
import { ok, badRequest, unauthorized } from '../../shared/response'
import { runSimpleAgentTask, runStreamingTask, getAdapterStatus } from './service'
// FIX 122: Reauthorization detection for OpenClaw responses
// FIX 123 + 123.1: Setup required blocking with granular scopes
// FIX 124.2: Consistent Setup Blocking & Requirement Synchronization
import {
  detectReauthRequired,
  createReauthRequiredResponse,
  detectAndMarkReauthRequired,
  shouldBlockForSetup,
  recordOpenClawSuccess,
  createSetupRequiredResponse,
  getBlockingRequirement,
  getScopeFromCapability,
  checkSetupBlockBeforeExecution,
  resolveExecutionScope,
  type SetupBlockResult
} from './reauth-detector'
import { storePendingAction, getSystemState, getActiveRequirements } from '../system-state'
import type { RunTaskInput, StreamTaskInput } from './types'
import type { AuthContext } from '../auth'
import { getGranClawHubService } from '../granclaw-hub'
import { ExecutionTraceBuilder, type DebugSnapshot } from './trace'
import { createTask, completeTask, type TaskStatus } from '../tasks'
import { detectMissingCapability, createToolProposal, findExistingProposal, countDuplicateProposals } from '../tool-proposals'
import { getEnabledCapabilityByKey, getCapabilityByKey, normalizeCapabilityKey, countCapabilitiesByKey, dispatchCapabilityExecution, type ExecutionMode } from '../capabilities'
// FEATURE 110: OS Tools - keeping imports for whitelist check
import { isOSToolCapability, getOSToolConfig } from '../os-tools'
// FEATURE 120 + FIX 121: Hybrid Execution Policy with Intent Classification
import {
  getExecutionPolicy,
  decideExecutionRoute,
  classifyIntent,
  type ExecutionRouteDecision,
  type IntentClassification
} from '../execution-policy'
// FIX 124: Final Execution Status Resolution
import { resolveFinalExecutionStatus, type ResolvedExecutionStatus } from '../execution-status'

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

      // FIX 121: STEP 1 - Classify intent FIRST (BEFORE capability detection)
      const intent: IntentClassification = classifyIntent(input.message)
      console.log(`[Intent Classifier] kind=${intent.kind} confidence=${intent.confidence} needsAi=${intent.needsAi} needsAgent=${intent.needsAgent}`)
      console.log(`[Intent Classifier] isMultiStep=${intent.isMultiStep} isDeterministic=${intent.isDeterministic}`)
      console.log(`[Intent Classifier] reason="${intent.reason}" signals=[${intent.signals.join(', ')}]`)

      // FIX 121: Get hub config and execution policy
      const hubConfig = hub.getConfig(context.tenant.id)
      const executionPolicy = getExecutionPolicy(context.tenant.id)

      // FIX 121: STEP 2 - Capability detection (only provides signals)
      const missingCapability = detectMissingCapability(input.message)
      const capabilityKey = missingCapability?.capabilityKey || (missingCapability ? normalizeCapabilityKey(missingCapability.proposedToolName) : undefined)

      // FIX 121: Capability lookup if we have a key
      let capabilityAny = null
      let capabilityEnabled = null
      let proposalCount = 0
      let capabilityCount = 0

      if (capabilityKey) {
        capabilityAny = getCapabilityByKey(context.tenant.id, capabilityKey)
        capabilityEnabled = getEnabledCapabilityByKey(context.tenant.id, capabilityKey)
        proposalCount = countDuplicateProposals(context.tenant.id, capabilityKey)
        capabilityCount = countCapabilitiesByKey(context.tenant.id, capabilityKey)

        console.log(`[Capability Lookup] tenantId=${context.tenant.id}`)
        console.log(`[Capability Lookup] capabilityKey=${capabilityKey}`)
        console.log(`[Capability Lookup] capabilityFound=${!!capabilityAny}`)
        console.log(`[Capability Lookup] enabled=${capabilityAny?.enabled ?? false}`)
        console.log(`[Capability Lookup] proposalCount=${proposalCount}`)
        console.log(`[Capability Lookup] duplicateCapabilities=${capabilityCount}`)
      } else {
        console.log(`[Capability Lookup] No capability detected from message`)
      }

      // FIX 121: STEP 3 - AUTHORITATIVE router decision
      const routeDecision: ExecutionRouteDecision = decideExecutionRoute({
        tenantId: context.tenant.id,
        userId: context.user.id,
        message: input.message,
        mode: hubConfig.mode === 'passthrough' ? 'passthrough' : 'strict',
        hubAllowed: true,
        intent, // FIX 121: Include intent classification
        detectedCapabilityKey: capabilityKey,
        approvedCapability: capabilityEnabled && capabilityKey ? {
          id: capabilityEnabled.id,
          capabilityKey: capabilityEnabled.capabilityKey || capabilityKey,
          enabled: capabilityEnabled.enabled,
          riskLevel: capabilityEnabled.riskLevel || 'medium'
        } : undefined,
        policyConfig: executionPolicy
      })

      console.log(`[Execution Router] AUTHORITATIVE provider=${routeDecision.provider} reason="${routeDecision.reason}"`)
      console.log(`[Execution Router] needsAi=${routeDecision.needsAi} tokenSaving=${routeDecision.tokenSaving}`)
      if (routeDecision.intent) {
        console.log(`[Execution Router] intentKind=${routeDecision.intent.kind}`)
      }

      // FIX 121: STEP 4 - Execute based on router decision
      // Provider 'openclaw' - delegate to OpenClaw (skips capability handling)
      if (routeDecision.provider === 'openclaw') {
        console.log(`[GranClaw] Delegating to OpenClaw: ${routeDecision.reason}`)

        // FIX 124.2: Use checkSetupBlockBeforeExecution for consistent scope resolution
        // This ensures "abre vscode", "abre la aplicación vscode", "abre Visual Studio Code"
        // all map to the same scope and block consistently
        const isSimpleQuery = intent.kind === 'simple_question' || intent.kind === 'analysis_task'

        trace.addStep({
          stage: 'orchestrator',
          status: 'running',
          label: 'Comprobando setup antes de OpenClaw',
          detail: `scope resolution for: ${capabilityKey || 'unknown'}`
        })

        const setupBlock: SetupBlockResult = checkSetupBlockBeforeExecution({
          tenantId: context.tenant.id,
          userId: context.user.id,
          intent,
          capabilityKey,
          provider: 'openclaw',
          message: input.message,
          isSimpleQuery
        })

        // Use resolved scope from checkSetupBlockBeforeExecution
        const scopeKey = setupBlock.scopeKey

        if (setupBlock.blocked) {
          console.log(`[GranClaw] Setup required for scope=${scopeKey} (source=${setupBlock.source}) - blocking execution`)

          trace.addStep({
            stage: 'orchestrator',
            status: 'blocked',
            label: 'Bloqueado por setup activo',
            detail: `OpenClaw necesita autorización para: ${setupBlock.reason}`
          })

          // Store pending action for retry after setup
          storePendingAction({
            input: input.message,
            tenantId: context.tenant.id,
            userId: context.user.id,
            timestamp: Date.now(),
            capabilityKey: capabilityKey,
            scopeKey
          })

          const debugSnapshot = trace.getDebugSnapshot()
          debugSnapshot.source = 'setup-required'
          debugSnapshot.executionConfirmed = false
          debugSnapshot.error = 'Setup required'
          logDebug(debugSnapshot)

          completeTask(task.id, 'blocked', undefined, 'setup-required', trace.getSteps(), debugSnapshot, trace.getTotalDurationMs(), 'Configuración requerida')

          // FIX 124.2: Include statusResolution for consistent UI display
          const statusResolution = resolveFinalExecutionStatus({
            hubAllowed: true,
            hubBlocked: false,
            hubReason: undefined,
            result: { success: false, executionStatus: 'setup_required' },
            error: setupBlock.reason,
            source: 'setup-required',
            meta: { executionConfirmed: false, requiresSetup: true }
          })

          const setupResponse = createSetupRequiredResponse(trace.requestId, task.id, {
            pendingInput: input.message,
            scopeKey,
            capabilityKey,
            requirement: setupBlock.requirement
          })

          ok(res, {
            ...setupResponse,
            statusResolution,
            meta: {
              ...setupResponse.meta,
              hubDecision: hubResult.decisionLog,
              executionTrace: trace.getSteps(),
              tenantId: context.tenant.id,
              systemState: getSystemState(),
              activeRequirements: getActiveRequirements()
            }
          })
          return
        }

        trace.addStep({
          stage: 'orchestrator',
          status: 'success',
          label: 'No hay setup activo aplicable, continúa OpenClaw',
          detail: `scope=${scopeKey} source=${setupBlock.source}`
        })

        trace.addStep({
          stage: 'orchestrator',
          status: 'success',
          label: 'Delegado a OpenClaw',
          detail: routeDecision.reason
        })

        // Go to OpenClaw execution
        const taskInput: RunTaskInput = {
          ...input,
          tenantId: context.tenant.id,
          message: hubResult.modifiedMessage || input.message
        }

        const result = await runSimpleAgentTask(taskInput)

        // FIX 122 + FIX 123: Detect reauth and update system state
        const reauthDetection = detectAndMarkReauthRequired(result, {
          input: input.message,
          tenantId: context.tenant.id,
          userId: context.user.id,
          capabilityKey: capabilityKey
        })
        if (reauthDetection.requiresReauth) {
          console.log(`[GranClaw] Reauth required detected: ${reauthDetection.matchedText} in ${reauthDetection.matchSource}`)

          trace.addStep({
            stage: 'openclaw',
            status: 'error',
            label: 'Reautorización requerida',
            detail: `OpenClaw requiere permisos adicionales: ${reauthDetection.matchedText}`
          })

          const debugSnapshot = trace.getDebugSnapshot()
          debugSnapshot.source = 'openclaw'
          debugSnapshot.executionConfirmed = false
          debugSnapshot.error = 'Reauthorization required'
          logDebug(debugSnapshot)

          completeTask(
            task.id,
            'error',
            undefined,
            'openclaw-reauth',
            trace.getSteps(),
            debugSnapshot,
            trace.getTotalDurationMs(),
            'Reautorización requerida'
          )

          const reauthResponse = createReauthRequiredResponse(
            result,
            reauthDetection,
            trace.requestId,
            task.id
          )

          // FIX 124.2: Include statusResolution for consistent UI display
          const statusResolution = resolveFinalExecutionStatus({
            hubAllowed: true,
            hubBlocked: false,
            hubReason: undefined,
            result: { success: false, executionStatus: 'reauthorization_required' },
            error: reauthDetection.matchedText,
            source: 'openclaw-reauth',
            meta: { executionConfirmed: false, requiresReauth: true }
          })

          ok(res, {
            ...reauthResponse,
            statusResolution,
            meta: {
              ...reauthResponse.meta,
              hubDecision: hubResult.decisionLog,
              executionTrace: trace.getSteps(),
              executionDurationMs: trace.getTotalDurationMs(),
              tenantId: context.tenant.id,
              adapterStatus,
              debugSnapshot,
              routerDecision: {
                provider: routeDecision.provider,
                reason: routeDecision.reason,
                intentKind: intent.kind
              }
            }
          })
          return
        }

        if (result.success) {
          trace.orchestratorSuccess()
          if (result.source) {
            trace.resultSource(result.source)
          }
        } else {
          trace.orchestratorError(result.error || 'Error desconocido')
        }

        const hasRealResult = result.success && result.result !== null && result.result !== undefined
        const source = result.source || 'openclaw'

        const debugSnapshot = trace.getDebugSnapshot()
        debugSnapshot.source = 'openclaw'
        logDebug(debugSnapshot)

        const tracePresent = trace.getSteps().length > 0
        let warning: string | undefined
        if (!tracePresent) {
          warning = 'No se recibio trazabilidad real de esta ejecucion'
        } else if (result.success && !hasRealResult) {
          warning = 'No execution result available'
        }

        const finalSuccess = result.success && debugSnapshot.executionConfirmed

        let taskStatus: TaskStatus
        if (!result.success) {
          taskStatus = 'error'
        } else if (!debugSnapshot.executionConfirmed) {
          taskStatus = 'unconfirmed'
        } else {
          taskStatus = 'success'
          // FIX 123.1: Record successful execution (resolves specific scope/capability)
          recordOpenClawSuccess({ scopeKey, capabilityKey })
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

        // FIX 124.2: Include statusResolution for consistent UI display
        const statusResolution = resolveFinalExecutionStatus({
          hubAllowed: true,
          hubBlocked: false,
          hubReason: undefined,
          result,
          error: result.error,
          source,
          meta: { executionConfirmed: debugSnapshot.executionConfirmed },
          debugSnapshot
        })

        ok(res, {
          ...result,
          success: finalSuccess,
          ...(result.success && !debugSnapshot.executionConfirmed ? {
            message: 'Permitido, pero no se pudo confirmar la ejecucion real'
          } : {}),
          warning,
          statusResolution,
          meta: {
            requestId: trace.requestId,
            taskId: task.id,
            hubDecision: hubResult.decisionLog,
            executionTrace: trace.getSteps(),
            executionDurationMs: trace.getTotalDurationMs(),
            tenantId: context.tenant.id,
            source,
            adapterStatus,
            debugSnapshot,
            // FIX 121: Include router decision info
            routerDecision: {
              provider: routeDecision.provider,
              reason: routeDecision.reason,
              intentKind: intent.kind,
              needsAi: routeDecision.needsAi,
              tokenSaving: routeDecision.tokenSaving
            }
          }
        })
        return
      }

      // FIX 121: Provider 'local' - execute via capability (requires approved capability)
      if (routeDecision.provider === 'local' && capabilityKey && capabilityEnabled) {
          console.log(`[GranClaw] Executing approved capability: ${capabilityEnabled.toolName} (key: ${capabilityKey}) via ${routeDecision.provider}`)

          // FIX 111: Use dispatcher instead of direct execution
          // FIX 112/FEATURE 120: hubConfig already loaded above
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
            detail: `Capability: ${capabilityEnabled.toolName} via ${routeDecision.provider}`
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
              // FIX 121: Include router decision
              routerDecision: {
                provider: routeDecision.provider,
                reason: routeDecision.reason,
                intentKind: intent.kind,
                needsAi: routeDecision.needsAi,
                tokenSaving: routeDecision.tokenSaving
              },
              ...dispatchResult.meta
            }
          })
          return
      }

      // FIX 121: Provider 'local' but capability is disabled
      if (routeDecision.provider === 'local' && capabilityKey && capabilityAny && !capabilityAny.enabled) {
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
            debugSnapshot,
            routerDecision: {
              provider: routeDecision.provider,
              reason: routeDecision.reason,
              intentKind: intent.kind
            }
          }
        })
        return
      }

      // FIX 121: Provider 'proposal' - create tool proposal
      if (routeDecision.provider === 'proposal' && capabilityKey && missingCapability) {
        console.log(`[GranClaw] Creating proposal for capabilityKey: ${capabilityKey}`)

        // Check for existing proposal
        let proposal = findExistingProposal(context.tenant.id, capabilityKey, 'pending')

        if (proposal) {
          console.log(`[GranClaw] Found existing proposal ${proposal.id} for capabilityKey: ${capabilityKey}`)
        } else {
          // Create new proposal
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
            capabilityKey,
            riskLevel: proposal.riskLevel,
            hubDecision: hubResult.decisionLog,
            executionTrace: trace.getSteps(),
            executionDurationMs: trace.getTotalDurationMs(),
            tenantId: context.tenant.id,
            source: 'granclaw',
            adapterStatus,
            debugSnapshot,
            routerDecision: {
              provider: routeDecision.provider,
              reason: routeDecision.reason,
              intentKind: intent.kind
            }
          }
        })
        return
      }

      // FIX 121: Fallback - if no provider matched, delegate to OpenClaw
      // This should rarely happen as the router should always return a valid provider
      console.log(`[GranClaw] Fallback to OpenClaw - provider=${routeDecision.provider} but no matching handler`)

      // FIX 123.1: Check if OpenClaw requires setup (fallback - granular)
      const fallbackScopeKey = getScopeFromCapability(capabilityKey)
      const fallbackIsSimple = intent.kind === 'simple_question' || intent.kind === 'analysis_task'

      if (shouldBlockForSetup({ scopeKey: fallbackScopeKey, capabilityKey, isSimpleQuery: fallbackIsSimple })) {
        const requirement = getBlockingRequirement({ scopeKey: fallbackScopeKey, capabilityKey })
        console.log(`[GranClaw Fallback] Setup required for scope=${fallbackScopeKey}`)
        storePendingAction({ input: input.message, tenantId: context.tenant.id, userId: context.user.id, timestamp: Date.now(), scopeKey: fallbackScopeKey })
        trace.addStep({ stage: 'orchestrator', status: 'blocked', label: 'Configuración requerida', detail: requirement?.reason || 'OpenClaw necesita configuración' })
        const debugSnapshot = trace.getDebugSnapshot()
        debugSnapshot.source = 'setup-required'
        debugSnapshot.executionConfirmed = false
        completeTask(task.id, 'blocked', undefined, 'setup-required', trace.getSteps(), debugSnapshot, trace.getTotalDurationMs(), 'Configuración requerida')
        const setupResponse = createSetupRequiredResponse(trace.requestId, task.id, { pendingInput: input.message, scopeKey: fallbackScopeKey, requirement })
        // FIX 124: Add status resolution for setup_required
        const setupStatusResolution = resolveFinalExecutionStatus({
          hubAllowed: hubResult.allowed,
          executionStatus: 'setup_required',
          meta: { requiresSetup: true },
          debugSnapshot
        })
        ok(res, { ...setupResponse, statusResolution: setupStatusResolution, meta: { ...setupResponse.meta, hubDecision: hubResult.decisionLog, tenantId: context.tenant.id, systemState: getSystemState(), activeRequirements: getActiveRequirements() } })
        return
      }

      trace.addStep({
        stage: 'orchestrator',
        status: 'success',
        label: 'Fallback a OpenClaw',
        detail: 'No se encontro handler para el provider'
      })

      const taskInput: RunTaskInput = {
        ...input,
        tenantId: context.tenant.id,
        message: hubResult.modifiedMessage || input.message
      }

      const result = await runSimpleAgentTask(taskInput)

      // FIX 122 + FIX 123: Detect reauth and update system state (fallback)
      const reauthDetectionFallback = detectAndMarkReauthRequired(result, {
        input: input.message,
        tenantId: context.tenant.id,
        userId: context.user.id
      })
      if (reauthDetectionFallback.requiresReauth) {
        console.log(`[GranClaw Fallback] Reauth required: ${reauthDetectionFallback.matchedText}`)

        trace.addStep({
          stage: 'openclaw',
          status: 'error',
          label: 'Reautorización requerida',
          detail: `OpenClaw requiere permisos: ${reauthDetectionFallback.matchedText}`
        })

        const debugSnapshot = trace.getDebugSnapshot()
        debugSnapshot.source = 'openclaw'
        debugSnapshot.executionConfirmed = false
        debugSnapshot.error = 'Reauthorization required'
        logDebug(debugSnapshot)

        completeTask(task.id, 'error', undefined, 'openclaw-reauth', trace.getSteps(), debugSnapshot, trace.getTotalDurationMs(), 'Reautorización requerida')

        const reauthResponse = createReauthRequiredResponse(result, reauthDetectionFallback, trace.requestId, task.id)
        ok(res, {
          ...reauthResponse,
          meta: {
            ...reauthResponse.meta,
            hubDecision: hubResult.decisionLog,
            executionTrace: trace.getSteps(),
            executionDurationMs: trace.getTotalDurationMs(),
            tenantId: context.tenant.id,
            adapterStatus,
            debugSnapshot,
            routerDecision: {
              provider: routeDecision.provider,
              reason: routeDecision.reason,
              intentKind: intent.kind
            }
          }
        })
        return
      }

      if (result.success) {
        trace.orchestratorSuccess()
        if (result.source) {
          trace.resultSource(result.source)
        }
      } else {
        trace.orchestratorError(result.error || 'Error desconocido')
      }

      const hasRealResult = result.success && result.result !== null && result.result !== undefined
      const source = result.source || 'openclaw-fallback'

      const debugSnapshot = trace.getDebugSnapshot()
      debugSnapshot.source = 'openclaw'
      logDebug(debugSnapshot)

      const tracePresent = trace.getSteps().length > 0
      let warning: string | undefined
      if (!tracePresent) {
        warning = 'No se recibio trazabilidad real de esta ejecucion'
      } else if (result.success && !hasRealResult) {
        warning = 'No execution result available'
      }

      const finalSuccess = result.success && debugSnapshot.executionConfirmed

      let taskStatus: TaskStatus
      if (!result.success) {
        taskStatus = 'error'
      } else if (!debugSnapshot.executionConfirmed) {
        taskStatus = 'unconfirmed'
      } else {
        taskStatus = 'success'
        // FIX 123.1: Record successful execution (fallback - resolves scope)
        recordOpenClawSuccess({ scopeKey: fallbackScopeKey, capabilityKey })
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

      // FIX 121: Fallback response with router decision
      // FIX 124: Add status resolution
      const statusResolution = resolveFinalExecutionStatus({
        hubAllowed: hubResult.allowed,
        hubBlocked: !hubResult.allowed,
        hubReason: hubResult.decisionLog?.join(', '),
        result,
        error: result.error,
        meta: {
          executionConfirmed: debugSnapshot.executionConfirmed,
          source
        },
        debugSnapshot
      })

      ok(res, {
        ...result,
        success: finalSuccess,
        ...(result.success && !debugSnapshot.executionConfirmed ? {
          message: 'Permitido, pero no se pudo confirmar la ejecucion real'
        } : {}),
        warning,
        statusResolution,
        meta: {
          requestId: trace.requestId,
          taskId: task.id,
          hubDecision: hubResult.decisionLog,
          executionTrace: trace.getSteps(),
          executionDurationMs: trace.getTotalDurationMs(),
          tenantId: context.tenant.id,
          source,
          adapterStatus,
          debugSnapshot,
          routerDecision: {
            provider: routeDecision.provider,
            reason: routeDecision.reason,
            intentKind: intent.kind,
            needsAi: routeDecision.needsAi,
            tokenSaving: routeDecision.tokenSaving
          }
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

      // FIX 124: Add status resolution for error
      const errorStatusResolution = resolveFinalExecutionStatus({
        hubAllowed: undefined,
        hubBlocked: undefined,
        error: errorMessage,
        debugSnapshot
      })

      ok(res, {
        success: false,
        error: errorMessage,
        statusResolution: errorStatusResolution,
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

      // FIX 121: STEP 1 - Classify intent FIRST (BEFORE capability detection)
      const intent: IntentClassification = classifyIntent(input.message)
      console.log(`[Intent Classifier Stream] kind=${intent.kind} confidence=${intent.confidence} needsAi=${intent.needsAi}`)

      // FIX 121: Get hub config and execution policy
      const hubConfig = hub.getConfig(context.tenant.id)
      const executionPolicy = getExecutionPolicy(context.tenant.id)

      // FIX 121: STEP 2 - Capability detection (only provides signals)
      const missingCapability = detectMissingCapability(input.message)
      const capabilityKey = missingCapability?.capabilityKey || (missingCapability ? normalizeCapabilityKey(missingCapability.proposedToolName) : undefined)

      // FIX 121: Capability lookup if we have a key
      let capabilityAny = null
      let capabilityEnabled = null
      let proposalCount = 0
      let capabilityCount = 0

      if (capabilityKey) {
        capabilityAny = getCapabilityByKey(context.tenant.id, capabilityKey)
        capabilityEnabled = getEnabledCapabilityByKey(context.tenant.id, capabilityKey)
        proposalCount = countDuplicateProposals(context.tenant.id, capabilityKey)
        capabilityCount = countCapabilitiesByKey(context.tenant.id, capabilityKey)

        console.log(`[Capability Lookup Stream] capabilityKey=${capabilityKey} found=${!!capabilityAny} enabled=${capabilityAny?.enabled ?? false}`)
      }

      // FIX 121: STEP 3 - AUTHORITATIVE router decision
      const routeDecision: ExecutionRouteDecision = decideExecutionRoute({
        tenantId: context.tenant.id,
        userId: context.user.id,
        message: input.message,
        mode: hubConfig.mode === 'passthrough' ? 'passthrough' : 'strict',
        hubAllowed: true,
        intent,
        detectedCapabilityKey: capabilityKey,
        approvedCapability: capabilityEnabled && capabilityKey ? {
          id: capabilityEnabled.id,
          capabilityKey: capabilityEnabled.capabilityKey || capabilityKey,
          enabled: capabilityEnabled.enabled,
          riskLevel: capabilityEnabled.riskLevel || 'medium'
        } : undefined,
        policyConfig: executionPolicy
      })

      console.log(`[Execution Router Stream] AUTHORITATIVE provider=${routeDecision.provider} reason="${routeDecision.reason}"`)

      // FIX 121: Provider 'openclaw' - delegate to OpenClaw streaming
      if (routeDecision.provider === 'openclaw') {
        console.log(`[GranClaw Stream] Delegating to OpenClaw: ${routeDecision.reason}`)

        // FIX 123.1: Check if OpenClaw requires setup (streaming - granular)
        const streamScopeKey = getScopeFromCapability(capabilityKey)
        const streamIsSimple = intent.kind === 'simple_question' || intent.kind === 'analysis_task'

        if (shouldBlockForSetup({ scopeKey: streamScopeKey, capabilityKey, isSimpleQuery: streamIsSimple })) {
          const requirement = getBlockingRequirement({ scopeKey: streamScopeKey, capabilityKey })
          console.log(`[GranClaw Stream] Setup required for scope=${streamScopeKey}`)
          storePendingAction({ input: input.message, tenantId: context.tenant.id, userId: context.user.id, timestamp: Date.now(), capabilityKey, scopeKey: streamScopeKey })
          trace.addStep({ stage: 'orchestrator', status: 'blocked', label: 'Configuración requerida', detail: requirement?.reason || 'OpenClaw necesita configuración' })
          const debugSnapshot = trace.getDebugSnapshot()
          debugSnapshot.source = 'setup-required'
          debugSnapshot.executionConfirmed = false
          completeTask(task.id, 'blocked', undefined, 'setup-required', trace.getSteps(), debugSnapshot, trace.getTotalDurationMs(), 'Configuración requerida')
          const setupResponse = createSetupRequiredResponse(trace.requestId, task.id, { pendingInput: input.message, scopeKey: streamScopeKey, capabilityKey, requirement })
          // FIX 124: Add status resolution for setup_required (streaming)
          const streamSetupStatusResolution = resolveFinalExecutionStatus({
            hubAllowed: hubResult.allowed,
            executionStatus: 'setup_required',
            meta: { requiresSetup: true },
            debugSnapshot
          })
          ok(res, { ...setupResponse, statusResolution: streamSetupStatusResolution, meta: { ...setupResponse.meta, hubDecision: hubResult.decisionLog, tenantId: context.tenant.id, systemState: getSystemState(), activeRequirements: getActiveRequirements() } })
          return
        }

        trace.addStep({
          stage: 'orchestrator',
          status: 'success',
          label: 'Delegado a OpenClaw (stream)',
          detail: routeDecision.reason
        })

        // Use streaming task for OpenClaw
        const taskInput: StreamTaskInput = {
          ...input,
          tenantId: context.tenant.id,
          message: hubResult.modifiedMessage || input.message
        }

        const result = await runStreamingTask(taskInput)

        // FIX 122 + FIX 123: Detect reauth and update system state (stream)
        const reauthDetectionStream = detectAndMarkReauthRequired(result, {
          input: input.message,
          tenantId: context.tenant.id,
          userId: context.user.id,
          capabilityKey: capabilityKey
        })
        if (reauthDetectionStream.requiresReauth) {
          console.log(`[GranClaw Stream] Reauth required: ${reauthDetectionStream.matchedText}`)

          trace.addStep({
            stage: 'openclaw',
            status: 'error',
            label: 'Reautorización requerida',
            detail: `OpenClaw requiere permisos: ${reauthDetectionStream.matchedText}`
          })

          const debugSnapshot = trace.getDebugSnapshot()
          debugSnapshot.source = 'openclaw'
          debugSnapshot.executionConfirmed = false
          debugSnapshot.error = 'Reauthorization required'
          logDebug(debugSnapshot)

          completeTask(task.id, 'error', undefined, 'openclaw-reauth', trace.getSteps(), debugSnapshot, trace.getTotalDurationMs(), 'Reautorización requerida')

          const reauthResponse = createReauthRequiredResponse(result, reauthDetectionStream, trace.requestId, task.id)
          ok(res, {
            ...reauthResponse,
            meta: {
              ...reauthResponse.meta,
              hubDecision: hubResult.decisionLog,
              executionTrace: trace.getSteps(),
              tenantId: context.tenant.id,
              adapterStatus,
              debugSnapshot
            }
          })
          return
        }

        const debugSnapshot = trace.getDebugSnapshot()
        debugSnapshot.source = 'openclaw'

        // FIX 123.1: Record successful execution (streaming openclaw - resolves scope)
        if (result.success) {
          recordOpenClawSuccess({ scopeKey: streamScopeKey, capabilityKey })
        }

        completeTask(
          task.id,
          result.success ? 'success' : 'error',
          result.result,
          'openclaw',
          trace.getSteps(),
          debugSnapshot,
          trace.getTotalDurationMs(),
          undefined,
          result.error
        )

        // Response already sent by runStreamingTask
        return
      }

      // FIX 121: Provider 'local' - execute via capability (streaming response)
      if (routeDecision.provider === 'local' && capabilityKey && capabilityEnabled) {
          console.log(`[GranClaw] Executing approved capability: ${capabilityEnabled.toolName} (key: ${capabilityKey}) via ${routeDecision.provider}`)

          // FIX 111: Use dispatcher instead of direct execution
          // FIX 112/FEATURE 120: hubConfig already loaded above
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
            detail: `Capability: ${capabilityEnabled.toolName} via ${routeDecision.provider}`
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
              routerDecision: {
                provider: routeDecision.provider,
                reason: routeDecision.reason,
                intentKind: intent.kind
              },
              ...dispatchResult.meta
            }
          })
          return
      }

      // FIX 121: Provider 'local' but capability disabled
      if (routeDecision.provider === 'local' && capabilityKey && capabilityAny && !capabilityAny.enabled) {
        console.log(`[GranClaw Stream] Capability disabled: ${capabilityAny.toolName}`)

        trace.addStep({
          stage: 'tool',
          status: 'blocked',
          label: 'Capacidad desactivada',
          detail: `Capability ${capabilityAny.toolName} desactivada`
        })

        const debugSnapshot = trace.getDebugSnapshot()
        debugSnapshot.toolCalled = false
        debugSnapshot.executionConfirmed = false
        debugSnapshot.source = 'granclaw'
        debugSnapshot.error = 'Capability disabled'
        logDebug(debugSnapshot)

        completeTask(task.id, 'blocked', undefined, 'granclaw', trace.getSteps(), debugSnapshot, trace.getTotalDurationMs(), 'Capacidad desactivada')

        ok(res, {
          success: false,
          error: 'Capability disabled',
          message: 'Esta capacidad esta aprobada pero desactivada.',
          meta: {
            requestId: trace.requestId,
            taskId: task.id,
            capabilityKey,
            source: 'granclaw',
            debugSnapshot
          }
        })
        return
      }

      // FIX 121: Provider 'proposal' - create tool proposal
      if (routeDecision.provider === 'proposal' && capabilityKey && missingCapability) {
        console.log(`[GranClaw Stream] Creating proposal for capabilityKey: ${capabilityKey}`)

        let proposal = findExistingProposal(context.tenant.id, capabilityKey, 'pending')
        if (!proposal) {
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

        trace.addStep({
          stage: 'tool',
          status: 'blocked',
          label: 'Capacidad no disponible',
          detail: `Propuesta: ${proposal.proposedToolName}`
        })

        const debugSnapshot = trace.getDebugSnapshot()
        debugSnapshot.source = 'granclaw'
        logDebug(debugSnapshot)

        completeTask(task.id, 'unconfirmed', undefined, 'granclaw', trace.getSteps(), debugSnapshot, trace.getTotalDurationMs(), 'Propuesta creada')

        ok(res, {
          success: false,
          error: 'Missing capability',
          message: 'GranClaw no tiene todavia una herramienta para esta accion.',
          meta: {
            requestId: trace.requestId,
            taskId: task.id,
            toolProposalId: proposal.id,
            capabilityKey,
            source: 'granclaw',
            debugSnapshot,
            routerDecision: {
              provider: routeDecision.provider,
              reason: routeDecision.reason,
              intentKind: intent.kind
            }
          }
        })
        return
      }

      // FIX 121: Fallback to streaming OpenClaw
      console.log(`[GranClaw Stream] Fallback to OpenClaw streaming`)

      // FIX 123.1: Check if OpenClaw requires setup (streaming fallback - granular)
      const streamFbScopeKey = getScopeFromCapability(capabilityKey)
      const streamFbIsSimple = intent.kind === 'simple_question' || intent.kind === 'analysis_task'

      if (shouldBlockForSetup({ scopeKey: streamFbScopeKey, capabilityKey, isSimpleQuery: streamFbIsSimple })) {
        const requirement = getBlockingRequirement({ scopeKey: streamFbScopeKey, capabilityKey })
        console.log(`[GranClaw Stream Fallback] Setup required for scope=${streamFbScopeKey}`)
        const setupDebugSnapshot = trace.getDebugSnapshot()
        setupDebugSnapshot.source = 'setup-required'
        setupDebugSnapshot.executionConfirmed = false
        completeTask(task.id, 'blocked', undefined, 'setup-required', trace.getSteps(), setupDebugSnapshot, trace.getTotalDurationMs(), 'Configuración requerida')
        const setupResponse = createSetupRequiredResponse(trace.requestId, task.id, { pendingInput: input.message, scopeKey: streamFbScopeKey, requirement })
        // FIX 124: Add status resolution for setup_required (streaming fallback)
        const streamFbSetupStatusResolution = resolveFinalExecutionStatus({
          hubAllowed: hubResult.allowed,
          executionStatus: 'setup_required',
          meta: { requiresSetup: true },
          debugSnapshot: setupDebugSnapshot
        })
        ok(res, { ...setupResponse, statusResolution: streamFbSetupStatusResolution, meta: { ...setupResponse.meta, hubDecision: hubResult.decisionLog, tenantId: context.tenant.id, systemState: getSystemState(), activeRequirements: getActiveRequirements() } })
        return
      }

      const taskInputFallback: StreamTaskInput = {
        ...input,
        tenantId: context.tenant.id,
        message: hubResult.modifiedMessage || input.message
      }

      const result = await runStreamingTask(taskInputFallback)

      // FIX 122 + FIX 123: Detect reauth and update system state (stream fallback)
      const reauthDetectionStreamFb = detectAndMarkReauthRequired(result, {
        input: input.message,
        tenantId: context.tenant.id,
        userId: context.user.id
      })
      if (reauthDetectionStreamFb.requiresReauth) {
        console.log(`[GranClaw Stream Fallback] Reauth required: ${reauthDetectionStreamFb.matchedText}`)

        trace.addStep({
          stage: 'openclaw',
          status: 'error',
          label: 'Reautorización requerida',
          detail: `OpenClaw requiere permisos: ${reauthDetectionStreamFb.matchedText}`
        })

        const debugSnapshot = trace.getDebugSnapshot()
        debugSnapshot.source = 'openclaw'
        debugSnapshot.executionConfirmed = false
        debugSnapshot.error = 'Reauthorization required'
        logDebug(debugSnapshot)

        completeTask(task.id, 'error', undefined, 'openclaw-reauth', trace.getSteps(), debugSnapshot, trace.getTotalDurationMs(), 'Reautorización requerida')

        const reauthResponse = createReauthRequiredResponse(result, reauthDetectionStreamFb, trace.requestId, task.id)
        ok(res, {
          ...reauthResponse,
          meta: {
            ...reauthResponse.meta,
            hubDecision: hubResult.decisionLog,
            executionTrace: trace.getSteps(),
            tenantId: context.tenant.id,
            adapterStatus,
            debugSnapshot
          }
        })
        return
      }

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
        // FIX 123.1: Record successful execution (streaming fallback - resolves scope)
        recordOpenClawSuccess({ scopeKey: streamFbScopeKey, capabilityKey })
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
      // FIX 124: Add status resolution (streaming fallback)
      const streamFbStatusResolution = resolveFinalExecutionStatus({
        hubAllowed: hubResult.allowed,
        hubBlocked: !hubResult.allowed,
        hubReason: hubResult.decisionLog?.join(', '),
        result,
        error: result.error,
        meta: {
          executionConfirmed: debugSnapshot.executionConfirmed,
          source
        },
        debugSnapshot
      })

      ok(res, {
        ...result,
        success: finalSuccess,
        // Si success original pero no confirmado, cambiar mensaje
        ...(result.success && !debugSnapshot.executionConfirmed ? {
          message: 'Permitido, pero no se pudo confirmar la ejecucion real'
        } : {}),
        warning,
        statusResolution: streamFbStatusResolution,
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

      // FIX 124: Add status resolution for error (streaming)
      const streamErrorStatusResolution = resolveFinalExecutionStatus({
        hubAllowed: undefined,
        hubBlocked: undefined,
        error: errorMessage,
        debugSnapshot
      })

      ok(res, {
        success: false,
        error: errorMessage,
        statusResolution: streamErrorStatusResolution,
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
