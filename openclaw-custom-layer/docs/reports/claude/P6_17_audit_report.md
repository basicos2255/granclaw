# P6.17 Audit Report - FASE A

**Fecha**: 2026-05-15
**Estado**: AUDITORÍA COMPLETADA

## Hallazgos Críticos

### 1. /tasks/:id usa ConversationalTaskDetail, NO TaskDetailPage

**Archivo**: `apps/web/src/App.tsx:74-75`
```typescript
const taskMatch = path.match(/^\/tasks\/([^/]+)$/)
if (taskMatch) return <ConversationalTaskDetail taskId={taskMatch[1]} />
```

**Problema**: `TaskDetailPage` existe y tiene UI P6.16 (Execution Truth section), pero NO está en la ruta activa. `ConversationalTaskDetail` se usa en su lugar.

### 2. ConversationalTaskDetail NO tiene live updates

**Archivo**: `apps/web/src/pages/product/ConversationalTaskDetail.tsx`

**Problemas**:
- NO tiene polling automático para tasks running/queued
- NO usa runtime-ws events
- NO muestra reconciliation/execution truth
- Solo carga task y thread al inicio
- NO auto-refresh cuando task está en progreso

### 3. runtime-ws.ts frontend NO incluye task:* events

**Archivo**: `apps/web/src/services/runtime-ws.ts:33-82`

**Problema**: `RuntimeEventType` solo tiene:
- workflow:*, node:*, queue:*, approval:*, notification:*, system:*, pairing:*, openclaw:*
- FALTA: task:created, task:queued, task:started, task:step-*, task:completed, task:failed, etc.

### 4. Desalineación reconciliation backend vs frontend

**Backend** (`tasks/types.ts`):
- `GranClawTask` NO tiene campo `reconciliation` top-level
- Solo tiene `executionEvidence`, `humanStatus`, `failureExplanation`

**Backend save** (`task-reconciliation.ts:195`):
```typescript
const enrichedResult = {
  ...(jobResult?.result ?? job.result ?? {}),
  _reconciliation: { ... }  // DENTRO de result, NO top-level
}
```

**Frontend** (`api.ts:520-527`):
```typescript
reconciliation?: {  // Espera TOP-LEVEL
  phase: string
  isSuccess: boolean
  ...
}
```

**Resultado**: Frontend espera `task.reconciliation`, backend guarda `task.result._reconciliation`

### 5. emitTaskStepEvent NO se usa

**Definida en**: `runtime-ws/event-bridge.ts:388`
**Usada en**: NINGÚN LUGAR

- `emitTaskEvent` se usa solo en `task-reconciliation.ts:228,328` (completed/failed)
- NO hay emisión de: task:created, task:queued, task:started, task:step-started, task:step-completed, etc.

### 6. /tasks/:id/truth schema incompleto

**Archivo**: `tasks/routes.ts:773-834`

**Problema**: El truth endpoint NO incluye:
- reconciliation
- validationFailedSteps
- executionStatus
- completedSteps
- artifacts summary detallado

### 7. Mock safety - mock success para capability-backed tasks

**Archivo**: `orchestrator/service.ts:515-534`
```typescript
function runMockTask(...): RunTaskResult {
  return {
    success: true,  // PROBLEMA: success aunque sea mock
    result: {
      response: `[MOCK] Processed: "${input.message}"`,
      note: 'OpenClaw not configured. This is a mock response.'
    },
    source: 'mock',  // Etiqueta mock, pero success=true
    ...
  }
}
```

**Impacto**: Una tarea "busca info de X en internet" puede terminar con `success: true` y `source: 'mock'` aunque no haya buscado nada.

## Resumen de Root Causes

| ID | Problema | Archivo | Línea |
|----|----------|---------|-------|
| RC1 | /tasks/:id usa componente sin live updates | App.tsx | 74-75 |
| RC2 | ConversationalTaskDetail sin polling | ConversationalTaskDetail.tsx | - |
| RC3 | runtime-ws.ts sin task:* events | runtime-ws.ts | 33-82 |
| RC4 | reconciliation en result vs top-level | task-reconciliation.ts | 195 |
| RC5 | emitTaskStepEvent no usada | executor.ts | - |
| RC6 | /truth schema incompleto | routes.ts | 773-834 |
| RC7 | Mock returns success:true | service.ts | 515-534 |

## Archivos a Modificar

### Backend
1. `apps/api/src/modules/tasks/types.ts` - Añadir reconciliation top-level
2. `apps/api/src/modules/tasks/service.ts` - Extraer reconciliation a top-level
3. `apps/api/src/modules/tasks/routes.ts` - Mejorar /truth schema
4. `apps/api/src/modules/runtime-queue/task-reconciliation.ts` - Guardar reconciliation top-level
5. `apps/api/src/modules/composite-tasks/executor.ts` - Emitir task step events
6. `apps/api/src/modules/orchestrator/routes.ts` - Emitir task:created, task:queued
7. `apps/api/src/modules/orchestrator/service.ts` - Mock safety para capability tasks

### Frontend
1. `apps/web/src/services/runtime-ws.ts` - Añadir task:* event types
2. `apps/web/src/pages/product/ConversationalTaskDetail.tsx` - Añadir polling + WS events
3. `apps/web/src/pages/product/RuntimePage.tsx` - Mostrar task events reales
4. `apps/web/src/services/api.ts` - Alinear con backend GranClawTask

---
*Auditoría completada por Claude Code - P6.17*
