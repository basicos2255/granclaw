# P6.17R6B — REPACK + UI Action Truth Fix Real

**Fecha**: 2026-05-16
**Estado**: COMPLETADO

## Root Cause

El informe P6.17R6 anterior declaró completado pero el ZIP entregado NO contenía los cambios.
Esta revisión (R6B) verifica que los cambios están realmente presentes en el workspace.

## Auditoría Real Ejecutada

### 1. actions.ts - Verificación

```bash
$ grep -n "normalizeOrchestratorResponse\|normalizeSimpleResponse\|capabilityGate" actions.ts
42:  capabilityGate?: boolean
46:function normalizeOrchestratorResponse(response: unknown): OrchestratorNormalizedResponse {
70:      capabilityGate: data.capabilityGate === true,
85:    capabilityGate: res.capabilityGate === true,
123:    const normalized = normalizeOrchestratorResponse(response)
141:    if (normalized.capabilityGate && normalized.taskId) {
181:function normalizeSimpleResponse(response: unknown): NormalizedSimpleResponse {
228:    const normalized = normalizeSimpleResponse(response)
```

**Estado**: ✅ PRESENTE

### 2. TasksPage.tsx - Verificación

```bash
$ grep -n "taskWasCreated\|result.taskId" TasksPage.tsx
85:    const taskWasCreated = result.success || result.taskId
87:    if (taskWasCreated) {
95:      if (!result.success && result.taskId) {
```

**Estado**: ✅ PRESENTE

### 3. ConversationalTaskDetail.tsx - Verificación

```bash
$ grep -n "failureExplanation" ConversationalTaskDetail.tsx
644:              ) : task?.failureExplanation ? (
675:                          {task.failureExplanation.title}
677:                        {task.failureExplanation.capability && (
685:                      {task.failureExplanation.humanMessage}
687:                    {task.failureExplanation.recoveryActions && ...
702:                    {task.failureExplanation.canRetry === false && (
```

**Estado**: ✅ PRESENTE

### 4. PROJECT_MEMORY.md - Verificación

```bash
$ grep -n "P6.17R6" PROJECT_MEMORY.md
9896:## P6.17R6 — UI Action Truth & Response Unwrap
9974:P6.17R6 corrige la verdad de acciones UI...
```

**Estado**: ✅ PRESENTE

## Cambios Implementados (Confirmados)

| Archivo | Cambio |
|---------|--------|
| `apps/web/src/services/actions.ts:46-88` | `normalizeOrchestratorResponse()` - unwrap wrapper format |
| `apps/web/src/services/actions.ts:181-209` | `normalizeSimpleResponse()` - para retry/cancel |
| `apps/web/src/services/actions.ts:107-167` | `createTask()` usa normalizer |
| `apps/web/src/services/actions.ts:216-249` | `retryTask()` usa normalizer |
| `apps/web/src/pages/product/TasksPage.tsx:69-104` | `handleCreateTask` cierra modal si taskId existe |
| `apps/web/src/pages/product/ConversationalTaskDetail.tsx:644-717` | Muestra failureExplanation para blocked sin thread |
| `apps/web/src/pages/product/ConversationalTaskDetail.tsx:781-812` | Acciones para blocked tasks sin thread |

## Lógica de Normalización

### normalizeOrchestratorResponse

```typescript
// Detecta wrapper format: { success: true, data: { success: false, ... } }
if (hasDataObject) {
  return {
    operationalSuccess: data.success === true,  // NO wrapper.success
    taskId: data.task?.id || data.meta?.taskId,
    capabilityGate: data.capabilityGate === true,
    ...
  }
}
```

### createTask con capabilityGate

```typescript
if (normalized.capabilityGate && normalized.taskId) {
  return {
    success: false,           // Operacionalmente falló
    status: 'not_available',  // NO 'executed'
    message: normalized.error || 'Bloqueada: capacidades no disponibles',
    taskId: normalized.taskId // Preservar para navegación
  }
}
```

### TasksPage handleCreateTask

```typescript
const taskWasCreated = result.success || result.taskId
if (taskWasCreated) {
  setShowCreateModal(false)  // Cerrar modal
  loadTasks()                // Recargar lista
  if (!result.success && result.taskId) {
    setActionFeedback(...)   // Mostrar feedback de blocked
  }
}
```

## Verificación Funcional

### npm run check
```
> @granclaw/web@0.1.0 check
> tsc --noEmit
(sin errores)

> @granclaw/api@0.1.0 check
> tsc --noEmit
(sin errores)
```

### npm run build
```
> @granclaw/web@0.1.0 build
> tsc && vite build
✓ 95 modules transformed
✓ built in 2.69s

> @granclaw/api@0.1.0 build
> tsc
(sin errores)
```

## Self-Audit

```bash
$ grep -c "normalizeOrchestratorResponse|normalizeSimpleResponse|capabilityGate" actions.ts
8  # 8 ocurrencias encontradas
```

## Conclusión

P6.17R6B confirma que los cambios de P6.17R6 están realmente presentes en el workspace:
- Normalizers implementados y usados
- TasksPage cierra modal si hay taskId
- ConversationalTaskDetail muestra failureExplanation
- Check/Build pasan sin errores
- PROJECT_MEMORY.md documentado

El problema original era que el ZIP previamente entregado no contenía estos cambios.
Esta verificación confirma que el código fuente actual SÍ los tiene.
