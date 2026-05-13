# P6.11 - Guard Path Audit

**Fecha:** 2026-05-12
**Autor:** Claude
**Estado:** Completado

---

## Resumen del Bug

El error "Multistep tasks must use queue/workflow system" aparece porque:
1. La lógica de fallback en `orchestrator/routes.ts` NO retorna cuando planner/queue falla
2. El código cae a `runSimpleAgentTask()` que tiene el guard de P6.9
3. El guard correctamente bloquea, pero el UX es malo

---

## Call Sites a runSimpleAgentTask

| # | Archivo | Línea | Contexto |
|---|---------|-------|----------|
| 1 | tasks/routes.ts | 201 | executeStepsSequentially - pasos individuales |
| 2 | orchestrator/routes.ts | 611 | OpenClaw provider fallback |
| 3 | orchestrator/routes.ts | 1135 | Retry path |

---

## Bug Crítico: Fallback sin Return

### Ubicación 1: Planner Failure (líneas 289-297)

```typescript
if (!planResult.plan) {
  // If planner failed, log and continue to direct execution
  console.log(`[GranClaw P6.9] Planner failed: ${planResult.reason}, falling back to direct execution`)
  trace.addStep({
    stage: 'orchestrator',
    status: 'error',
    label: 'Planner falló',
    detail: planResult.reason || 'No se pudo crear plan'
  })
  // ❌ BUG: NO HAY RETURN - cae a línea 611 donde llama runSimpleAgentTask
}
```

### Ubicación 2: Queue Failure (líneas 389-398)

```typescript
} else {
  // Queue failed, log and continue to normal flow (fallback)
  console.log(`[GranClaw P6.9] Queue failed, falling back to direct execution`)
  trace.addStep({
    stage: 'queue',
    status: 'error',
    label: 'Fallo al encolar',
    detail: 'Continuando con ejecución directa'
  })
  // ❌ BUG: NO HAY RETURN - cae a línea 611 donde llama runSimpleAgentTask
}
```

---

## Flujo del Bug

```
1. Usuario: "descarga un programa random freeware"
   ↓
2. classifyExecutionMode() → useQueue=true
   ↓
3. executionMode.useQueue && provider === 'openclaw' → true
   ↓
4. buildCompositeExecutionPlan() → planResult
   ↓
5a. SI planResult.plan === null:
    - Log "Planner failed... falling back"
    - NO RETURN ← BUG
   ↓
5b. SI enqueueCompositeTask falla:
    - Log "Queue failed, falling back"
    - NO RETURN ← BUG
   ↓
6. Código continúa a línea 403 (Provider 'openclaw')
   ↓
7. runSimpleAgentTask() llamado en línea 611
   ↓
8. Guard de P6.9 (service.ts:258) detecta useQueue=true
   ↓
9. Guard bloquea con error:
   "Multistep tasks must use queue/workflow system"
   ↓
10. UI muestra error técnico al usuario ← UX MALO
```

---

## Guard en service.ts (líneas 253-273)

```typescript
// P6.9: Guard against multistep tasks - these MUST use queue system
// This is a safety net in case routing enforcement is bypassed
const intent = classifyIntent(input.message)
const executionMode = classifyExecutionMode(intent)

if (executionMode.useQueue) {
  console.log(`[runSimpleAgentTask P6.9] GUARD TRIGGERED: Multistep task blocked`)
  console.log(`[runSimpleAgentTask P6.9] Intent: ${intent.kind}, Mode: ${executionMode.mode}`)
  return {
    success: false,
    result: {
      executionMode: executionMode.mode,
      intentKind: intent.kind,
      isMultiStep: intent.isMultiStep,
      requiresEvidence: executionMode.requiresEvidence,
      reason: executionMode.reason
    },
    source: 'guard',
    error: 'Multistep tasks must use queue/workflow system. This task requires queued execution with progress tracking.'
  }
}
```

---

## Fix Requerido

### Opción A: Return Inmediato con Estado de Error
Cuando planner o queue falla y `useQueue=true`:
- NO caer a direct execution
- Retornar respuesta con estado `planning_failed` o `queue_failed`
- Marcar task con estado `error`

### Opción B: Crear Workflow Mínimo
Cuando planner falla:
- Crear plan de 1 paso con la tarea original
- Encolar ese plan mínimo

---

## Decisión de Implementación

**Se implementará Opción A** porque:
1. Es más seguro - no intenta ejecutar algo que el planner no pudo planificar
2. Da feedback honesto al usuario
3. Permite retry después de arreglar el problema

Con adición de recovery:
- Si guard se activa, en lugar de error, intentar re-encolar

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| orchestrator/routes.ts | Agregar returns después de planner/queue failure |
| orchestrator/routes.ts | Manejar guard recovery si llega |
| orchestrator/service.ts | Opcional: guard recovery to queue |

