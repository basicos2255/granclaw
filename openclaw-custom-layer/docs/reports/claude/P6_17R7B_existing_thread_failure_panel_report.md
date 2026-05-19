# P6.17R7B — Existing Thread Failure Panel Fix

**Fecha**: 2026-05-16
**Estado**: COMPLETADO

## Root Cause

P6.17R7 corrigió el caso donde NO existe thread para una task blocked, pero NO corrigió el caso legacy donde YA existe thread.

### Código Problemático - Timeline (línea 659)

```tsx
// ANTES:
{thread ? (
  <ThreadTimeline messages={thread.messages} ... />
) : task?.failureExplanation ? (
  <div>panel failureExplanation</div>
) : (
  <div>Sin conversacion disponible</div>
)}
```

**Bug**: Si `thread` existe → panel failureExplanation NUNCA se muestra.

### Código Problemático - Footer (línea 807)

```tsx
// ANTES:
{!thread && task?.status === 'blocked' && (
  // botones de recuperación
)}
```

**Bug**: Si `thread` existe → acciones de recuperación NUNCA se muestran.

## Contradicción del Reporte R7

El reporte `P6_17R7_blocked_task_detail_recovery_route_report.md` decía:

> "Si ya existe thread para task blocked, el panel coexiste con timeline"

Esto era **FALSO**. El código NO hacía eso.

## Cambios Implementados

### ConversationalTaskDetail.tsx

#### 1. Panel Failure - Ahora ANTES del Timeline

```tsx
// DESPUÉS:
{/* P6.17R7B: Failure panel - shown ALWAYS when task has failureExplanation */}
{task?.failureExplanation && (task.status === 'blocked' || task.source === 'capability_gate' || task.failureExplanation.canRetry === false) && (
  <div style={{ padding: '20px', borderBottom: thread ? '1px solid #e2e8f0' : 'none' }}>
    <FailurePanel ... />
  </div>
)}

{/* Timeline - DEBAJO del panel */}
{thread ? (
  <ThreadTimeline ... />
) : !task?.failureExplanation ? (
  <div>Sin conversacion disponible</div>
) : null}
```

**Cambios**:
- Panel se renderiza ANTES e INDEPENDIENTE del thread
- Si hay thread, panel tiene `borderBottom` para separar visualmente
- Timeline solo muestra "Sin conversacion" si NO hay failureExplanation

#### 2. Footer de Acciones - Ya NO depende de `!thread`

```tsx
// ANTES:
{!thread && task?.status === 'blocked' && (...)}

// DESPUÉS:
{task?.status === 'blocked' && task?.failureExplanation && (...)}
```

## Escenarios Verificados

### Escenario 1: Blocked SIN Thread

| Paso | Resultado |
|------|-----------|
| Crear task "Descargar e instalar VLC" | `task.status = 'blocked'` |
| GET `/threads/by-task/:id` | `data = null` |
| `shouldAutoCreateThread(task)` | `false` |
| Panel failureExplanation | ✅ Visible |
| Footer acciones | ✅ Visible |

### Escenario 2: Blocked CON Thread Existente

| Paso | Resultado |
|------|-----------|
| Task blocked con thread legacy | `thread !== null` |
| Panel failureExplanation | ✅ Visible (ARRIBA del timeline) |
| ThreadTimeline | ✅ Visible (DEBAJO del panel) |
| Footer acciones | ✅ Visible |

## Verificación

### Checks

```bash
$ npm run check (Web)
> tsc --noEmit
✓ Sin errores

$ npm run check (API)
> tsc --noEmit
✓ Sin errores
```

### Builds

```bash
$ npm run build (Web)
✓ 95 modules transformed
✓ built in 2.80s
```

### Self-Audit

```bash
$ grep -n "P6.17R7B" ConversationalTaskDetail.tsx
650:            {/* P6.17R7B: Failure panel - shown ALWAYS ...
740:                /* P6.17R7B: Only show "Sin conversacion" ...
810:            {/* P6.17R7B: Actions for blocked tasks ...

$ grep -n "shouldAutoCreateThread" ConversationalTaskDetail.tsx
140:  const shouldAutoCreateThread = (taskData: GranClawTask): boolean => {
174:        if (shouldAutoCreateThread(taskData)) {

$ grep -n "normalizeOrchestratorResponse" actions.ts
46:function normalizeOrchestratorResponse(response: unknown): OrchestratorNormalizedResponse {
123:    const normalized = normalizeOrchestratorResponse(response)

$ grep -n "taskWasCreated" TasksPage.tsx
85:    const taskWasCreated = result.success || result.taskId
87:    if (taskWasCreated) {
```

## Archivos Modificados

| Archivo | Líneas | Cambio |
|---------|--------|--------|
| `ConversationalTaskDetail.tsx` | 650-715 | Panel failureExplanation ahora independiente de thread |
| `ConversationalTaskDetail.tsx` | 738-745 | Timeline solo muestra empty si no hay failureExplanation |
| `ConversationalTaskDetail.tsx` | 810 | Footer acciones ya no depende de `!thread` |
| `PROJECT_MEMORY.md` | +P6.17R7B | Documentación |

## No se Modificó

- ✅ `shouldAutoCreateThread` - sigue funcionando
- ✅ `normalizeOrchestratorResponse` - intacto
- ✅ `normalizeSimpleResponse` - intacto
- ✅ `taskWasCreated` en TasksPage - intacto
- ✅ Backend - sin cambios
- ✅ OpenClaw core - sin cambios

## Conclusión

P6.17R7B completa el fix de P6.17R7. Ahora el panel de failureExplanation se muestra para blocked tasks **SIEMPRE**, independientemente de si existe un thread asociado.

El reporte P6.17R7 contenía una afirmación falsa que ha sido corregida.
