/**
 * Task Service
 * FEATURE 080: Task System v1
 * P6.3: Added structured result capture
 * P6.7: Execution Evidence & Artifact Validation
 * P6.8: Thread Lifecycle Synchronization
 * Persistencia de tareas en JSON
 */

import { read, write, getById, update as dbUpdate } from '../../storage/file-db'
import type { GranClawTask, CreateTaskInput, UpdateTaskInput, TaskStatus, HumanTaskStatus, TaskFailureExplanation, ValidationFailureReason, RecoveryAction, RecoveryActionType } from './types'
import type { ExecutionEvidence, TaskActionType } from '../task-memory/types'
import type { CapabilityReadinessSummary } from '../composite-tasks/types'
import { validateExecutionEvidence } from '../task-memory/types'
import { formatTaskResult, saveTaskResult } from '../task-results'
// P6.8: Import syncThreadWithTask for lifecycle synchronization
import { syncThreadWithTask } from '../task-threads'

const ENTITY = 'tasks'

/**
 * P6.13: Build human-readable failure explanation from validation result
 */
export function buildFailureExplanation(
  missingEvidence: string[],
  warnings: string[],
  actionType?: TaskActionType,
  provider?: string,
  taskInput?: string
): TaskFailureExplanation {
  // Determine primary failure reason
  const code = determineFailureCode(missingEvidence, warnings)

  // Build human message and recovery actions
  const { title, humanMessage, technicalMessage, recoveryActions } = getFailureDetails(
    code,
    missingEvidence,
    warnings,
    actionType,
    taskInput
  )

  // Determine capabilities
  const capability = determineCapabilityFromInput(taskInput)
  const requiredArtifact = missingEvidence.find(m => m.includes('artifact'))
    ? determineRequiredArtifact(actionType, taskInput)
    : undefined
  const requiredOutput = missingEvidence.find(m => m.includes('output'))
    ? 'Resultado de ejecución'
    : undefined

  return {
    code,
    title,
    humanMessage,
    technicalMessage: technicalMessage || missingEvidence.join('; '),
    capability,
    provider,
    requiredArtifact,
    requiredOutput,
    recoveryActions,
    canRetry: code !== 'capability_not_implemented' && code !== 'unsafe_action_blocked',
    canRepair: code === 'capability_not_configured' || code === 'auth_required' || code === 'pairing_required',
    canReplan: code !== 'unsafe_action_blocked'
  }
}

/**
 * P6.17R4: Build failure explanation specifically for capability gate blocks
 * Uses actual blockingCapabilities data instead of string matching
 *
 * This is the authoritative source for capability gate failures.
 * If ANY capability has implemented=false -> code is 'capability_not_implemented'
 * If ALL are implemented but ANY configured=false -> code is 'capability_not_configured'
 */
