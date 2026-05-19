# P6.17R4 — Capability Gate Truth & Retry Blocking

**Fecha**: 2026-05-16
**Estado**: COMPLETADO

## Problema Original

El sistema tenía 4 bugs críticos en el manejo de capability gate:

| Bug | Descripción |
|-----|-------------|
| A | `/tasks/:id/truth` retornaba `failureExplanation.code="unknown"` para tareas capability-gated |
| B | `POST /tasks/:id/retry` en tareas blocked encolaba incorrectamente un nuevo job |
| C | Descargas URL directas mostraban `unknown` en vez de capability code correcto |
| D | Streaming route usaba `blockedCapabilities` en vez de `blockingCapabilities` |

## Root Causes

### 1. determineFailureCode String Matching Incompleto

**Archivo**: `apps/api/src/modules/tasks/service.ts:71-106`

El string matching de `determineFailureCode` no incluía los patrones exactos usados por el capability gate:
- "capacidades que no están disponibles" no matcheaba
- "capability not available" no matcheaba

### 2. Retry No Verificaba Capability Gate

**Archivo**: `apps/api/src/modules/tasks/routes.ts`

El handler `handleRetryTask` llamaba a `buildCompositePlan` y luego `enqueueCompositeTask` sin verificar `planResult.blockingCapabilities`.

### 3. Schema Inconsistente en Streaming

**Archivo**: `apps/api/src/modules/orchestrator/routes.ts:1819-1859`

La ruta streaming usaba:
- `blockedCapabilities` (incorrecto)
- `blocked: true` (incorrecto)

En vez de:
- `blockingCapabilities` (correcto)
- `capabilityGate: true` (correcto)

### 4. Falta de failureExplanation Update

Ambas rutas (normal y streaming) llamaban a `completeTask` con status `blocked` pero no actualizaban `failureExplanation` con los datos de `blockingCapabilities`.

---

## Solución Implementada

### FASE B: buildCapabilityGateFailureExplanation Helper

**Archivo**: `apps/api/src/modules/tasks/service.ts`

```typescript
export function buildCapabilityGateFailureExplanation(input: {
  blockingCapabilities: CapabilityReadinessSummary[]
  taskInput?: string
  provider?: string
}): TaskFailureExplanation {
  const hasNotImplemented = blockingCapabilities.some(c => c.implemented === false)
  const hasNotConfigured = blockingCapabilities.some(c => c.configured === false && c.implemented !== false)

  let code: ValidationFailureReason
  if (hasNotImplemented) {
    code = 'capability_not_implemented'
  } else if (hasNotConfigured) {
    code = 'capability_not_configured'
  } else {
    code = 'capability_not_available'
  }

  return {
    code,
    canRetry: false,  // CRITICAL: must be false for capability gate
    canRepair: code === 'capability_not_configured',
    canReplan: false
  }
}
```

### FASE C: Normal Route Update

**Archivo**: `apps/api/src/modules/orchestrator/routes.ts` (~line 376)

Después de `completeTask(task.id, 'blocked', ...)`:
```typescript
const capabilityFailureExplanation = buildCapabilityGateFailureExplanation({
  blockingCapabilities: planResult.blockingCapabilities,
  taskInput: input.message,
  provider: 'validation'
})
updateTask(task.id, { failureExplanation: capabilityFailureExplanation })
```

### FASE D: Streaming Route Fix

**Archivo**: `apps/api/src/modules/orchestrator/routes.ts` (~line 1843)

- Cambiado `blockedCapabilities` → `blockingCapabilities`
- Cambiado `blocked: true` → `capabilityGate: true`
- Añadido mismo update de `failureExplanation`

### FASE E: Retry Capability Gate Check

**Archivo**: `apps/api/src/modules/tasks/routes.ts`

```typescript
// P6.17R4: Check for capability gate BEFORE enqueueing
if (planResult.blockingCapabilities && planResult.blockingCapabilities.length > 0) {
  const failureExplanation = buildCapabilityGateFailureExplanation({...})

  updateTask(taskId, {
    status: 'blocked',
    result: { capabilityGate: true, blockingCapabilities: planResult.blockingCapabilities },
    failureExplanation
  })

  ok(res, {
    success: false,
    retryBlocked: true,
    capabilityGate: true,
    blockingCapabilities: planResult.blockingCapabilities
    // NO jobId - task not enqueued
  })
  return
}
```

### FASE F: Dead-Letter Preserve Info

**Archivo**: `apps/api/src/modules/runtime-queue/task-reconciliation.ts`

```typescript
// Don't update if task is already blocked
if (task.status === 'error' || task.status === 'blocked') {
  return
}

// Preserve capability gate info
const hasCapabilityGate = taskResult?.capabilityGate === true
if (hasCapabilityGate && blockingCapabilities?.length) {
  return  // Keep existing info
}
```

### FASE G: E2E Harness Tests

**Archivo**: `apps/api/src/modules/testing/e2e/p6-17-harness.ts`

1. `testMultistepTargetExtraction` ahora requiere:
   - `failureCode === 'capability_not_implemented'`
   - `canRetry === false`

2. Nuevo test `testBlockedTaskRetryDoesNotEnqueue`:
   - Verifica que retry en tarea blocked devuelve `retryBlocked: true`
   - Verifica que NO se genera `jobId`
   - Verifica que status sigue siendo `blocked`

### FASE H: UI Coherence

**Archivo**: `apps/web/src/pages/product/TaskDetailPage.tsx`

```tsx
{(task.status === 'error' || task.status === 'blocked') &&
 task.failureExplanation?.canRetry !== false && (
  <button onClick={handleRetry}>Reintentar</button>
)}
```

---

## Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `apps/api/src/modules/tasks/service.ts` | `buildCapabilityGateFailureExplanation` helper |
| `apps/api/src/modules/orchestrator/routes.ts` | Normal + streaming routes: failureExplanation update, schema fix |
| `apps/api/src/modules/tasks/routes.ts` | Retry capability gate check |
| `apps/api/src/modules/runtime-queue/task-reconciliation.ts` | Preserve capability info |
| `apps/api/src/modules/testing/e2e/p6-17-harness.ts` | Stricter tests + new retry test |
| `apps/web/src/pages/product/TaskDetailPage.tsx` | Retry button respects canRetry |

---

## Verificación

| Check | Estado |
|-------|--------|
| `npm run check` (API) | PASS |
| `npm run check` (Web) | PASS |
| `npm run build` (API) | PASS |

---

## Test Cases Cubiertos

1. **Caso A**: "Descargar e instalar VLC" → `code="capability_not_implemented"`, `canRetry=false`
2. **Caso B**: Retry on blocked task → `retryBlocked=true`, no `jobId`
3. **Caso C**: "descarga https://example.com/file.txt" → `code="capability_not_implemented"`
4. **Caso D**: Streaming uses `blockingCapabilities` (not `blockedCapabilities`)

---

## Schema Unificado

Todas las rutas ahora usan:
```typescript
{
  capabilityGate: true,
  blockingCapabilities: CapabilityReadinessSummary[],
  failureExplanation: {
    code: 'capability_not_implemented' | 'capability_not_configured',
    canRetry: false,
    canRepair: boolean,
    canReplan: false
  }
}
```
