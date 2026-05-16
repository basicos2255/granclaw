# P6.17 Implementation Report - Live Task Control & E2E Validation

**Fecha**: 2026-05-15
**Estado**: IMPLEMENTADO ✅

## Resumen Ejecutivo

P6.17 cierra los gaps funcionales identificados en P6.16, asegurando que:
- `/tasks/:id` es una página operativa con actualizaciones en vivo
- Los eventos de tareas se emiten y consumen correctamente
- Reconciliation se persiste a nivel superior para fácil acceso frontend
- Mock safety bloquea tareas basadas en capabilities en modo mock
- RuntimePage muestra eventos de tareas en tiempo real

## Cambios Implementados

### FASE A: Auditoría ✅
- Documentado en `docs/reports/claude/P6_17_audit_report.md`
- Identificados 7 root causes principales

### FASE B: ConversationalTaskDetail Mejorado ✅
**Archivo**: `apps/web/src/pages/product/ConversationalTaskDetail.tsx`

- Añadido polling cada 2s para tareas running/queued
- Añadida sección Execution Truth en vista técnica
- Helper functions para extraer reconciliation (top-level o nested)
- Badge de estado de tarea en header

### FASE C: Task Events Backend ✅
**Archivos modificados**:
- `apps/api/src/modules/orchestrator/routes.ts`
- `apps/api/src/modules/composite-tasks/types.ts`
- `apps/api/src/modules/composite-tasks/executor.ts`

Eventos implementados:
- `task:created` - Al crear tarea
- `task:queued` - Al encolar tarea
- `task:step-started` - Al iniciar paso
- `task:step-progress` - Durante progreso de paso
- `task:step-completed` - Al completar paso
- `task:step-failed` - Al fallar paso
- `task:step-validation` - Después de validación

### FASE D: Task Events Frontend ✅
**Archivo**: `apps/web/src/services/runtime-ws.ts`

- Añadido canal `tasks` a `WsChannel`
- Añadidos 12 tipos de eventos task:* a `RuntimeEventType`

### FASE E: Reconciliation Persistente ✅
**Archivos modificados**:
- `apps/api/src/modules/tasks/types.ts` - Añadido `TaskReconciliation` interface y campo en `GranClawTask`
- `apps/api/src/modules/runtime-queue/task-reconciliation.ts` - Guarda reconciliation a nivel superior

Campos de reconciliation:
```typescript
interface TaskReconciliation {
  phase: string
  isSuccess: boolean
  reason: string
  executionStatus?: 'completed' | 'partial' | 'failed' | 'blocked' | 'validation_failed'
  validationFailedSteps?: string[]
  validatedSteps?: string[]
  completedSteps?: string[]
  failedStep?: { stepId: string; error: string; recoverable: boolean }
  skippedSteps?: string[]
  totalDurationMs?: number
  tokenSaving?: number
}
```

### FASE F: /tasks/:id/truth Mejorado ✅
**Archivo**: `apps/api/src/modules/tasks/routes.ts`

Respuesta mejorada incluye:
- `reconciliation` - A nivel superior
- `executionEvidence` - Evidencia de ejecución
- `evidenceValidated` - Flag de validación
- `failureExplanation` - Explicación de fallos
- Artifacts y outputs detallados

### FASE G: Job Linkage ✅
Ya implementado - `lastRetryJobId` en tasks

### FASE H: Mock Safety ✅
**Archivo**: `apps/api/src/modules/orchestrator/service.ts`

- `requiresRealCapability()` - Detecta tareas que requieren capabilities reales
- `runMockTask()` - Bloquea tareas de capability en modo mock con `success: false`

Keywords bloqueados en mock:
- descargar/download, instalar/install, abrir/open
- ejecutar/run/launch, buscar en/search, navegar/navigate
- enviar/send, crear archivo/create file, etc.

### FASE I: RuntimePage Real ✅
**Archivos modificados**:
- `apps/web/src/hooks/useRuntimeWs.ts` - Añadido `useTaskEvents()` hook
- `apps/web/src/pages/product/RuntimePage.tsx` - Añadida sección Task Events Log

Características:
- Log en tiempo real de eventos de tareas
- Colores por tipo de evento (failed=rojo, completed=verde, started=azul)
- Mantiene últimos 50 eventos
- Muestra taskId, stepId, status, message

### FASE J: E2E Harness ✅
**Archivo**: `apps/api/src/modules/testing/e2e/p6-17-harness.ts`

Tests incluidos:
1. Task Creation - Verifica creación de tareas
2. Mock Safety - Capability Block - Verifica bloqueo de capabilities en mock
3. Task Truth Endpoint - Verifica endpoint /truth
4. Conversational Task Success - Verifica tareas conversacionales
5. Task List API - Verifica listado de tareas

### FASE L: Check/Build ✅
- API check: ✅
- API build: ✅
- Web check: ✅
- Web build: ✅

## Archivos Creados

1. `docs/reports/claude/P6_17_audit_report.md`
2. `apps/api/src/modules/testing/e2e/p6-17-harness.ts`
3. `apps/api/src/modules/testing/e2e/index.ts`
4. `docs/reports/claude/P6_17_implementation_report.md` (este archivo)

## Archivos Modificados

### Backend (API)
- `apps/api/src/modules/tasks/types.ts`
- `apps/api/src/modules/tasks/routes.ts`
- `apps/api/src/modules/orchestrator/routes.ts`
- `apps/api/src/modules/orchestrator/service.ts`
- `apps/api/src/modules/composite-tasks/types.ts`
- `apps/api/src/modules/composite-tasks/executor.ts`
- `apps/api/src/modules/runtime-queue/task-reconciliation.ts`

### Frontend (Web)
- `apps/web/src/services/runtime-ws.ts`
- `apps/web/src/hooks/useRuntimeWs.ts`
- `apps/web/src/pages/product/ConversationalTaskDetail.tsx`
- `apps/web/src/pages/product/RuntimePage.tsx`

## Validación Manual Requerida

Para verificación completa:
1. Abrir `/tasks/:id` y verificar polling activo para tareas running
2. Abrir `/runtime` y verificar que Task Events Log recibe eventos
3. Enviar tarea conversacional y verificar que completa con reconciliation
4. Enviar tarea de capability sin OpenClaw y verificar que falla con mock safety

## Próximos Pasos (Post-P6.17)

1. **P6.18**: Mejorar UI de Execution Truth con timeline visual
2. **P6.19**: Añadir retry actions desde UI
3. **P6.20**: Dashboard de métricas de reconciliation

---
*Implementado por Claude Code - P6.17*