export function buildCapabilityGateFailureExplanation(input: {
  blockingCapabilities: CapabilityReadinessSummary[]
  taskInput?: string
  provider?: string
}): TaskFailureExplanation {
  const { blockingCapabilities, taskInput, provider } = input

  // Determine code based on actual capability readiness
  const hasNotImplemented = blockingCapabilities.some(c => c.implemented === false)
  const hasNotConfigured = blockingCapabilities.some(c => c.configured === false && c.implemented !== false)

  let code: ValidationFailureReason
  let title: string
  let humanMessage: string

  if (hasNotImplemented) {
    code = 'capability_not_implemented'
    const notImplementedCaps = blockingCapabilities
      .filter(c => c.implemented === false)
      .map(c => c.capability || c.capabilityKey)
      .join(', ')
    title = 'Capacidad no implementada'
    humanMessage = `Esta tarea requiere capacidades que aún no están implementadas en GranClaw: ${notImplementedCaps}. Estas funcionalidades estarán disponibles en futuras versiones.`
  } else if (hasNotConfigured) {
    code = 'capability_not_configured'
    const notConfiguredCaps = blockingCapabilities
      .filter(c => c.configured === false)
      .map(c => c.capability || c.capabilityKey)
      .join(', ')
    title = 'Capacidad no configurada'
    humanMessage = `Esta tarea requiere capacidades que no están configuradas: ${notConfiguredCaps}. Configura estas capacidades para poder ejecutar la tarea.`
  } else {
    // Fallback - all available=false but reasons unclear
    code = 'capability_not_configured'
    const caps = blockingCapabilities.map(c => c.capability || c.capabilityKey).join(', ')
    title = 'Capacidades no disponibles'
    humanMessage = `Esta tarea requiere capacidades que no están disponibles: ${caps}.`
  }

  // Build technical message with full details
  const technicalDetails = blockingCapabilities.map(c =>
    `${c.capability || c.capabilityKey}: implemented=${c.implemented}, configured=${c.configured}, available=${c.available}${c.statusMessage ? ` (${c.statusMessage})` : ''}`
  ).join('; ')

  // Build recovery actions
  const recoveryActions: RecoveryAction[] = []

  // P6.17R7: Use real route /control/tools instead of non-existent /settings/capabilities
  if (hasNotImplemented) {
    recoveryActions.push({
      type: 'view_roadmap' as RecoveryActionType,
      label: 'Ver roadmap',
      description: 'Ver el estado de implementación de capacidades',
      navigateTo: '/control/tools',
      primary: true
    })
  } else if (hasNotConfigured) {
    recoveryActions.push({
      type: 'configure_capability' as RecoveryActionType,
      label: 'Configurar capacidades',
      description: 'Ir a configuración de capacidades',
      navigateTo: '/control/tools',
      primary: true
    })
  }

  recoveryActions.push({
    type: 'view_details' as RecoveryActionType,
    label: 'Ver detalles',
    description: 'Ver información técnica del error'
  })

  // Determine capabilities string for display
  const capabilitiesList = blockingCapabilities
    .map(c => c.capability || c.capabilityKey)
    .filter(Boolean)
    .join(', ')

  return {
    code,
    title,
    humanMessage,
    technicalMessage: `Capability gate blocked: ${technicalDetails}`,
    capability: capabilitiesList || undefined,
    provider,
    recoveryActions,
    // P6.17R4: CRITICAL - canRetry MUST be false for capability_not_implemented
    canRetry: code !== 'capability_not_implemented' && code !== 'capability_not_configured',
    canRepair: code === 'capability_not_configured',
    canReplan: false // Replanning won't help if capability is not available
  }
}

/**
 * P6.17R5: Step summary for capability gate result
 */
export interface CapabilityGateStepSummary {
  stepId: string
  order: number
  actionType: string
  targetEntity?: string
  capabilityKey?: string
  description: string
}

/**
 * P6.17R5: Plan summary for capability gate result
 */
export interface CapabilityGatePlanSummary {
  planId: string
  totalSteps: number
  steps: CapabilityGateStepSummary[]
}

/**
 * P6.17R5: Build complete result object for capability gate blocks
 * Preserves plan evidence including targetEntity and steps
 */
export function buildCapabilityGateResult(input: {
  blockingCapabilities: CapabilityReadinessSummary[]
  plan?: {
    id: string
    sourceInput: string
    steps: Array<{
      stepId: string
      order: number
      actionType: string
      targetEntity?: string
      capabilityKey?: string
      description: string
    }>
  }
  reason?: string
}): Record<string, unknown> {
  const { blockingCapabilities, plan, reason } = input

  // Extract targetEntity from first step that has one
  const targetEntity = plan?.steps.find(s => s.targetEntity)?.targetEntity

  // Build plan summary with minimal but complete data
  const planSummary: CapabilityGatePlanSummary | undefined = plan ? {
    planId: plan.id,
    totalSteps: plan.steps.length,
    steps: plan.steps.map(s => ({
      stepId: s.stepId,
      order: s.order,
      actionType: s.actionType,
      targetEntity: s.targetEntity,
      capabilityKey: s.capabilityKey,
      description: s.description
    }))
  } : undefined

  const blockedCaps = blockingCapabilities.map(c => c.capability || c.capabilityKey).join(', ')

  return {
    capabilityGate: true,
    blockingCapabilities,
    reason: reason || `Capacidades no disponibles: ${blockedCaps}`,
    // P6.17R5: Preserve plan evidence
    planId: plan?.id,
    sourceInput: plan?.sourceInput,
    targetEntity,
    planSummary
  }
}

