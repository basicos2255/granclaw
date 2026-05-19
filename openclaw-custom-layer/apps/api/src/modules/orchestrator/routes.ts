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
import { storePendingAction, getSystemState, getActiveRequirements, addSetupRequirement } from '../system-state'
import type { RunTaskInput, StreamTaskInput } from './types'
import type { AuthContext } from '../auth'
import { getGranClawHubService } from '../granclaw-hub'
import { ExecutionTraceBuilder, type DebugSnapshot } from './trace'
import { createTask, completeTask, updateTask, buildCapabilityGateFailureExplanation, buildCapabilityGateResult, type TaskStatus } from '../tasks'
import { detectMissingCapability, createToolProposal, findExistingProposal, countDuplicateProposals } from '../tool-proposals'
import { getEnabledCapabilityByKey, getCapabilityByKey, normalizeCapabilityKey, countCapabilitiesByKey, dispatchCapabilityExecution, type ExecutionMode } from '../capabilities'
// FEATURE 110: OS Tools - keeping imports for whitelist check
import { isOSToolCapability, getOSToolConfig } from '../os-tools'
// FEATURE 120 + FIX 121: Hybrid Execution Policy with Intent Classification
// P6.9: Added execution mode classification
import {
  getExecutionPolicy,
  decideExecutionRoute,
  classifyIntent,
  classifyExecutionMode,
  type ExecutionRouteDecision,
  type IntentClassification,
  type ExecutionModeResult
} from '../execution-policy'
// P6.9: Queue integration for multistep tasks
import { enqueueCompositeTask, type EnqueueResult } from '../runtime-queue/execution-integration'
// P6.17: Task events for live monitoring
import { emitTaskEvent } from '../runtime-ws'
// P6.9: Composite task planning for proper plan structure
import { buildCompositeExecutionPlan } from '../composite-tasks/planner'
// P6.18D4: CapabilityReadinessSummary for streaming truth parity
import type { CapabilityReadinessSummary } from '../composite-tasks/types'
// FIX 124: Final Execution Status Resolution
import { resolveFinalExecutionStatus, type ResolvedExecutionStatus } from '../execution-status'
// P6.18D: Capability gate check for all capability-backed intents
import { getCapabilityGateReadiness, type CapabilityGateCheckResult } from '../capabilities'
// FEATURE 130: Task memory integration for pattern reuse
import {
  checkTaskMemory,
  learnFromExecution,
  getExecutionPlanFromPattern,
  recordPatternExecution
} from './task-memory-integration'

/**
 * FIX 111: Capability execution is now handled by capability-dispatcher.ts
 * This removes the large switch statement and centralizes execution logic.
 */

// ============================================================================
// P6.18D: INTENT TO CAPABILITY MAPPING
// P6.18D4: Enhanced normalization and robust patterns
// ============================================================================

/**
 * P6.18D4: Normalize text by removing accents/diacritics and normalizing whitespace
 * This ensures patterns match variants like "página" and "pagina"
 */
function normalizeForPatternMatch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * P6.18D4: Deterministic patterns for search/web intents
 * These MUST be checked to block mock success
 * ALL patterns now work on normalized text (no accents)
 */
const SEARCH_WEB_PATTERNS = [
  /\b(busca|buscar|busqueda|search)\b.*\b(internet|web|google|online)\b/i,
  /\b(internet|web|google|online)\b.*\b(busca|buscar|busqueda|search)\b/i,
  /\b(busca|buscar)\s+(info|informacion|datos|sobre|acerca)/i,
  /\b(investiga|investigar|encuentra|encontrar)\s+.*(web|internet|online)/i,
  /\b(web\s+search|google\s+search|internet\s+search)\b/i,
  // P6.18D4: Catch simple search requests without internet/web qualifier
  /^busca\s+info\s+de\s+/i,
  /^buscar\s+info\s+de\s+/i,
  /^busca\s+informacion\s+(de|sobre)\s+/i
]

/**
 * P6.18D4: Enhanced browser patterns
 * Now works on normalized text and catches more variants
 */
const BROWSER_PATTERNS = [
  // Patterns with page/site qualifier (pagina normalized from página)
  /\b(abre|abrir|open|navega|navegar)\b.*\b(web|pagina|sitio|url|http|browser|navegador)\b/i,
  /\b(navega|navegar|browse)\b.*\b(a|to)\b/i,
  // URLs
  /^https?:\/\//i,
  // P6.18D4: Simple "abre X" patterns for opening destinations
  /^abre\s+(el\s+)?(sitio|navegador|browser)/i,
  /^abrir\s+(el\s+)?(sitio|navegador|browser)/i,
  // P6.18D4: "abre + known site" patterns (google, facebook, etc.)
  /^abre\s+(la\s+)?(pagina\s+)?(de\s+)?(google|facebook|twitter|youtube|instagram|linkedin|amazon|github|gmail)/i,
  /^abrir\s+(la\s+)?(pagina\s+)?(de\s+)?(google|facebook|twitter|youtube|instagram|linkedin|amazon|github|gmail)/i,
  // P6.18D4: "usa el navegador para" patterns
  /\busa\s+(el\s+)?navegador\s+(para|y)\b/i,
  // P6.18D4: Simple "abre google" without "la pagina de"
  /^abre\s+google$/i,
  /^abrir\s+google$/i,
  // P6.18D4: "navega a X" patterns
  /^navega\s+a\s+\S+/i,
  /^navegar\s+a\s+\S+/i
]

const DOWNLOAD_PATTERNS = [
  /\b(descarga|descargar|download|baja|bajar)\b/i
]

const INSTALL_PATTERNS = [
  /\b(instala|instalar|install|setup)\b/i
]

/**
 * P6.18D4: Get required capability for an intent
 * CRITICAL: This maps user intents to required capabilities to block mock success
 * Uses normalized text to match accented and non-accented variants
 *
 * @returns capability key or undefined if no specific capability required
 */
function getRequiredCapabilityForIntent(
  intent: IntentClassification,
  message: string
): string | undefined {
  // P6.18D4: Normalize message for pattern matching (remove accents, lowercase)
  const normalizedMessage = normalizeForPatternMatch(message)

  // Check explicit intent types first
  if (intent.kind === 'web_action') {
    // Web action could be search or browser
    if (SEARCH_WEB_PATTERNS.some(p => p.test(normalizedMessage))) {
      return 'web_search'
    }
    if (BROWSER_PATTERNS.some(p => p.test(normalizedMessage))) {
      return 'browser'
    }
    // Default to web_search for generic web actions
    return 'web_search'
  }

  if (intent.kind === 'install_download_action') {
    // Check if download or install
    if (INSTALL_PATTERNS.some(p => p.test(normalizedMessage))) {
      return 'install_app'
    }
    if (DOWNLOAD_PATTERNS.some(p => p.test(normalizedMessage))) {
      return 'download'
    }
    // Default to download for generic install/download
    return 'download'
  }

  // Check message patterns for intents that might not be explicitly classified
  // P6.18D4: CRITICAL - Use normalized message for all pattern checks
  if (SEARCH_WEB_PATTERNS.some(p => p.test(normalizedMessage))) {
    return 'web_search'
  }

  if (BROWSER_PATTERNS.some(p => p.test(normalizedMessage))) {
    return 'browser'
  }

  if (DOWNLOAD_PATTERNS.some(p => p.test(normalizedMessage))) {
    return 'download'
  }

  if (INSTALL_PATTERNS.some(p => p.test(normalizedMessage))) {
    return 'install_app'
  }

  // No specific capability required
  return undefined
}

/**
 * P6.18D3: Shared capability gate check result interface
 */
interface CapabilityGateResult {
  blocked: boolean
  capabilityKey: string
  gateCheck?: CapabilityGateCheckResult
  response?: {
    success: false
    error: string
    message: string
    capabilityGate: true
    meta: Record<string, unknown>
  }
}

/**
 * P6.18D3: Check capability gate for a given intent and message
 * Used by both normal (/run) and streaming (/run-stream) routes
 *
 * CRITICAL: This is the SINGLE authoritative gate check to avoid mock success
 */
