# P6.17R5 — Target Evidence & UI Retry Coherence

**Fecha**: 2026-05-16
**Estado**: COMPLETADO

## Resumen

P6.17R5 corrige el fallo crítico del harness "P6.17R3: Multistep Target Extraction" donde `targetEntity` llegaba como `undefined` en `/tasks/:id/truth`. El root cause era que el capability gate no persistía el plan evidence al guardar `task.result`.

## Problema Detectado

| Issue | Descripción |
|-------|-------------|
| Harness falla | `targetEntity=undefined` en `/tasks/:id/truth` |
| Plan evidence perdido | `completeTask()` solo guardaba `capabilityGate`, `blockingCapabilities`, `reason` |
| UI retry incorrecto | `TasksPage.tsx` mostraba "Reintentar" sin verificar `canRetry` |
| ConversationalTaskDetail | Mostraba "Reintentar" sin verificar `canRetry` |
| Summary incorrecto | "Ejecutado via validation" para tasks blocked |

## Root Causes

1. **orchestrator/routes.ts** - capability gate no guardaba `targetEntity`, `planId`, `planSummary` en `task.result`
2. **TasksPage.tsx** - condición `(task.status === 'error' || task.status === 'blocked')` sin verificar `canRetry`
3. **ConversationalTaskDetail.tsx** - condición `thread.status === 'failed'` sin verificar `canRetry`
4. **formatter.ts** - no manejaba `capabilityGate: true` para generar summary semántico

## Solución Implementada

### Nuevo Helper: buildCapabilityGateResult

**Archivo**: `apps/api/src/modules/tasks/service.ts`

```typescript
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
}): Record<string, unknown>
```

Devuelve objeto con:
- `capabilityGate: true`
- `blockingCapabilities`
- `reason`
- `planId`
- `sourceInput`
- `targetEntity` (extraído del primer step que tenga uno)
- `planSummary` con steps completos

### Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `apps/api/src/modules/tasks/service.ts` | Nuevo helper `buildCapabilityGateResult()` + tipos |
| `apps/api/src/modules/orchestrator/routes.ts` | Ruta normal y streaming usan `buildCapabilityGateResult()` |
| `apps/api/src/modules/tasks/routes.ts` | Retry handler usa `buildCapabilityGateResult()`, truth endpoint expone nuevos campos |
| `apps/api/src/modules/task-results/formatter.ts` | `extractSummary()` maneja `capabilityGate: true` |
| `apps/web/src/pages/product/TasksPage.tsx` | Retry button verifica `canRetry !== false` |
| `apps/web/src/pages/product/ConversationalTaskDetail.tsx` | Retry button verifica `canRetry !== false` |
| `apps/api/src/modules/testing/e2e/p6-17-harness.ts` | Usa `truth.targetEntity` (top-level), incluye `planSummary` en details |

### /tasks/:id/truth Response

Nuevos campos en `truth`:
```typescript
{
  // ...existing fields...
  targetEntity: string | null,
  planSummary: CapabilityGatePlanSummary | null,
  planId: string | null,
  sourceInput: string | null
}
```

### Summary Semántico

Para blocked con capabilityGate:
- Antes: "Ejecutado via validation"
- Después: "Bloqueado: capacidades no disponibles (download, install_app)"

### UI Retry Coherence

| Componente | Antes | Después |
|------------|-------|---------|
| TasksPage | Siempre mostraba Reintentar | Solo si `canRetry !== false` |
| TaskDetailPage | Ya verificaba canRetry | Sin cambios |
| ConversationalTaskDetail | Siempre mostraba Reintentar | Solo si `canRetry !== false`, mensaje "No reintentable" |

## Verificación

| Check | Resultado |
|-------|-----------|
| `npm run check` (API) | PASS |
| `npm run check` (Web) | PASS |
| `npm run build` (API) | PASS |
| `blockedCapabilities` eliminado | Solo comentario explicativo |
| `Ejecutado via validation` para blocked | Eliminado |
| canRetry verificado en UI | 3/3 componentes |

## Test Cases Esperados (Harness)

| Test | Criterio |
|------|----------|
| Multistep Target Extraction | `targetEntity='vlc'`, `capabilityGate=true`, `canRetry=false`, `failureCode='capability_not_implemented'` |
| Direct URL Download Block | `targetEntity` presente, blocked por download |
| Blocked Task Retry Does Not Enqueue | `retryBlocked=true`, no `jobId`, `canRetry=false` |

## Riesgos Pendientes

- FASE G (Verificación manual/API real) pendiente de ejecución con servidor levantado
- Harness E2E pendiente de ejecución real para confirmar 8/8 tests passing