/**
 * P6.13: Map missing evidence strings to canonical failure code
 * P6.17R3: Added patterns for capability blocked scenarios
 */
function determineFailureCode(missingEvidence: string[], warnings: string[]): ValidationFailureReason {
  const evidenceStr = missingEvidence.join(' ').toLowerCase()
  const warningStr = warnings.join(' ').toLowerCase()
  const combinedStr = `${evidenceStr} ${warningStr}`

  // P6.17R3: Check for capability not implemented patterns FIRST
  if (combinedStr.includes('not implemented') ||
      combinedStr.includes('no está implementada') ||
      combinedStr.includes('aún no está implementada') ||
      combinedStr.includes('not recognized') ||
      combinedStr.includes('no es reconocida')) {
    return 'capability_not_implemented'
  }

  // P6.17R3: Check for capability not configured patterns
  if (combinedStr.includes('not configured') ||
      combinedStr.includes('no configurada') ||
      combinedStr.includes('no está configurada') ||
      combinedStr.includes('directory not configured') ||
      combinedStr.includes('capacidad no configurada')) {
    return 'capability_not_configured'
  }

  // P6.17R3/R4: Check for capability not available / blocked patterns
  // P6.17R4: Added "capacidades que no están disponibles" and "capacidades no disponibles"
  if (combinedStr.includes('capability not available') ||
      combinedStr.includes('capacidades requeridas no disponibles') ||
      combinedStr.includes('capacidades que no están disponibles') ||
      combinedStr.includes('capacidades no disponibles') ||
      combinedStr.includes('capacidad no disponible') ||
      combinedStr.includes('capabilities not available') ||
      combinedStr.includes('capabilitygatedisabled') ||
      combinedStr.includes('capability gate') ||
      combinedStr.includes('la tarea requiere capacidades')) {
    // P6.17R4: Default to not_implemented since most capability gates are for unimplemented features
    // The proper way is to use buildCapabilityGateFailureExplanation with actual blockingCapabilities
    return 'capability_not_implemented'
  }

  // Check for specific patterns
  if (evidenceStr.includes('artifacts required') || evidenceStr.includes('artifact count is zero')) {
    return 'missing_required_artifact'
  }
  if (evidenceStr.includes('outputs required') || evidenceStr.includes('output count is zero')) {
    return 'missing_required_output'
  }
  if (evidenceStr.includes('no actions executed')) {
    return 'no_actions_executed'
  }
  if (evidenceStr.includes('executionid') || evidenceStr.includes('timestamps')) {
    return 'missing_execution_evidence'
  }
  if (evidenceStr.includes('provider')) {
    return 'provider_unavailable'
  }
  if (evidenceStr.includes('execution error')) {
    // Try to determine more specific error
    if (evidenceStr.includes('timeout')) return 'execution_timeout'
    if (evidenceStr.includes('download')) return 'download_failed'
    if (evidenceStr.includes('browser')) return 'browser_failed'
    return 'unknown'
  }
  if (evidenceStr.includes('validation failed')) {
    return 'unknown'
  }
  if (warningStr.includes('mock provider')) {
    return 'mock_provider_used'
  }

  return 'unknown'
}

/**
 * P6.13: Get human-readable failure details for a failure code
 */
