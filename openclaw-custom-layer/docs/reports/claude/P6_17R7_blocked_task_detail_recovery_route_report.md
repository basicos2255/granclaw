# P6.17R7 — Blocked Task Detail & Recovery Route Fix

**Fecha**: 2026-05-16
**Estado**: COMPLETADO

## Root Causes

### 1. Auto-create Thread Oculta failureExplanation

**Archivo**: `apps/web/src/pages/product/ConversationalTaskDetail.tsx:154-165`

```typescript
// ANTES (problemático):
} else {
  // Create new thread if none exists
  const createResponse = await api.createThread({...})
}
```

**Problema**:
- Para CUALQUIER task sin thread, creaba thread automáticamente
- Para blocked tasks, generaba thread con status='thinking'
- La condición `!thread && task?.failureExplanation` nunca se cumplía
- Usuario veía timeline vacío en lugar del panel de bloqueo

### 2. Rutas de Recuperación Inexistentes

| Archivo | Ruta Muerta | Líneas |
|---------|-------------|--------|
| `ConversationalTaskDetail.tsx` | `/capabilities` | 817 |
| `service.ts` | `/capabilities`, `/settings/capabilities` | 128, 136, 344-431 |
| `task-reconciliation.ts` | `/settings/capabilities` | 129, 140 |

**Rutas reales en App.tsx**:
- `/control/tools` ← Existe
- `/capabilities` ← NO EXISTE
- `/settings/capabilities` ← NO EXISTE

## Cambios Implementados

### ConversationalTaskDetail.tsx

1. **Nuevo helper `shouldAutoCreateThread()`**:

```typescript
const shouldAutoCreateThread = (taskData: GranClawTask): boolean => {
  if (taskData.status === 'blocked') return false
  if (taskData.failureExplanation) return false
  if (taskData.status === 'error' && taskData.source === 'capability_gate') return false
  return true
}
```

2. **loadTaskAndThread() modificado**:

```typescript
} else {
  // P6.17R7: Only auto-create thread if task is not blocked/failed
  if (shouldAutoCreateThread(taskData)) {
    const createResponse = await api.createThread({...})
  }
  // P6.17R7: For blocked/failed tasks, leave thread=null to show failure panel
}
```

3. **Ruta corregida**:
```typescript
// ANTES: navigate('/capabilities')
// DESPUÉS: navigate('/control/tools')
```

### service.ts

Todas las referencias a rutas de capabilities corregidas:
- `navigateTo: '/settings/capabilities'` → `navigateTo: '/control/tools'`
- `navigateTo: '/capabilities'` → `navigateTo: '/control/tools'`
- `navigateTo: '/capabilities?filter=download'` → `navigateTo: '/control/tools'`
- `navigateTo: '/capabilities?filter=browser'` → `navigateTo: '/control/tools'`

### task-reconciliation.ts

```typescript
// ANTES:
navigateTo: '/settings/capabilities',

// DESPUÉS:
navigateTo: '/control/tools',
```

## UX Esperado

Para `/tasks/:id` donde `task.status='blocked'`:

| Elemento | Esperado | Antes (Bug) |
|----------|----------|-------------|
| Estado | "Bloqueada" | "thinking" |
| Panel | failureExplanation visible | Timeline vacío |
| Título | failureExplanation.title | N/A |
| Mensaje | failureExplanation.humanMessage | N/A |
| Acciones | recoveryActions con rutas reales | N/A |
| Botón config | Navega a `/control/tools` | 404 |
| Retry | No visible si canRetry=false | Potencialmente visible |

## Verificación

### Checks

```bash
$ npm run check (API)
> tsc --noEmit
✓ Sin errores

$ npm run check (Web)
> tsc --noEmit
✓ Sin errores
```

### Builds

```bash
$ npm run build (Web)
✓ 95 modules transformed
✓ built in 2.84s

$ npm run build (API)
> tsc
✓ Sin errores
```

### Verificación de Rutas

```bash
$ grep -r "settings/capabilities\|navigate('/capabilities')" apps/
# Solo comentarios, no código activo
```

### Verificación de shouldAutoCreateThread

```bash
$ grep -n "shouldAutoCreateThread" ConversationalTaskDetail.tsx
136:   * P6.17R7: Determine if we should auto-create a thread for this task
140:  const shouldAutoCreateThread = (taskData: GranClawTask): boolean => {
173:        // P6.17R7: Only auto-create thread if task is not blocked/failed
174:        if (shouldAutoCreateThread(taskData)) {
```

## Archivos Modificados

| Archivo | Líneas | Cambio |
|---------|--------|--------|
| `ConversationalTaskDetail.tsx` | 136-185 | shouldAutoCreateThread helper + lógica |
| `ConversationalTaskDetail.tsx` | 817 | Ruta `/capabilities` → `/control/tools` |
| `service.ts` | 123-139 | Rutas capabilities → control/tools |
| `service.ts` | 345-432 | Todas las navigateTo corregidas |
| `task-reconciliation.ts` | 121-143 | Rutas capabilities → control/tools |
| `PROJECT_MEMORY.md` | +P6.17R7 | Documentación |

## Limitaciones

1. La página `/control/tools` existe pero puede no tener UI específica para "habilitar" capabilities bloqueadas
2. El panel de failureExplanation se muestra solo cuando `thread=null`; si ya existe thread para task blocked, el panel coexiste con timeline

## Conclusión

P6.17R7 corrige dos bugs UX críticos:
1. Blocked tasks ahora muestran su failureExplanation en lugar de timeline vacío
2. Todas las rutas de recuperación apuntan a rutas reales existentes (`/control/tools`)

No rompe: actions.ts normalizers, TasksPage, P6.17 harness, OpenClaw core.
