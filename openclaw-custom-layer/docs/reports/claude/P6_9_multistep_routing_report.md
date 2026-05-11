# P6.9 - Multistep Task Routing, Streaming Lifecycle & Queue Enforcement

**Fecha:** 2026-05-11
**Autor:** Claude
**Estado:** Implementado

---

## Resumen Ejecutivo

P6.9 corrige el **BUG CRÍTICO DE ROUTING** donde tareas multistep (descargar, instalar, buscar en web) pasaban por `runSimpleAgentTask()` REST síncrono en lugar del sistema de queue/workflow.

**Resultado:**
- Tareas multistep ahora se enrutan correctamente al sistema de queue
- Se crean planes de ejecución compuestos con pasos reales
- Se previene el bug "Pensando..." sin progreso
- Guard en `runSimpleAgentTask` como safety net

---

## Problema Original

```
User: "busca un programa freeware y descarga"
  ↓
classifyIntent() → install_download_action, isMultiStep=true
  ↓
runSimpleAgentTask()  ← BUG: No usaba queue/workflow
  ↓
UI "Pensando..." sin progress
  ↓
Resultado sin artifacts/evidence
```

---

## Solución Implementada

### FASE A: Auditoría de Routing (Completado)

Identificados los puntos críticos:
- `orchestrator/routes.ts`: Siempre usaba `runSimpleAgentTask`
- `orchestrator/service.ts`: Sin guard para multistep
- `execution-router.ts`: No indicaba `executionMode`
- `runtime-queue`: Existía pero no se usaba

### FASE B: Task Complexity Classifier (Completado)

**Archivo:** `execution-policy/types.ts`

```typescript
type TaskExecutionMode =
  | 'simple_completion'    // Pregunta rápida, respuesta texto
  | 'agent_workflow'       // Multistep con agente
  | 'queued_workflow'      // Multistep con queue/workers
  | 'requires_approval'    // Requiere confirmación usuario
  | 'unsupported'          // No soportado

interface ExecutionModeResult {
  mode: TaskExecutionMode
  reason: string
  useQueue: boolean
  streamProgress: boolean
  requiresEvidence: boolean
}
```

**Archivo:** `execution-policy/intent-classifier.ts`

Nueva función `classifyExecutionMode(intent)`:
- `install_download_action` → `queued_workflow`
- `complex_agent_task` → `queued_workflow`
- `analysis_task` → `agent_workflow`
- `simple_question` → `simple_completion`

### FASE C: Multistep Routing Enforcement (Completado)

**Archivo:** `orchestrator/routes.ts`

```typescript
// ANTES del if (routeDecision.provider === 'openclaw')
if (executionMode.useQueue && routeDecision.provider === 'openclaw') {
  // Build proper composite plan
  const planResult = buildCompositeExecutionPlan({
    input: input.message,
    tenantId: context.tenant.id,
    userId: context.user.id
  })

  if (planResult.plan) {
    const queueResult = enqueueCompositeTask({
      planId: planResult.plan.id,
      plan: planResult.plan,
      input: input.message,
      context: { ... }
    }, ...)

    if (queueResult.queued) {
      // Return queued response with jobId
      return
    }
  }
  // Fallback to direct execution if queue fails
}
```

### FASE D: runSimpleAgentTask Guard (Completado)

**Archivo:** `orchestrator/service.ts`

```typescript
export async function runSimpleAgentTask(input: RunTaskInput): Promise<RunTaskResult> {
  // ... validation ...

  // P6.9: Guard against multistep tasks
  const intent = classifyIntent(input.message)
  const executionMode = classifyExecutionMode(intent)

  if (executionMode.useQueue) {
    console.log(`[runSimpleAgentTask P6.9] GUARD TRIGGERED`)
    return {
      success: false,
      result: { ... },
      source: 'guard',
      error: 'Multistep tasks must use queue/workflow system'
    }
  }

  // ... rest of function ...
}
```

### FASE E: Queue Workflow Creation (Completado)

Integración con `composite-tasks/planner.ts`:
- `buildCompositeExecutionPlan()` crea planes con pasos reales
- Detecta cadenas de acciones (descargar → instalar → abrir)
- Reutiliza patrones existentes si los hay
- Genera plan estructurado para el queue

---

## Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `execution-policy/types.ts` | +30 líneas: TaskExecutionMode, ExecutionModeResult |
| `execution-policy/intent-classifier.ts` | +80 líneas: classifyExecutionMode, requiresQueueExecution, requiresExecutionEvidence |
| `execution-policy/index.ts` | +3 exports |
| `orchestrator/routes.ts` | +150 líneas: Queue routing enforcement (normal + stream) |
| `orchestrator/service.ts` | +20 líneas: Guard en runSimpleAgentTask |
| `orchestrator/types.ts` | +1 línea: 'guard' en TaskSource |
| `orchestrator/trace.ts` | +2 líneas: 'queue' en stage y source |

---

## Flujo Corregido

```
User: "busca un programa freeware y descarga"
  ↓
orchestrator/routes.ts
  ↓
classifyIntent() → install_download_action, isMultiStep=true
  ↓
classifyExecutionMode() → queued_workflow, useQueue=true
  ↓
buildCompositeExecutionPlan() → Plan con 3 pasos
  ↓
enqueueCompositeTask() → Job encolado
  ↓
Return { queued: true, jobId: "...", planSteps: 3 }
  ↓
Queue Worker procesa con progress tracking
  ↓
ExecutionEvidence + Artifacts
  ↓
UI con estados reales
```

---

## Verificaciones

| Check | Estado |
|-------|--------|
| npm run check (api) | PASS |
| TypeScript strict | PASS |
| Routing enforcement (normal) | IMPLEMENTED |
| Routing enforcement (stream) | IMPLEMENTED |
| Guard in runSimpleAgentTask | IMPLEMENTED |

---

## Integración con P6.8

P6.9 se complementa con P6.8 (Thread Lifecycle Sync):
- Cuando job completa, `syncThreadWithTask()` actualiza thread
- ExecutionEvidence se almacena con el task
- Thread status refleja el estado real del queue job

---

## Próximos Pasos Recomendados

### FASE F-G: Evidence Enforcement (Pendiente)
- Integrar `requiresEvidence` con completion flow
- No marcar success sin ExecutionEvidence válida

### FASE H: Artifact Requirements (Pendiente)
- Validar artifacts para download/install actions
- Enforcement de archivos descargados

### FASE I: Full Thread Sync (Pendiente)
- WebSocket events para progress updates
- Dashboard de ejecución en tiempo real

---

## Conclusión

El bug principal está corregido. Tareas multistep ahora:
1. Se clasifican correctamente por `classifyExecutionMode()`
2. Se enrutan al sistema de queue cuando `useQueue=true`
3. Tienen un guard de seguridad en `runSimpleAgentTask()`
4. Generan planes estructurados con pasos reales
5. Retornan `jobId` para seguimiento

La UI ya no mostrará "Pensando..." indefinidamente para tareas complejas.