function getFailureDetails(
  code: ValidationFailureReason,
  missingEvidence: string[],
  warnings: string[],
  actionType?: TaskActionType,
  taskInput?: string
): {
  title: string
  humanMessage: string
  technicalMessage?: string
  recoveryActions: RecoveryAction[]
} {
  const isDownloadRelated = taskInput?.toLowerCase().match(/descarg|download|baja/i)
  const isInstallRelated = taskInput?.toLowerCase().match(/instal|setup/i)
  const isBrowserRelated = taskInput?.toLowerCase().match(/naveg|browser|web/i)

  switch (code) {
    case 'missing_required_artifact':
      if (isDownloadRelated) {
        return {
          title: 'No se completó la descarga',
          humanMessage: 'La tarea requería descargar un archivo, pero no se generó ningún archivo descargado. Esto puede ocurrir si el navegador o la capacidad de descarga no están configurados.',
          recoveryActions: [
            { type: 'configure_capability', label: 'Configurar descarga', navigateTo: '/control/tools', primary: true },
            { type: 'retry_with_browser', label: 'Reintentar con navegador', endpoint: '/tasks/{id}/retry?mode=browser' },
            { type: 'provide_source', label: 'Proporcionar URL', description: 'Indica una URL específica para descargar' },
            { type: 'view_details', label: 'Ver detalles', navigateTo: '/tasks/{id}' }
          ]
        }
      }
      return {
        title: 'Falta archivo requerido',
        humanMessage: 'La tarea debía generar un archivo (artifact) pero no se creó ninguno. Verifica que la capacidad necesaria esté configurada.',
        recoveryActions: [
          { type: 'configure_capability', label: 'Configurar capacidad', navigateTo: '/control/tools', primary: true },
          { type: 'retry', label: 'Reintentar', endpoint: '/tasks/{id}/retry' },
          { type: 'view_details', label: 'Ver detalles', navigateTo: '/tasks/{id}' }
        ]
      }

    case 'missing_required_output':
      return {
        title: 'Sin resultado esperado',
        humanMessage: 'La tarea se ejecutó pero no produjo el resultado esperado. Es posible que el proveedor no haya devuelto datos.',
        recoveryActions: [
          { type: 'retry', label: 'Reintentar', endpoint: '/tasks/{id}/retry', primary: true },
          { type: 'retry_with_replan', label: 'Replanificar', endpoint: '/tasks/{id}/retry?mode=replan' },
          { type: 'view_details', label: 'Ver detalles', navigateTo: '/tasks/{id}' }
        ]
      }

    case 'no_actions_executed':
      return {
        title: 'No se ejecutaron acciones',
        humanMessage: 'La tarea no pudo ejecutar ninguna acción. Es posible que falte configuración o que la solicitud no se haya entendido correctamente.',
        recoveryActions: [
          { type: 'provide_input', label: 'Dar más detalles', description: 'Reformula la solicitud con más información', primary: true },
          { type: 'configure_capability', label: 'Verificar capacidades', navigateTo: '/control/tools' },
          { type: 'view_details', label: 'Ver detalles', navigateTo: '/tasks/{id}' }
        ]
      }

    case 'capability_not_configured':
      return {
        title: 'Capacidad no configurada',
        humanMessage: 'La capacidad necesaria para esta tarea no está configurada. Configúrala primero.',
        recoveryActions: [
          { type: 'configure_capability', label: 'Configurar ahora', navigateTo: '/control/tools', primary: true },
          { type: 'test_capability', label: 'Probar capacidad', endpoint: '/capabilities/{capability}/test' },
          { type: 'view_details', label: 'Ver detalles', navigateTo: '/tasks/{id}' }
        ]
      }

    case 'capability_not_implemented':
      return {
        title: 'Capacidad no disponible',
        humanMessage: 'Esta capacidad aún no está implementada en GranClaw. Estamos trabajando en ello.',
        recoveryActions: [
          { type: 'view_details', label: 'Ver detalles', navigateTo: '/tasks/{id}' },
          { type: 'cancel', label: 'Cancelar tarea', endpoint: '/tasks/{id}/cancel' }
        ]
      }

    case 'download_failed':
      return {
        title: 'Descarga fallida',
        humanMessage: 'No se pudo completar la descarga. Verifica que la URL sea accesible y que el navegador esté configurado.',
        recoveryActions: [
          { type: 'retry_with_browser', label: 'Reintentar con navegador', endpoint: '/tasks/{id}/retry?mode=browser', primary: true },
          { type: 'provide_source', label: 'Cambiar URL', description: 'Proporciona una URL alternativa' },
          { type: 'configure_capability', label: 'Configurar descarga', navigateTo: '/control/tools' }
        ]
      }

    case 'browser_failed':
      return {
        title: 'Navegador no disponible',
        humanMessage: 'No se pudo acceder al navegador automatizado. Verifica que esté configurado correctamente.',
        recoveryActions: [
          { type: 'configure_capability', label: 'Configurar navegador', navigateTo: '/control/tools', primary: true },
          { type: 'test_capability', label: 'Probar navegador', endpoint: '/capabilities/browser/test' },
          { type: 'retry', label: 'Reintentar', endpoint: '/tasks/{id}/retry' }
        ]
      }

    case 'mock_provider_used':
      return {
        title: 'Ejecutado en simulación',
        humanMessage: 'La tarea se ejecutó usando un proveedor simulado (mock). El resultado no es real. Configura un proveedor real para obtener resultados reales.',
        recoveryActions: [
          { type: 'configure_capability', label: 'Configurar proveedor real', navigateTo: '/control/tools', primary: true },
          { type: 'view_details', label: 'Ver detalles', navigateTo: '/tasks/{id}' }
        ]
      }

    case 'unsafe_action_blocked':
      return {
        title: 'Acción bloqueada por seguridad',
        humanMessage: 'Esta acción fue bloqueada por razones de seguridad. GranClaw no ejecuta acciones potencialmente peligrosas sin aprobación explícita.',
        recoveryActions: [
          { type: 'approve_action', label: 'Revisar y aprobar', navigateTo: '/tasks/{id}/approve', primary: true },
          { type: 'view_details', label: 'Ver detalles', navigateTo: '/tasks/{id}' },
          { type: 'cancel', label: 'Cancelar', endpoint: '/tasks/{id}/cancel' }
        ]
      }

    case 'execution_timeout':
      return {
        title: 'Tiempo de ejecución agotado',
        humanMessage: 'La tarea tardó demasiado en completarse y fue cancelada. Intenta con una solicitud más simple o divide la tarea.',
        recoveryActions: [
          { type: 'retry', label: 'Reintentar', endpoint: '/tasks/{id}/retry', primary: true },
          { type: 'view_details', label: 'Ver detalles', navigateTo: '/tasks/{id}' }
        ]
      }

    default:
      return {
        title: 'Error de validación',
        humanMessage: 'La tarea no pudo completarse correctamente. Revisa los detalles para más información.',
        technicalMessage: missingEvidence.length > 0 ? missingEvidence.join('; ') : warnings.join('; '),
        recoveryActions: [
          { type: 'retry', label: 'Reintentar', endpoint: '/tasks/{id}/retry', primary: true },
          { type: 'view_details', label: 'Ver detalles', navigateTo: '/tasks/{id}' }
        ]
      }
  }
}