async function checkCapabilityGate(
  tenantId: string,
  intent: IntentClassification,
  message: string,
  trace: ExecutionTraceBuilder,
  taskId: string
): Promise<CapabilityGateResult> {
  const requiredCapability = getRequiredCapabilityForIntent(intent, message)

  if (!requiredCapability) {
    return { blocked: false, capabilityKey: '' }
  }

  const gateCheck = await getCapabilityGateReadiness(tenantId, requiredCapability)

  if (gateCheck.canProceed) {
    return { blocked: false, capabilityKey: requiredCapability, gateCheck }
  }

  // Capability is NOT ready - must block
  console.log(`[GranClaw P6.18D3] Capability gate BLOCKED: ${requiredCapability} - ${gateCheck.message}`)

  trace.addStep({
    stage: 'orchestrator',
    status: 'blocked',
    label: 'Capability gate check',
    detail: `${requiredCapability}: ${gateCheck.state} - ${gateCheck.message}`
  })

  const debugSnapshot = trace.getDebugSnapshot()
  debugSnapshot.source = 'validation'
  debugSnapshot.executionConfirmed = false
  debugSnapshot.error = `Capability not ready: ${requiredCapability}`

  return {
    blocked: true,
    capabilityKey: requiredCapability,
    gateCheck,
    response: {
      success: false,
      error: `Capability not ready: ${requiredCapability}`,
      message: gateCheck.message,
      capabilityGate: true,
      meta: {
        requestId: trace.requestId,
        taskId,
        capabilityKey: requiredCapability,
        capabilityState: gateCheck.state,
        source: gateCheck.source,
        blockingCapabilities: gateCheck.blockingCapabilities,
        recoveryActions: gateCheck.recoveryActions,
        checkedAt: gateCheck.checkedAt,
        debugSnapshot
      }
    }
  }
}

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

    // P6.17: Emit task:created event
    emitTaskEvent(
      context.tenant.id,
      context.user.id,
      'task:created',
      {
        taskId: task.id,
        status: 'pending',
        message: `Task created: ${input.message.substring(0, 50)}...`
      }
    )

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

      // P6.9: STEP 1.5 - Classify execution mode (determines HOW to execute)
      const executionMode: ExecutionModeResult = classifyExecutionMode(intent)
      console.log(`[Execution Mode] mode=${executionMode.mode} useQueue=${executionMode.useQueue}`)
      console.log(`[Execution Mode] streamProgress=${executionMode.streamProgress} requiresEvidence=${executionMode.requiresEvidence}`)
      console.log(`[Execution Mode] reason="${executionMode.reason}"`)

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

      // P6.9: STEP 4.0 - Check if task needs queue execution (multistep tasks)
      // This MUST be checked BEFORE any direct execution to prevent "Pensando..." bug
      if (executionMode.useQueue && routeDecision.provider === 'openclaw') {
        console.log(`[GranClaw P6.9] Multistep task requires queue execution: ${executionMode.reason}`)

        trace.addStep({
          stage: 'orchestrator',
          status: 'running',
          label: 'Encolando tarea multistep',
          detail: `Modo: ${executionMode.mode}, Intent: ${intent.kind}`
        })

        // P6.9: Build a proper composite execution plan
        const planResult = buildCompositeExecutionPlan({
          input: input.message,
          tenantId: context.tenant.id,
          userId: context.user.id
        })

        if (!planResult.plan) {
          // P6.11: Planner failed - DO NOT fall through to direct execution
          // When useQueue=true, we MUST NOT use runSimpleAgentTask
          console.log(`[GranClaw P6.11] Planner failed: ${planResult.reason} - returning error (no fallback)`)
          trace.addStep({
            stage: 'orchestrator',
            status: 'error',
            label: 'Planner falló',
            detail: planResult.reason || 'No se pudo crear plan'
          })

          const debugSnapshot = trace.getDebugSnapshot()
          debugSnapshot.source = 'validation'  // P6.11: Use 'validation' for planner failures
          debugSnapshot.executionConfirmed = false
          debugSnapshot.error = 'Planner failed'
          logDebug(debugSnapshot)

          completeTask(
            task.id,
            'error',
            { plannerFailed: true, reason: planResult.reason },
            'validation',  // P6.11: Use 'validation' for planner failures
            trace.getSteps(),
            debugSnapshot,
            trace.getTotalDurationMs(),
            `No se pudo crear plan de ejecución: ${planResult.reason || 'Error desconocido'}`
          )

          // P6.11: Return proper error response - NOT fallback to direct execution
          ok(res, {
            success: false,
            error: `No se pudo planificar la tarea: ${planResult.reason || 'Error desconocido'}`,
            plannerFailed: true,
            meta: {
              requestId: trace.requestId,
              taskId: task.id,
              executionMode: executionMode.mode,
              intentKind: intent.kind,
              isMultiStep: intent.isMultiStep,
              hubDecision: hubResult.decisionLog,
              executionTrace: trace.getSteps(),
              executionDurationMs: trace.getTotalDurationMs(),
              tenantId: context.tenant.id,
              adapterStatus,
              debugSnapshot,
              routerDecision: {
                provider: 'planner-failed',
                reason: planResult.reason || 'No se pudo crear plan',
                intentKind: intent.kind
              }
            }
          })
          return
        }

        // P6.16: Capability gate - block execution if required capabilities are not available
        if (planResult.blockingCapabilities && planResult.blockingCapabilities.length > 0) {
          const blockedCaps = planResult.blockingCapabilities.map(c => c.capability).join(', ')
          console.log(`[GranClaw P6.16] Capability gate BLOCKED: ${blockedCaps}`)

          trace.addStep({
            stage: 'orchestrator',
            status: 'error',
            label: 'Capability no disponible',
            detail: `Capacidades requeridas no disponibles: ${blockedCaps}`
          })

          const debugSnapshot = trace.getDebugSnapshot()
          debugSnapshot.source = 'validation'
          debugSnapshot.executionConfirmed = false
          debugSnapshot.error = 'Capability not available'
          logDebug(debugSnapshot)

          // P6.17R5: Build complete result with plan evidence
          const capabilityGateResult = buildCapabilityGateResult({
            blockingCapabilities: planResult.blockingCapabilities,
            plan: planResult.plan ? {
              id: planResult.plan.id,
              sourceInput: planResult.plan.sourceInput,
              steps: planResult.plan.steps.map(s => ({
                stepId: s.stepId,
                order: s.order,
                actionType: s.actionType,
                targetEntity: s.targetEntity,
                capabilityKey: s.capabilityKey,
                description: s.description
              }))
            } : undefined,
            reason: `Capacidades no disponibles: ${blockedCaps}`
          })

          completeTask(
            task.id,
            'blocked',
            capabilityGateResult,
            'validation',
            trace.getSteps(),
            debugSnapshot,
            trace.getTotalDurationMs(),
            `La tarea requiere capacidades que no están disponibles: ${blockedCaps}`
          )

          // P6.17R4: Set proper failureExplanation using blockingCapabilities data
          const capabilityFailureExplanation = buildCapabilityGateFailureExplanation({
            blockingCapabilities: planResult.blockingCapabilities,
            taskInput: input.message,
            provider: 'validation'
          })
          updateTask(task.id, { failureExplanation: capabilityFailureExplanation })

          ok(res, {
            success: false,
            error: `Capacidades requeridas no disponibles: ${blockedCaps}`,
            capabilityGate: true,
            blockingCapabilities: planResult.blockingCapabilities,
            meta: {
              requestId: trace.requestId,
              taskId: task.id,
              executionMode: executionMode.mode,
              intentKind: intent.kind,
              executionTrace: trace.getSteps(),
              executionDurationMs: trace.getTotalDurationMs(),
              debugSnapshot
            }
          })
          return
        }

        // Planner succeeded - continue with queueing
        {
          console.log(`[GranClaw P6.16] Plan created: ${planResult.plan.id} with ${planResult.plan.steps.length} steps`)

          const queueResult: EnqueueResult = enqueueCompositeTask(
            {
              planId: planResult.plan.id,
              plan: planResult.plan,
              input: input.message,
              taskId: task.id,  // P6.10: Required for job-task reconciliation
              context: {
                tenantId: context.tenant.id,
                userId: context.user.id,
                sessionId: input.sessionId,
                capabilityKey,
                intentKind: intent.kind,
                executionMode: executionMode.mode,
                requiresEvidence: executionMode.requiresEvidence
              }
            },
            {
              tenantId: context.tenant.id,
              userId: context.user.id,
              correlationId: trace.requestId
            },
            {
              priority: 'normal',
              tags: [intent.kind, 'multistep', 'p6.9', 'p6.10']
            }
          )

          if (queueResult.queued && queueResult.jobId) {
            console.log(`[GranClaw P6.9] Task queued successfully: jobId=${queueResult.jobId}`)

            trace.addStep({
              stage: 'queue',
              status: 'success',
              label: 'Tarea encolada',
              detail: `JobId: ${queueResult.jobId}, Steps: ${planResult.plan.steps.length}`
            })

            const debugSnapshot = trace.getDebugSnapshot()
            debugSnapshot.source = 'queue'
            debugSnapshot.executionConfirmed = false // Will be confirmed when job completes
            logDebug(debugSnapshot)

            // P6.9R: Update task status to indicate it's queued (not pending)
            completeTask(
              task.id,
              'queued', // P6.9R: Explicit queued status, not ambiguous 'pending'
              {
                queued: true,
                jobId: queueResult.jobId,
                planId: planResult.plan.id,
                steps: planResult.plan.steps.length,
                executionMode: executionMode.mode
              },
              'queue',
              trace.getSteps(),
              debugSnapshot,
              trace.getTotalDurationMs()
            )

            // P6.17: Emit task:queued event
            emitTaskEvent(
              context.tenant.id,
              context.user.id,
              'task:queued',
              {
                taskId: task.id,
                jobId: queueResult.jobId,
                status: 'queued',
                message: `Task queued with ${planResult.plan.steps.length} steps`,
                totalSteps: planResult.plan.steps.length
              }
            )

            // Return queued response
            ok(res, {
              success: true,
              queued: true,
              message: `Tarea multistep encolada: ${planResult.plan.steps.length} pasos`,
              meta: {
                requestId: trace.requestId,
                taskId: task.id,
                jobId: queueResult.jobId,
                planId: planResult.plan.id,
                planSteps: planResult.plan.steps.length,
                executionMode: executionMode.mode,
                intentKind: intent.kind,
                isMultiStep: intent.isMultiStep,
                requiresEvidence: executionMode.requiresEvidence,
                hubDecision: hubResult.decisionLog,
                executionTrace: trace.getSteps(),
                executionDurationMs: trace.getTotalDurationMs(),
                tenantId: context.tenant.id,
                adapterStatus,
                debugSnapshot,
                routerDecision: {
                  provider: 'queue',
                  reason: executionMode.reason,
                  intentKind: intent.kind
                }
              }
            })
            return
          } else {
            // P6.11: Queue failed - DO NOT fall through to direct execution
            // When useQueue=true, we MUST NOT use runSimpleAgentTask
            console.log(`[GranClaw P6.11] Queue failed - returning error (no fallback to direct execution)`)
            trace.addStep({
              stage: 'queue',
              status: 'error',
              label: 'Fallo al encolar',
              detail: 'No se pudo encolar la tarea multistep'
            })

            const debugSnapshot = trace.getDebugSnapshot()
            debugSnapshot.source = 'queue'
            debugSnapshot.executionConfirmed = false
            debugSnapshot.error = 'Queue failed'
            logDebug(debugSnapshot)

            completeTask(
              task.id,
              'error',
              { queueFailed: true, planId: planResult.plan.id },
              'queue',
              trace.getSteps(),
              debugSnapshot,
              trace.getTotalDurationMs(),
              'No se pudo encolar la tarea para ejecución'
            )

            // P6.11: Return proper error response - NOT fallback to direct execution
            ok(res, {
              success: false,
              error: 'No se pudo encolar la tarea multistep para ejecución',
              queueFailed: true,
              meta: {
                requestId: trace.requestId,
                taskId: task.id,
                planId: planResult.plan.id,
                executionMode: executionMode.mode,
                intentKind: intent.kind,
                isMultiStep: intent.isMultiStep,
                hubDecision: hubResult.decisionLog,
                executionTrace: trace.getSteps(),
                executionDurationMs: trace.getTotalDurationMs(),
                tenantId: context.tenant.id,
                adapterStatus,
                debugSnapshot,
                routerDecision: {
                  provider: 'queue-failed',
                  reason: 'No se pudo encolar',
                  intentKind: intent.kind
                }
              }
            })
            return
          }
        } // End of planner succeeded block
      }

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

        // =====================================================================
        // P6.18D: CAPABILITY GATE CHECK FOR ALL CAPABILITY-BACKED INTENTS
        // CRITICAL: This prevents mock success for search/browser/download
        // =====================================================================
        const requiredCapability = getRequiredCapabilityForIntent(intent, input.message)

        if (requiredCapability) {
          console.log(`[P6.18D] Intent ${intent.kind} requires capability: ${requiredCapability}`)

          const capabilityGate = await getCapabilityGateReadiness(context.tenant.id, requiredCapability)

          if (!capabilityGate.canProceed) {
            console.log(`[P6.18D] Capability gate BLOCKED: ${requiredCapability} state=${capabilityGate.state}`)

            trace.addStep({
              stage: 'orchestrator',
              status: 'error',
              label: 'Capability no disponible',
              detail: `Capacidad requerida: ${requiredCapability} - ${capabilityGate.message}`
            })

            const debugSnapshot = trace.getDebugSnapshot()
            debugSnapshot.source = 'validation'
            debugSnapshot.executionConfirmed = false
            debugSnapshot.error = 'Capability not available'
            logDebug(debugSnapshot)

            // Build capability gate result with proper structure
            const blockingCaps = capabilityGate.blockingCapabilities || [{
              capability: requiredCapability,
              capabilityKey: requiredCapability,
              available: false,
              configured: false,
              implemented: capabilityGate.state !== 'unavailable',
              statusMessage: capabilityGate.message
            }]

            const capabilityGateResult = buildCapabilityGateResult({
              blockingCapabilities: blockingCaps.map(c => ({
                capability: c.capability || requiredCapability,
                capabilityKey: c.capabilityKey || requiredCapability,
                available: false,
                configured: false,
                implemented: capabilityGate.state !== 'unavailable',
                statusMessage: c.statusMessage || capabilityGate.message
              })),
              reason: capabilityGate.message
            })

            completeTask(
              task.id,
              'blocked',
              capabilityGateResult,
              'capability_gate',
              trace.getSteps(),
              debugSnapshot,
              trace.getTotalDurationMs(),
              capabilityGate.message
            )

            // Build failure explanation for UI
            const failureExplanation = buildCapabilityGateFailureExplanation({
              blockingCapabilities: blockingCaps.map(c => ({
                capability: c.capability || requiredCapability,
                capabilityKey: c.capabilityKey || requiredCapability,
                available: false,
                configured: false,
                implemented: capabilityGate.state !== 'unavailable',
                statusMessage: c.statusMessage || capabilityGate.message
              })),
              taskInput: input.message,
              provider: 'capability_gate'
            })
            updateTask(task.id, { failureExplanation })

            const statusResolution = resolveFinalExecutionStatus({
              hubAllowed: true,
              hubBlocked: false,
              result: { success: false, executionStatus: 'capability_blocked' },
              error: capabilityGate.message,
              source: 'capability_gate',
              meta: { executionConfirmed: false }
            })

            ok(res, {
              success: false,
              error: capabilityGate.message,
              capabilityGate: true,
              blockingCapabilities: blockingCaps,
              statusResolution,
              meta: {
                requestId: trace.requestId,
                taskId: task.id,
                intentKind: intent.kind,
                requiredCapability,
                capabilityState: capabilityGate.state,
                hubDecision: hubResult.decisionLog,
                executionTrace: trace.getSteps(),
                executionDurationMs: trace.getTotalDurationMs(),
                tenantId: context.tenant.id,
                adapterStatus,
                debugSnapshot,
                routerDecision: {
                  provider: 'capability_gate',
                  reason: capabilityGate.message,
                  intentKind: intent.kind
                }
              }
            })
            return
          }

          // Capability gate passed
          console.log(`[P6.18D] Capability gate PASSED: ${requiredCapability} state=${capabilityGate.state}`)
          trace.addStep({
            stage: 'orchestrator',
            status: 'success',
            label: 'Capability disponible',
            detail: `${requiredCapability}: ${capabilityGate.state}`
          })
        }

        // FEATURE 130: Check task memory for reusable pattern BEFORE calling OpenClaw
        const taskMemoryCheck = checkTaskMemory({
          input: input.message,
          tenantId: context.tenant.id,
          userId: context.user.id
        })

        if (taskMemoryCheck.canReuse && taskMemoryCheck.pattern) {
          console.log(`[GranClaw] FEATURE 130: Reusing cached pattern ${taskMemoryCheck.pattern.id}`)

          trace.addStep({
            stage: 'task-memory',
            status: 'success',
            label: 'Patrón reutilizado (sin AI)',
            detail: `${taskMemoryCheck.reason} - ${taskMemoryCheck.pattern.steps.length} pasos`
          })

          const executionPlan = getExecutionPlanFromPattern({
            pattern: taskMemoryCheck.pattern,
            tenantId: context.tenant.id,
            userId: context.user.id
          })

          // Record the reuse
          recordPatternExecution(executionPlan.patternId, true, executionPlan.estimatedDuration)

          const debugSnapshot = trace.getDebugSnapshot()
          debugSnapshot.source = 'task-memory'
          debugSnapshot.executionConfirmed = true
          logDebug(debugSnapshot)

          completeTask(
            task.id,
            'success',
            {
              steps: executionPlan.steps,
              fromPattern: true,
              patternId: executionPlan.patternId,
              tokensEstimatedSaved: executionPlan.tokensEstimatedSaved
            },
            'task-memory',
            trace.getSteps(),
            debugSnapshot,
            trace.getTotalDurationMs()
          )

          const statusResolution = resolveFinalExecutionStatus({
            hubAllowed: true,
            hubBlocked: false,
            result: { success: true, executionStatus: 'executed' },
            source: 'task-memory',
            meta: { executionConfirmed: true, fromTaskMemory: true }
          })

          ok(res, {
            success: true,
            result: {
              steps: executionPlan.steps,
              fromPattern: true,
              patternId: executionPlan.patternId,
              tokensEstimatedSaved: executionPlan.tokensEstimatedSaved,
              message: `Ejecutado usando patrón aprendido (${taskMemoryCheck.pattern.useCount} ejecuciones previas)`
            },
            statusResolution,
            meta: {
              requestId: trace.requestId,
              taskId: task.id,
              hubDecision: hubResult.decisionLog,
              executionTrace: trace.getSteps(),
              executionDurationMs: trace.getTotalDurationMs(),
              tenantId: context.tenant.id,
              source: 'task-memory',
              adapterStatus,
              debugSnapshot,
              taskMemory: {
                patternId: executionPlan.patternId,
                tokensEstimatedSaved: executionPlan.tokensEstimatedSaved,
                patternExecutions: taskMemoryCheck.pattern.useCount,
                patternSuccessRate: taskMemoryCheck.pattern.successRate
              },
              routerDecision: {
                provider: 'task-memory',
                reason: 'Patrón reutilizado',
                intentKind: intent.kind,
                needsAi: false,
                tokenSaving: true
              }
            }
          })
          return
        }

        // Log task memory check result (no reuse)
        if (taskMemoryCheck.hasPattern) {
          console.log(`[GranClaw] FEATURE 130: Pattern found but cannot reuse: ${taskMemoryCheck.reason}`)
        }

        // Go to OpenClaw execution
        const taskInput: RunTaskInput = {
          ...input,
          tenantId: context.tenant.id,
          message: hubResult.modifiedMessage || input.message
        }

        const startTime = Date.now()
        const result = await runSimpleAgentTask(taskInput)
        const executionDuration = Date.now() - startTime

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

        // FIX 124.3: Compute statusResolution BEFORE task completion
        // This allows classifier to override execution status
        const statusResolution = resolveFinalExecutionStatus({
          hubAllowed: true,
          hubBlocked: false,
          hubReason: undefined,
          result,
          raw: result,
          error: result.error,
          source,
          provider: 'openclaw',
          meta: { executionConfirmed: debugSnapshot.executionConfirmed },
          debugSnapshot,
          executionTrace: trace.getSteps()
        })

        // FIX 124.3: Determine task status based on classifier override
        let finalSuccess = result.success && debugSnapshot.executionConfirmed
        let taskStatus: TaskStatus

        if (statusResolution.classifierOverride) {
          console.log(`[GranClaw] Classifier override detected: ${statusResolution.finalUiStatus}`)
          console.log(`[GranClaw] Evidence: ${statusResolution.classifierEvidence?.join(', ')}`)

          // Classifier detected semantic failure - override success flags
          finalSuccess = false
          taskStatus = 'error'

          // Register setup requirement from classifier detection
          if (statusResolution.finalUiStatus === 'reauthorization_required' ||
              statusResolution.finalUiStatus === 'setup_required') {
            addSetupRequirement({
              scopeKey: scopeKey || 'openclaw:unknown_scope',
              capabilityKey,
              reason: statusResolution.reason,
              originalError: statusResolution.classifierEvidence?.join('; ')
            })
            console.log(`[GranClaw] Registered requirement from classifier: ${scopeKey}`)
          }
        } else if (!result.success) {
          taskStatus = 'error'
        } else if (!debugSnapshot.executionConfirmed) {
          taskStatus = 'unconfirmed'
        } else {
          taskStatus = 'success'
          // FIX 123.1: Record successful execution (resolves specific scope/capability)
          recordOpenClawSuccess({ scopeKey, capabilityKey })

          // FEATURE 130 + FIX 130.1: Learn from successful execution (SAFE)
          // Only learns if executionConfirmed=true and no classifier override
          const learnResult = learnFromExecution({
            originalInput: input.message,
            tenantId: context.tenant.id,
            userId: context.user.id,
            steps: trace.getSteps().map((step, idx) => ({
              id: `step-${idx}`,
              order: idx + 1,
              description: step.label || '',
              input: input.message,
              status: step.status === 'success' ? 'completed' : 'pending',
              dependsOnPrevious: idx > 0,
              estimatedDuration: 'medium' as const
            })),
            success: true,
            executionConfirmed: debugSnapshot.executionConfirmed,
            duration: executionDuration,
            scopeKey,
            capabilityKey,
            // FIX 130.1: Pass status resolution info for safe learning
            finalUiStatus: statusResolution.finalUiStatus,
            requiresSetup: false,
            requiresReauth: false,
            timeout: false,
            partial: false,
            classifierOverride: statusResolution.classifierOverride
          })
          console.log(`[GranClaw] FIX 130.1: ${learnResult.reason}`)
        }

        completeTask(
          task.id,
          taskStatus,
          result.result,
          source,
          trace.getSteps(),
          debugSnapshot,
          trace.getTotalDurationMs(),
          statusResolution.classifierOverride ? statusResolution.reason : undefined,
          result.error
        )

        ok(res, {
          ...result,
          success: finalSuccess,
          ...(result.success && !debugSnapshot.executionConfirmed && !statusResolution.classifierOverride ? {
            message: 'Permitido, pero no se pudo confirmar la ejecucion real'
          } : {}),
          ...(statusResolution.classifierOverride ? {
            message: statusResolution.reason
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

      // =====================================================================
      // P6.18D5: CAPABILITY GATE CHECK BEFORE PROPOSAL
      // CRITICAL: Check if message matches capability-backed intent BEFORE
      // falling into proposal. "abre google" must block with capabilityGate,
      // not create proposal open_web_browser.
      // =====================================================================
      const proposalRequiredCapability = getRequiredCapabilityForIntent(intent, input.message)

      if (proposalRequiredCapability) {
        console.log(`[P6.18D5] Pre-proposal capability gate check: ${proposalRequiredCapability}`)

        const proposalCapabilityGate = await getCapabilityGateReadiness(context.tenant.id, proposalRequiredCapability)

        if (!proposalCapabilityGate.canProceed) {
          console.log(`[P6.18D5] Capability gate BLOCKED (pre-proposal): ${proposalRequiredCapability} state=${proposalCapabilityGate.state}`)

          trace.addStep({
            stage: 'orchestrator',
            status: 'blocked',
            label: 'Capability gate (pre-proposal)',
            detail: `${proposalRequiredCapability}: ${proposalCapabilityGate.state} - ${proposalCapabilityGate.message}`
          })

          const debugSnapshot = trace.getDebugSnapshot()
          debugSnapshot.source = 'capability_gate'
          debugSnapshot.executionConfirmed = false
          debugSnapshot.error = `Capability not ready: ${proposalRequiredCapability}`
          logDebug(debugSnapshot)

          // Build blocking caps for result
          const preProposalBlockingCaps = proposalCapabilityGate.blockingCapabilities || [{
            capability: proposalRequiredCapability,
            capabilityKey: proposalRequiredCapability,
            available: false,
            configured: false,
            implemented: proposalCapabilityGate.state !== 'unavailable',
            statusMessage: proposalCapabilityGate.message
          }]

          const preProposalGateResult = buildCapabilityGateResult({
            blockingCapabilities: preProposalBlockingCaps.map(c => ({
              capability: c.capability || proposalRequiredCapability,
              capabilityKey: c.capabilityKey || proposalRequiredCapability,
              available: false,
              configured: false,
              implemented: proposalCapabilityGate.state !== 'unavailable',
              statusMessage: c.statusMessage || proposalCapabilityGate.message
            })),
            reason: proposalCapabilityGate.message
          })

          completeTask(
            task.id,
            'blocked',
            preProposalGateResult,
            'capability_gate',
            trace.getSteps(),
            debugSnapshot,
            trace.getTotalDurationMs(),
            proposalCapabilityGate.message
          )

          // Build failure explanation for truth endpoint
          const preProposalFailureExplanation = buildCapabilityGateFailureExplanation({
            blockingCapabilities: preProposalBlockingCaps.map(c => ({
              capability: c.capability || proposalRequiredCapability,
              capabilityKey: c.capabilityKey || proposalRequiredCapability,
              available: false,
              configured: false,
              implemented: proposalCapabilityGate.state !== 'unavailable',
              statusMessage: c.statusMessage || proposalCapabilityGate.message
            })),
            taskInput: input.message,
            provider: 'capability_gate'
          })
          updateTask(task.id, { failureExplanation: preProposalFailureExplanation })

          const preProposalStatusResolution = resolveFinalExecutionStatus({
            hubAllowed: true,
            hubBlocked: false,
            result: { success: false, executionStatus: 'capability_blocked' },
            error: proposalCapabilityGate.message,
            source: 'capability_gate',
            meta: { executionConfirmed: false }
          })

          ok(res, {
            success: false,
            error: proposalCapabilityGate.message,
            capabilityGate: true,
            blockingCapabilities: preProposalBlockingCaps,
            statusResolution: preProposalStatusResolution,
            meta: {
              requestId: trace.requestId,
              taskId: task.id,
              intentKind: intent.kind,
              requiredCapability: proposalRequiredCapability,
              capabilityKey: proposalRequiredCapability,
              capabilityState: proposalCapabilityGate.state,
              hubDecision: hubResult.decisionLog,
              executionTrace: trace.getSteps(),
              executionDurationMs: trace.getTotalDurationMs(),
              tenantId: context.tenant.id,
              adapterStatus,
              debugSnapshot,
              routerDecision: {
                provider: 'capability_gate',
                reason: proposalCapabilityGate.message,
                intentKind: intent.kind
              }
            }
          })
          return
        }

        // Capability gate passed - continue (should not happen often in proposal path)
        console.log(`[P6.18D5] Capability gate PASSED (pre-proposal): ${proposalRequiredCapability}`)
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

      // P6.11: CRITICAL - Check if multistep task reached fallback (should never happen)
      // If useQueue=true, we MUST NOT fall through to runSimpleAgentTask
      if (executionMode.useQueue) {
        console.log(`[GranClaw P6.11] CRITICAL: Multistep task reached fallback - blocking`)
        trace.addStep({
          stage: 'orchestrator',
          status: 'error',
          label: 'Ruta inválida para multistep',
          detail: `Tarea multistep no debería llegar aquí: provider=${routeDecision.provider}`
        })

        const debugSnapshot = trace.getDebugSnapshot()
        debugSnapshot.source = 'error'
        debugSnapshot.executionConfirmed = false
        debugSnapshot.error = 'Multistep task routing failure'
        logDebug(debugSnapshot)

        completeTask(
          task.id,
          'error',
          { routingError: true, provider: routeDecision.provider },
          'error',
          trace.getSteps(),
          debugSnapshot,
          trace.getTotalDurationMs(),
          'Tarea multistep no pudo ser enrutada correctamente'
        )

        ok(res, {
          success: false,
          error: 'No se pudo procesar la tarea multistep. Por favor, intente de nuevo.',
          routingError: true,
          meta: {
            requestId: trace.requestId,
            taskId: task.id,
            executionMode: executionMode.mode,
            intentKind: intent.kind,
            provider: routeDecision.provider,
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

      // =====================================================================
      // P6.18D: CAPABILITY GATE CHECK FOR FALLBACK PATH
      // CRITICAL: Prevents mock success for search/browser/download
      // =====================================================================
      const fallbackRequiredCapability = getRequiredCapabilityForIntent(intent, input.message)

      if (fallbackRequiredCapability) {
        console.log(`[P6.18D Fallback] Intent ${intent.kind} requires capability: ${fallbackRequiredCapability}`)

        const fallbackCapabilityGate = await getCapabilityGateReadiness(context.tenant.id, fallbackRequiredCapability)

        if (!fallbackCapabilityGate.canProceed) {
          console.log(`[P6.18D Fallback] Capability gate BLOCKED: ${fallbackRequiredCapability} state=${fallbackCapabilityGate.state}`)

          trace.addStep({
            stage: 'orchestrator',
            status: 'error',
            label: 'Capability no disponible (fallback)',
            detail: `Capacidad requerida: ${fallbackRequiredCapability} - ${fallbackCapabilityGate.message}`
          })

          const debugSnapshotFallbackGate = trace.getDebugSnapshot()
          debugSnapshotFallbackGate.source = 'validation'
          debugSnapshotFallbackGate.executionConfirmed = false
          debugSnapshotFallbackGate.error = 'Capability not available'
          logDebug(debugSnapshotFallbackGate)

          // Build capability gate result
          const fallbackBlockingCaps = fallbackCapabilityGate.blockingCapabilities || [{
            capability: fallbackRequiredCapability,
            capabilityKey: fallbackRequiredCapability,
            available: false,
            configured: false,
            implemented: fallbackCapabilityGate.state !== 'unavailable',
            statusMessage: fallbackCapabilityGate.message
          }]

          const fallbackCapabilityGateResult = buildCapabilityGateResult({
            blockingCapabilities: fallbackBlockingCaps.map(c => ({
              capability: c.capability || fallbackRequiredCapability,
              capabilityKey: c.capabilityKey || fallbackRequiredCapability,
              available: false,
              configured: false,
              implemented: fallbackCapabilityGate.state !== 'unavailable',
              statusMessage: c.statusMessage || fallbackCapabilityGate.message
            })),
            reason: fallbackCapabilityGate.message
          })

          completeTask(
            task.id,
            'blocked',
            fallbackCapabilityGateResult,
            'capability_gate',
            trace.getSteps(),
            debugSnapshotFallbackGate,
            trace.getTotalDurationMs(),
            fallbackCapabilityGate.message
          )

          // Build failure explanation for UI
          const fallbackFailureExplanation = buildCapabilityGateFailureExplanation({
            blockingCapabilities: fallbackBlockingCaps.map(c => ({
              capability: c.capability || fallbackRequiredCapability,
              capabilityKey: c.capabilityKey || fallbackRequiredCapability,
              available: false,
              configured: false,
              implemented: fallbackCapabilityGate.state !== 'unavailable',
              statusMessage: c.statusMessage || fallbackCapabilityGate.message
            })),
            taskInput: input.message,
            provider: 'capability_gate'
          })
          updateTask(task.id, { failureExplanation: fallbackFailureExplanation })

          const fallbackStatusResolution = resolveFinalExecutionStatus({
            hubAllowed: true,
            hubBlocked: false,
            result: { success: false, executionStatus: 'capability_blocked' },
            error: fallbackCapabilityGate.message,
            source: 'capability_gate',
            meta: { executionConfirmed: false }
          })

          ok(res, {
            success: false,
            error: fallbackCapabilityGate.message,
            capabilityGate: true,
            blockingCapabilities: fallbackBlockingCaps,
            statusResolution: fallbackStatusResolution,
            meta: {
              requestId: trace.requestId,
              taskId: task.id,
              intentKind: intent.kind,
              requiredCapability: fallbackRequiredCapability,
              capabilityState: fallbackCapabilityGate.state,
              hubDecision: hubResult.decisionLog,
              executionTrace: trace.getSteps(),
              executionDurationMs: trace.getTotalDurationMs(),
              tenantId: context.tenant.id,
              adapterStatus,
              debugSnapshot: debugSnapshotFallbackGate,
              routerDecision: {
                provider: 'capability_gate',
                reason: fallbackCapabilityGate.message,
                intentKind: intent.kind
              }
            }
          })
          return
        }

        // Capability gate passed in fallback
        console.log(`[P6.18D Fallback] Capability gate PASSED: ${fallbackRequiredCapability} state=${fallbackCapabilityGate.state}`)
        trace.addStep({
          stage: 'orchestrator',
          status: 'success',
          label: 'Capability disponible (fallback)',
          detail: `${fallbackRequiredCapability}: ${fallbackCapabilityGate.state}`
        })
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

      // FIX 124.3: Compute statusResolution BEFORE task completion (fallback path)
      const statusResolution = resolveFinalExecutionStatus({
        hubAllowed: hubResult.allowed,
        hubBlocked: !hubResult.allowed,
        hubReason: hubResult.decisionLog?.join(', '),
        result,
        raw: result,
        error: result.error,
        source,
        provider: 'openclaw',
        meta: {
          executionConfirmed: debugSnapshot.executionConfirmed,
          source
        },
        debugSnapshot,
        executionTrace: trace.getSteps()
      })

      // FIX 124.3: Determine task status based on classifier override (fallback)
      let finalSuccess = result.success && debugSnapshot.executionConfirmed
      let taskStatus: TaskStatus

      if (statusResolution.classifierOverride) {
        console.log(`[GranClaw Fallback] Classifier override: ${statusResolution.finalUiStatus}`)
        console.log(`[GranClaw Fallback] Evidence: ${statusResolution.classifierEvidence?.join(', ')}`)

        // Classifier detected semantic failure - override success flags
        finalSuccess = false
        taskStatus = 'error'

        if (statusResolution.finalUiStatus === 'reauthorization_required' ||
            statusResolution.finalUiStatus === 'setup_required') {
          addSetupRequirement({
            scopeKey: fallbackScopeKey || 'openclaw:unknown_scope',
            capabilityKey,
            reason: statusResolution.reason,
            originalError: statusResolution.classifierEvidence?.join('; ')
          })
        }
      } else if (!result.success) {
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
        statusResolution.classifierOverride ? statusResolution.reason : undefined,
        result.error
      )

      ok(res, {
        ...result,
        success: finalSuccess,
        ...(result.success && !debugSnapshot.executionConfirmed && !statusResolution.classifierOverride ? {
          message: 'Permitido, pero no se pudo confirmar la ejecucion real'
        } : {}),
        ...(statusResolution.classifierOverride ? {
          message: statusResolution.reason
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

    // P6.17: Emit task:created event
    emitTaskEvent(
      context.tenant.id,
      context.user.id,
      'task:created',
      {
        taskId: task.id,
        status: 'pending',
        message: `Task created (stream): ${input.message.substring(0, 50)}...`
      }
    )

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

      // P6.9: STEP 1.5 - Classify execution mode (determines HOW to execute)
      const executionMode: ExecutionModeResult = classifyExecutionMode(intent)
      console.log(`[Execution Mode Stream] mode=${executionMode.mode} useQueue=${executionMode.useQueue}`)

      // FIX 121: Get hub config and execution policy
      const hubConfig = hub.getConfig(context.tenant.id)
      const executionPolicy = getExecutionPolicy(context.tenant.id)

      // P6.18D3: CRITICAL - Capability gate check BEFORE any execution
      // This ensures web_search, browser, download, install_app cannot mock success
      const streamCapabilityGate = await checkCapabilityGate(
        context.tenant.id,
        intent,
        input.message,
        trace,
        task.id
      )

      if (streamCapabilityGate.blocked && streamCapabilityGate.response) {
        console.log(`[GranClaw Stream P6.18D4] Capability gate blocked: ${streamCapabilityGate.capabilityKey}`)

        const debugSnapshot = trace.getDebugSnapshot()
        debugSnapshot.source = 'capability_gate'
        debugSnapshot.executionConfirmed = false
        debugSnapshot.error = 'Capability not available'
        logDebug(debugSnapshot)

        // P6.18D4: Convert ExtendedCapabilityReadiness[] to CapabilityReadinessSummary[] for helpers
        const streamBlockingCapabilities: CapabilityReadinessSummary[] = (
          streamCapabilityGate.gateCheck?.blockingCapabilities || []
        ).map(bc => ({
          capability: bc.capability,
          capabilityKey: bc.capabilityKey,
          implemented: bc.state !== 'not_configured' && bc.state !== 'unavailable',
          configured: bc.state !== 'not_configured',
          available: bc.canUseNow,
          statusMessage: bc.statusMessage,
          reason: bc.statusMessage
        }))

        // P6.18D4: If no blockingCapabilities from gateCheck, build from the gate result
        if (streamBlockingCapabilities.length === 0) {
          streamBlockingCapabilities.push({
            capability: streamCapabilityGate.capabilityKey,
            capabilityKey: streamCapabilityGate.capabilityKey,
            implemented: streamCapabilityGate.gateCheck?.state !== 'not_configured',
            configured: streamCapabilityGate.gateCheck?.state !== 'not_configured',
            available: false,
            statusMessage: streamCapabilityGate.gateCheck?.message || streamCapabilityGate.response.message
          })
        }

        // P6.18D4: Build proper result with capabilityGate and blockingCapabilities for truth endpoint
        const streamCapabilityGateResult = buildCapabilityGateResult({
          blockingCapabilities: streamBlockingCapabilities,
          reason: streamCapabilityGate.response.message
        })

        completeTask(
          task.id,
          'blocked',
          streamCapabilityGateResult,
          'capability_gate',
          trace.getSteps(),
          debugSnapshot,
          trace.getTotalDurationMs(),
          streamCapabilityGate.response.message
        )

        // P6.18D4: Build and set proper failureExplanation for truth endpoint
        const streamFailureExplanation = buildCapabilityGateFailureExplanation({
          blockingCapabilities: streamBlockingCapabilities,
          taskInput: input.message,
          provider: 'capability_gate'
        })
        updateTask(task.id, { failureExplanation: streamFailureExplanation })

        ok(res, {
          ...streamCapabilityGate.response,
          blockingCapabilities: streamBlockingCapabilities,
          meta: {
            ...streamCapabilityGate.response.meta,
            hubDecision: hubResult.decisionLog,
            executionTrace: trace.getSteps(),
            executionDurationMs: trace.getTotalDurationMs(),
            tenantId: context.tenant.id,
            adapterStatus,
            blockingCapabilities: streamBlockingCapabilities
          }
        })
        return
      }

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

      // P6.9: Check if task needs queue execution (multistep tasks) - STREAMING
      // Same logic as non-streaming to ensure consistent routing
      if (executionMode.useQueue && routeDecision.provider === 'openclaw') {
        console.log(`[GranClaw Stream P6.9] Multistep task requires queue execution: ${executionMode.reason}`)

        trace.addStep({
          stage: 'orchestrator',
          status: 'running',
          label: 'Encolando tarea multistep (stream)',
          detail: `Modo: ${executionMode.mode}, Intent: ${intent.kind}`
        })

        // P6.9: Build a proper composite execution plan
        const planResult = buildCompositeExecutionPlan({
          input: input.message,
          tenantId: context.tenant.id,
          userId: context.user.id
        })

        if (!planResult.plan) {
          // P6.11R: Planner failed - DO NOT fall through to streaming
          // When useQueue=true, we MUST NOT use streaming simple execution
          console.log(`[GranClaw Stream P6.11R] Planner failed: ${planResult.reason} - returning error (no fallback)`)
          trace.addStep({
            stage: 'orchestrator',
            status: 'error',
            label: 'Planner falló (stream)',
            detail: planResult.reason || 'No se pudo crear plan'
          })

          const debugSnapshot = trace.getDebugSnapshot()
          debugSnapshot.source = 'validation'  // P6.11R: Use 'validation' for planner failures
          debugSnapshot.executionConfirmed = false
          debugSnapshot.error = 'Planner failed'
          logDebug(debugSnapshot)

          completeTask(
            task.id,
            'error',
            { plannerFailed: true, reason: planResult.reason },
            'validation',  // P6.11R: Use 'validation' for planner failures
            trace.getSteps(),
            debugSnapshot,
            trace.getTotalDurationMs(),
            `No se pudo crear plan de ejecución: ${planResult.reason || 'Error desconocido'}`
          )

          // P6.11R: Return proper error response - NOT fallback to streaming
          ok(res, {
            success: false,
            error: `No se pudo planificar la tarea: ${planResult.reason || 'Error desconocido'}`,
            plannerFailed: true,
            meta: {
              requestId: trace.requestId,
              taskId: task.id,
              executionMode: executionMode.mode,
              intentKind: intent.kind,
              isMultiStep: intent.isMultiStep,
              hubDecision: hubResult.decisionLog,
              executionTrace: trace.getSteps(),
              executionDurationMs: trace.getTotalDurationMs(),
              tenantId: context.tenant.id,
              adapterStatus,
              debugSnapshot,
              routerDecision: {
                provider: 'planner-failed',
                reason: planResult.reason || 'No se pudo crear plan',
                intentKind: intent.kind
              }
            }
          })
          return
        }

        // P6.16: Capability gate - block execution if required capabilities are not available
        if (planResult.blockingCapabilities && planResult.blockingCapabilities.length > 0) {
          const blockedCaps = planResult.blockingCapabilities.map(c => c.capability).join(', ')
          console.log(`[GranClaw Stream P6.16] Capability gate BLOCKED: ${blockedCaps}`)

          trace.addStep({
            stage: 'orchestrator',
            status: 'blocked',
            label: 'Capacidades bloqueadas (P6.16)',
            detail: `Capabilities not available: ${blockedCaps}`
          })

          const debugSnapshot = trace.getDebugSnapshot()
          debugSnapshot.source = 'granclaw'
          debugSnapshot.executionConfirmed = false
          logDebug(debugSnapshot)

          // P6.17R5: Build complete result with plan evidence
          const capabilityGateResult = buildCapabilityGateResult({
            blockingCapabilities: planResult.blockingCapabilities,
            plan: planResult.plan ? {
              id: planResult.plan.id,
              sourceInput: planResult.plan.sourceInput,
              steps: planResult.plan.steps.map(s => ({
                stepId: s.stepId,
                order: s.order,
                actionType: s.actionType,
                targetEntity: s.targetEntity,
                capabilityKey: s.capabilityKey,
                description: s.description
              }))
            } : undefined,
            reason: `Capacidades no disponibles: ${blockedCaps}`
          })

          // Complete task as blocked
          // P6.17R4: Use consistent schema with blockingCapabilities (not blockedCapabilities)
          completeTask(
            task.id,
            'blocked',
            capabilityGateResult,
            'validation',
            trace.getSteps(),
            debugSnapshot,
            trace.getTotalDurationMs(),
            `La tarea requiere capacidades que no están disponibles: ${blockedCaps}`
          )

          // P6.17R4: Set proper failureExplanation using blockingCapabilities data
          const capabilityFailureExplanation = buildCapabilityGateFailureExplanation({
            blockingCapabilities: planResult.blockingCapabilities,
            taskInput: input.message,
            provider: 'validation'
          })
          updateTask(task.id, { failureExplanation: capabilityFailureExplanation })

          ok(res, {
            success: false,
            capabilityGate: true,
            error: `Capacidades requeridas no disponibles: ${blockedCaps}`,
            meta: {
              requestId: trace.requestId,
              taskId: task.id,
              blockingCapabilities: planResult.blockingCapabilities,
              planId: planResult.plan?.id,
              executionMode: executionMode.mode,
              intentKind: intent.kind,
              isMultiStep: intent.isMultiStep,
              hubDecision: hubResult.decisionLog,
              executionTrace: trace.getSteps(),
              tenantId: context.tenant.id,
              adapterStatus,
              debugSnapshot,
              routerDecision: {
                provider: 'capability-gate-blocked',
                reason: `Capabilities not available: ${blockedCaps}`,
                intentKind: intent.kind
              }
            }
          })
          return
        }

        // Planner succeeded - continue with queueing
        {
          console.log(`[GranClaw Stream P6.9] Plan created: ${planResult.plan.id} with ${planResult.plan.steps.length} steps`)

          const queueResult: EnqueueResult = enqueueCompositeTask(
            {
              planId: planResult.plan.id,
              plan: planResult.plan,
              input: input.message,
              taskId: task.id,  // P6.10: Required for job-task reconciliation
              context: {
                tenantId: context.tenant.id,
                userId: context.user.id,
                sessionId: input.sessionId,
                intentKind: intent.kind,
                executionMode: executionMode.mode,
                requiresEvidence: executionMode.requiresEvidence
              }
            },
            {
              tenantId: context.tenant.id,
              userId: context.user.id,
              correlationId: trace.requestId
            },
            {
              priority: 'normal',
              tags: [intent.kind, 'multistep', 'stream', 'p6.9', 'p6.10']
            }
          )

          if (queueResult.queued && queueResult.jobId) {
            console.log(`[GranClaw Stream P6.9] Task queued: jobId=${queueResult.jobId}`)

            trace.addStep({
              stage: 'queue',
              status: 'success',
              label: 'Tarea encolada (stream)',
              detail: `JobId: ${queueResult.jobId}, Steps: ${planResult.plan.steps.length}`
            })

            const debugSnapshot = trace.getDebugSnapshot()
            debugSnapshot.source = 'queue'
            debugSnapshot.executionConfirmed = false
            logDebug(debugSnapshot)

            // P6.9R: Use 'queued' status, not ambiguous 'pending'
            completeTask(
              task.id,
              'queued',
              {
                queued: true,
                jobId: queueResult.jobId,
                planId: planResult.plan.id,
                steps: planResult.plan.steps.length,
                executionMode: executionMode.mode
              },
              'queue',
              trace.getSteps(),
              debugSnapshot,
              trace.getTotalDurationMs()
            )

            // P6.17: Emit task:queued event (stream)
            emitTaskEvent(
              context.tenant.id,
              context.user.id,
              'task:queued',
              {
                taskId: task.id,
                jobId: queueResult.jobId,
                status: 'queued',
                message: `Task queued (stream) with ${planResult.plan.steps.length} steps`,
                totalSteps: planResult.plan.steps.length
              }
            )

            ok(res, {
              success: true,
              queued: true,
              message: `Tarea multistep encolada (stream): ${planResult.plan.steps.length} pasos`,
              meta: {
                requestId: trace.requestId,
                taskId: task.id,
                jobId: queueResult.jobId,
                planId: planResult.plan.id,
                planSteps: planResult.plan.steps.length,
                executionMode: executionMode.mode,
                intentKind: intent.kind,
                isMultiStep: intent.isMultiStep,
                hubDecision: hubResult.decisionLog,
                executionTrace: trace.getSteps(),
                tenantId: context.tenant.id,
                adapterStatus,
                debugSnapshot,
                routerDecision: {
                  provider: 'queue',
                  reason: executionMode.reason,
                  intentKind: intent.kind
                }
              }
            })
            return
          } else {
            // P6.11R: Queue failed - DO NOT fall through to streaming
            // When useQueue=true, we MUST NOT use streaming simple execution
            console.log(`[GranClaw Stream P6.11R] Queue failed - returning error (no fallback to streaming)`)
            trace.addStep({
              stage: 'queue',
              status: 'error',
              label: 'Fallo al encolar (stream)',
              detail: 'No se pudo encolar la tarea multistep'
            })

            const debugSnapshot = trace.getDebugSnapshot()
            debugSnapshot.source = 'queue'
            debugSnapshot.executionConfirmed = false
            debugSnapshot.error = 'Queue failed'
            logDebug(debugSnapshot)

            completeTask(
              task.id,
              'error',
              { queueFailed: true, planId: planResult.plan.id },
              'queue',
              trace.getSteps(),
              debugSnapshot,
              trace.getTotalDurationMs(),
              'No se pudo encolar la tarea para ejecución'
            )

            // P6.11R: Return proper error response - NOT fallback to streaming
            ok(res, {
              success: false,
              error: 'No se pudo encolar la tarea multistep para ejecución',
              queueFailed: true,
              meta: {
                requestId: trace.requestId,
                taskId: task.id,
                executionMode: executionMode.mode,
                intentKind: intent.kind,
                isMultiStep: intent.isMultiStep,
                planId: planResult.plan.id,
                hubDecision: hubResult.decisionLog,
                executionTrace: trace.getSteps(),
                executionDurationMs: trace.getTotalDurationMs(),
                tenantId: context.tenant.id,
                adapterStatus,
                debugSnapshot,
                routerDecision: {
                  provider: 'queue-failed',
                  reason: 'No se pudo encolar',
                  intentKind: intent.kind
                }
              }
            })
            return
          }
        } // End of planner success block
      }

      // P6.11R: CRITICAL - Check if multistep task reached streaming fallback (should never happen)
      // If useQueue=true, we MUST NOT fall through to runStreamingTask
      if (executionMode.useQueue) {
        console.log(`[GranClaw Stream P6.11R] CRITICAL: Multistep task reached streaming fallback - blocking`)
        trace.addStep({
          stage: 'orchestrator',
          status: 'error',
          label: 'Ruta inválida para multistep (stream)',
          detail: `Tarea multistep no debería llegar aquí: provider=${routeDecision.provider}`
        })

        const debugSnapshot = trace.getDebugSnapshot()
        debugSnapshot.source = 'error'
        debugSnapshot.executionConfirmed = false
        debugSnapshot.error = 'Multistep task routing failure (stream)'
        logDebug(debugSnapshot)

        completeTask(
          task.id,
          'error',
          { routingError: true, provider: routeDecision.provider },
          'error',
          trace.getSteps(),
          debugSnapshot,
          trace.getTotalDurationMs(),
          'Tarea multistep no pudo ser enrutada correctamente'
        )

        ok(res, {
          success: false,
          error: 'No se pudo procesar la tarea multistep. Por favor, intente de nuevo.',
          routingError: true,
          meta: {
            requestId: trace.requestId,
            taskId: task.id,
            executionMode: executionMode.mode,
            intentKind: intent.kind,
            provider: routeDecision.provider,
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

        // P6.18D3: FIX - runStreamingTask does NOT send response, we must send it here
        ok(res, {
          success: result.success,
          result: result.result,
          mode: result.mode,
          error: result.error,
          meta: {
            requestId: trace.requestId,
            taskId: task.id,
            hubDecision: hubResult.decisionLog,
            executionTrace: trace.getSteps(),
            executionDurationMs: trace.getTotalDurationMs(),
            tenantId: context.tenant.id,
            source: 'openclaw',
            adapterStatus,
            debugSnapshot
          }
        })
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

      // =====================================================================
      // P6.18D5: CAPABILITY GATE CHECK BEFORE PROPOSAL (STREAMING)
      // CRITICAL: Same as normal route - check capability gate before proposal
      // =====================================================================
      const streamProposalReqCap = getRequiredCapabilityForIntent(intent, input.message)

      if (streamProposalReqCap) {
        console.log(`[P6.18D5 Stream] Pre-proposal capability gate check: ${streamProposalReqCap}`)

        const streamProposalGate = await getCapabilityGateReadiness(context.tenant.id, streamProposalReqCap)

        if (!streamProposalGate.canProceed) {
          console.log(`[P6.18D5 Stream] Capability gate BLOCKED (pre-proposal): ${streamProposalReqCap} state=${streamProposalGate.state}`)

          trace.addStep({
            stage: 'orchestrator',
            status: 'blocked',
            label: 'Capability gate (pre-proposal stream)',
            detail: `${streamProposalReqCap}: ${streamProposalGate.state} - ${streamProposalGate.message}`
          })

          const debugSnapshot = trace.getDebugSnapshot()
          debugSnapshot.source = 'capability_gate'
          debugSnapshot.executionConfirmed = false
          debugSnapshot.error = `Capability not ready: ${streamProposalReqCap}`
          logDebug(debugSnapshot)

          // Build blocking caps
          const streamPrePropBlockCaps = streamProposalGate.blockingCapabilities || [{
            capability: streamProposalReqCap,
            capabilityKey: streamProposalReqCap,
            available: false,
            configured: false,
            implemented: streamProposalGate.state !== 'unavailable',
            statusMessage: streamProposalGate.message
          }]

          const streamPrePropGateResult = buildCapabilityGateResult({
            blockingCapabilities: streamPrePropBlockCaps.map(c => ({
              capability: c.capability || streamProposalReqCap,
              capabilityKey: c.capabilityKey || streamProposalReqCap,
              available: false,
              configured: false,
              implemented: streamProposalGate.state !== 'unavailable',
              statusMessage: c.statusMessage || streamProposalGate.message
            })),
            reason: streamProposalGate.message
          })

          completeTask(
            task.id,
            'blocked',
            streamPrePropGateResult,
            'capability_gate',
            trace.getSteps(),
            debugSnapshot,
            trace.getTotalDurationMs(),
            streamProposalGate.message
          )

          // Build failure explanation for truth
          const streamPrePropFailExp = buildCapabilityGateFailureExplanation({
            blockingCapabilities: streamPrePropBlockCaps.map(c => ({
              capability: c.capability || streamProposalReqCap,
              capabilityKey: c.capabilityKey || streamProposalReqCap,
              available: false,
              configured: false,
              implemented: streamProposalGate.state !== 'unavailable',
              statusMessage: c.statusMessage || streamProposalGate.message
            })),
            taskInput: input.message,
            provider: 'capability_gate'
          })
          updateTask(task.id, { failureExplanation: streamPrePropFailExp })

          ok(res, {
            success: false,
            error: streamProposalGate.message,
            capabilityGate: true,
            blockingCapabilities: streamPrePropBlockCaps,
            meta: {
              requestId: trace.requestId,
              taskId: task.id,
              intentKind: intent.kind,
              requiredCapability: streamProposalReqCap,
              capabilityKey: streamProposalReqCap,
              capabilityState: streamProposalGate.state,
              debugSnapshot,
              routerDecision: {
                provider: 'capability_gate',
                reason: streamProposalGate.message,
                intentKind: intent.kind
              }
            }
          })
          return
        }

        console.log(`[P6.18D5 Stream] Capability gate PASSED (pre-proposal): ${streamProposalReqCap}`)
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