/**
 * P6.13: Determine capability from task input
 */
function determineCapabilityFromInput(taskInput?: string): string | undefined {
  if (!taskInput) return undefined
  const input = taskInput.toLowerCase()

  if (input.match(/descarg|download|baja/i)) return 'download'
  if (input.match(/instal|setup/i)) return 'install'
  if (input.match(/naveg|browser|web.*abr/i)) return 'browser'
  if (input.match(/busca|search|encuentra/i)) return 'search'
  if (input.match(/email|correo|mail/i)) return 'email'
  if (input.match(/whatsapp/i)) return 'whatsapp'
  if (input.match(/ftp/i)) return 'ftp'
  if (input.match(/calendar|agenda|cita/i)) return 'calendar'

  return undefined
}

/**
 * P6.13: Determine what artifact was required
 */
function determineRequiredArtifact(actionType?: TaskActionType, taskInput?: string): string {
  if (actionType === 'download_file') return 'Archivo descargado'
  if (actionType === 'navigate_url') return 'Captura de página web'
  if (actionType === 'create_file') return 'Archivo creado'

  if (taskInput) {
    const input = taskInput.toLowerCase()
    if (input.match(/descarg|download/i)) return 'Archivo descargado'
    if (input.match(/captur|screenshot/i)) return 'Captura de pantalla'
    if (input.match(/crear.*archivo|create.*file/i)) return 'Archivo creado'
  }

  return 'Archivo o resultado'
}

/**
 * Genera ID único para tarea
 */
function generateTaskId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `task-${timestamp}-${random}`
}

/**
 * Lista todas las tareas (opcionalmente filtrado por tenant)
 */
export function listTasks(tenantId?: string): GranClawTask[] {
  const tasks = read<GranClawTask>(ENTITY)
  if (tenantId) {
    return tasks.filter(t => t.tenantId === tenantId).sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }
  return tasks.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

/**
 * Obtiene una tarea por ID
 */
export function getTask(id: string): GranClawTask | null {
  return getById<GranClawTask>(ENTITY, id)
}

/**
 * Crea una nueva tarea
 */
export function createTask(input: CreateTaskInput): GranClawTask {
  const now = new Date().toISOString()
  const task: GranClawTask = {
    id: generateTaskId(),
    status: 'running',
    tenantId: input.tenantId,
    userId: input.userId,
    requestId: input.requestId,
    input: input.input,
    createdAt: now,
    updatedAt: now
  }

  const tasks = read<GranClawTask>(ENTITY)
  tasks.push(task)
  write(ENTITY, tasks)

  return task
}

/**
 * Actualiza una tarea existente
 */
export function updateTask(id: string, updates: UpdateTaskInput): GranClawTask | null {
  const task = getById<GranClawTask>(ENTITY, id)
  if (!task) {
    return null
  }

  const updated: GranClawTask = {
    ...task,
    ...updates,
    updatedAt: new Date().toISOString()
  }

  return dbUpdate<GranClawTask>(ENTITY, id, updated)
}

/**
 * Actualiza el estado de una tarea
 */
export function setTaskStatus(id: string, status: TaskStatus): GranClawTask | null {
  return updateTask(id, { status })
}

/**
 * Completa una tarea con resultado
 * P6.3: Also generates and saves structured TaskResult
 * P6.8: Syncs thread status with task status
 * P6.13: Builds failure explanation for error cases
 */
export function completeTask(
  id: string,
  status: TaskStatus,
  result?: unknown,
  source?: string,
  executionTrace?: GranClawTask['executionTrace'],
  debugSnapshot?: GranClawTask['debugSnapshot'],
  executionDurationMs?: number,
  reason?: string,
  error?: string
): GranClawTask | null {
  // P6.3: Generate structured result
  const taskResult = formatTaskResult({
    taskId: id,
    status,
    rawResult: result,
    provider: source,
    durationMs: executionDurationMs,
    error
  })

  // Save structured result
  saveTaskResult(taskResult)

  // P6.13: Build failure explanation for error/blocked status
  let failureExplanation: TaskFailureExplanation | undefined
  if (status === 'error' || status === 'blocked') {
    const existingTask = getTask(id)
    // Determine failure reason from source and error
    const missingEvidence: string[] = []
    if (error) missingEvidence.push(`execution error: ${error}`)
    if (source === 'validation' || source === 'planner-failed') {
      missingEvidence.push('planner or validation failed')
    }
    if (reason) missingEvidence.push(reason)

    failureExplanation = buildFailureExplanation(
      missingEvidence,
      [],
      undefined,
      source,
      existingTask?.input
    )
  }

  // Update task with structured fields
  const updatedTask = updateTask(id, {
    status,
    result,
    source,
    executionTrace,
    debugSnapshot,
    executionDurationMs,
    reason,
    error,
    // P6.3: Include structured result fields in task
    summary: taskResult.summary,
    outputs: taskResult.outputs,
    artifacts: taskResult.artifacts,
    provider: taskResult.provider,
    // P6.13: Include failure explanation
    failureExplanation
  })

  // P6.8: Sync thread status with task status
  if (updatedTask) {
    syncThreadWithTask(id, status, error)
    console.log(`[TaskService] P6.8: Synced thread for task ${id} with status ${status}`)
  }

  return updatedTask
}

/**
 * Obtiene las últimas N tareas de un tenant
 */
export function getRecentTasks(tenantId: string, limit: number = 50): GranClawTask[] {
  const tasks = listTasks(tenantId)
  return tasks.slice(0, limit)
}

// ============================================================================
// P6.7: EXECUTION EVIDENCE FUNCTIONS
// ============================================================================

/**
 * P6.7: Input for completing a task with evidence
 */
export interface CompleteTaskWithEvidenceInput {
  taskId: string
  actionType: TaskActionType
  evidence: ExecutionEvidence
  result?: unknown
  source?: string
  executionTrace?: GranClawTask['executionTrace']
  debugSnapshot?: GranClawTask['debugSnapshot']
  reason?: string
  usedPattern?: boolean
  patternId?: string
}

/**
 * P6.7: Result of completing task with evidence
 */
export interface CompleteTaskWithEvidenceResult {
  success: boolean
  task?: GranClawTask
  status: TaskStatus
  humanStatus: HumanTaskStatus
  evidenceValid: boolean
  missingEvidence: string[]
  warnings: string[]
  error?: string
}

/**
 * P6.7: Complete a task WITH execution evidence validation
 *
 * This function enforces the execution guarantee rule:
 * - A task can ONLY be marked 'success' if evidence is valid
 * - Missing artifacts/outputs = appropriate failure state
 * - Pattern reuse is tracked but doesn't bypass evidence check
 */
export function completeTaskWithEvidence(
  input: CompleteTaskWithEvidenceInput
): CompleteTaskWithEvidenceResult {
  const {
    taskId,
    actionType,
    evidence,
    result,
    source,
    executionTrace,
    debugSnapshot,
    reason,
    usedPattern,
    patternId
  } = input

  // Validate evidence
  const validation = validateExecutionEvidence({
    evidence,
    actionType
  })

  // Determine status based on evidence
  let status: TaskStatus
  let humanStatus: HumanTaskStatus

  if (validation.canMarkSuccess) {
    status = 'success'
    humanStatus = 'completed'
  } else if (validation.suggestedState === 'needs_artifacts') {
    status = 'blocked'  // Waiting for artifacts
    humanStatus = 'needs_artifacts'
  } else if (validation.suggestedState === 'needs_outputs') {
    status = 'blocked'  // Waiting for outputs
    humanStatus = 'needs_outputs'
  } else {
    status = 'error'
    humanStatus = 'failed'
  }

  // P6.13: Build failure explanation if validation failed
  const existingTask = getTask(taskId)
  const failureExplanation = !validation.canMarkSuccess
    ? buildFailureExplanation(
        validation.missingEvidence,
        validation.warnings,
        actionType,
        source,
        existingTask?.input
      )
    : undefined

  // Generate structured result
  const taskResult = formatTaskResult({
    taskId,
    status,
    rawResult: result,
    provider: source,
    durationMs: evidence.durationMs,
    error: evidence.error
  })

  // Save structured result
  saveTaskResult(taskResult)

  // Update task with evidence
  const updatedTask = updateTask(taskId, {
    status,
    result,
    source,
    executionTrace,
    debugSnapshot,
    executionDurationMs: evidence.durationMs,
    reason: validation.canMarkSuccess ? reason : validation.missingEvidence.join(', '),
    error: evidence.error,
    // P6.3 fields
    summary: taskResult.summary,
    outputs: taskResult.outputs,
    artifacts: taskResult.artifacts,
    provider: taskResult.provider,
    // P6.7 fields
    humanStatus,
    executionEvidence: evidence,
    usedPattern,
    patternId,
    evidenceValidated: true,
    // P6.13: Include failure explanation
    failureExplanation
  })

  if (!updatedTask) {
    return {
      success: false,
      status: 'error',
      humanStatus: 'failed',
      evidenceValid: false,
      missingEvidence: ['Task not found'],
      warnings: [],
      error: `Task ${taskId} not found`
    }
  }

  console.log(`[TaskService] P6.7: Task ${taskId} completed with evidence. Status=${status}, HumanStatus=${humanStatus}, EvidenceValid=${validation.valid}`)

  if (!validation.valid) {
    console.log(`[TaskService] P6.7: Missing evidence: ${validation.missingEvidence.join(', ')}`)
  }

  // P6.8: Sync thread status with task status
  syncThreadWithTask(taskId, status, evidence.error)
  console.log(`[TaskService] P6.8: Synced thread for task ${taskId} with status ${status}`)

  return {
    success: validation.canMarkSuccess,
    task: updatedTask,
    status,
    humanStatus,
    evidenceValid: validation.valid,
    missingEvidence: validation.missingEvidence,
    warnings: validation.warnings
  }
}

/**
 * P6.7: Set task to a semantic state
 * P6.8: Syncs thread status with task status
 */
export function setTaskHumanStatus(
  taskId: string,
  humanStatus: HumanTaskStatus,
  reason?: string
): GranClawTask | null {
  // Map humanStatus to technical status
  let status: TaskStatus
  switch (humanStatus) {
    case 'completed':
      status = 'success'
      break
    case 'failed':
    case 'needs_artifacts':
    case 'needs_outputs':
      status = 'error'
      break
    case 'cancelled':
    case 'paused':
      status = 'blocked'
      break
    case 'waiting_approval':
    case 'waiting_input':
      status = 'unconfirmed'
      break
    default:
      status = 'running'
  }

  const updatedTask = updateTask(taskId, {
    status,
    humanStatus,
    reason
  })

  // P6.8: Sync thread status with task status
  if (updatedTask) {
    syncThreadWithTask(taskId, status)
  }

  return updatedTask
}

/**
 * P6.7: Create execution evidence from execution context
 */
export function createExecutionEvidence(params: {
  provider: ExecutionEvidence['provider']
  startedAt: string
  workerId?: string
  actionsExecuted?: number
  outputs?: unknown[]
  artifacts?: unknown[]
  error?: string
  externalRef?: string
}): ExecutionEvidence {
  const now = new Date().toISOString()
  const startTime = new Date(params.startedAt).getTime()
  const endTime = Date.now()

  return {
    executionId: `exec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    provider: params.provider,
    workerId: params.workerId,
    startedAt: params.startedAt,
    completedAt: now,
    actionsExecuted: params.actionsExecuted ?? 0,
    outputsGenerated: (params.outputs?.length ?? 0) > 0,
    outputCount: params.outputs?.length ?? 0,
    artifactsGenerated: (params.artifacts?.length ?? 0) > 0,
    artifactCount: params.artifacts?.length ?? 0,
    durationMs: endTime - startTime,
    externalRef: params.externalRef,
    error: params.error,
    validationStatus: 'pending'
  }
}
