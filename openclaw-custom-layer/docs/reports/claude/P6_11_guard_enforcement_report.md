# P6.11 - Guard-to-Queue Enforcement, Planner Fallback Fix & Multistep Recovery

**Fecha:** 2026-05-12
**Autor:** Claude
**Estado:** Implementado

---

## Resumen Ejecutivo

P6.11 corrige el bug donde tareas multistep mostraban el error técnico "Multistep tasks must use queue/workflow system" en lugar de mensajes amigables.

**Problema Corregido:**
- Cuando planner fallaba, código caía a `runSimpleAgentTask()` sin return
- Cuando queue fallaba, código caía a `runSimpleAgentTask()` sin return
- El guard de P6.9 bloqueaba correctamente, pero el mensaje de error era técnico
- UI mostraba errores confusos para el usuario

**Solución:**
- Planner failure ahora retorna inmediatamente con error amigable
- Queue failure ahora retorna inmediatamente con error amigable
- Fallback path protegido contra tareas multistep
- Guard de P6.9 ya no se activa para casos normales

---

## El Bug Original

### Flujo Problemático

```typescript
// orchestrator/routes.ts líneas 289-398 (ANTES)

if (!planResult.plan) {
  console.log(`[GranClaw P6.9] Planner failed: ${planResult.reason}, falling back to direct execution`)
  trace.addStep({...})
  // ❌ BUG: NO HAY RETURN - continúa al código de abajo
} else {
  // Queue logic...
  if (queueResult.queued && queueResult.jobId) {
    // Success path - returns
  } else {
    console.log(`[GranClaw P6.9] Queue failed, falling back to direct execution`)
    trace.addStep({...})
    // ❌ BUG: NO HAY RETURN - continúa al código de abajo
  }
}

// Línea 611+ - Este código se ejecutaba después del fallback
const result = await runSimpleAgentTask(taskInput)  // ← Guard bloqueaba aquí
```

### Error Mostrado al Usuario

```json
{
  "success": false,
  "error": "Multistep tasks must use queue/workflow system. This task requires queued execution with progress tracking.",
  "source": "guard"
}
```

---

## Solución Implementada

### Fix 1: Planner Failure (líneas 289-341)

```typescript
if (!planResult.plan) {
  // P6.11: Planner failed - DO NOT fall through to direct execution
  console.log(`[GranClaw P6.11] Planner failed: ${planResult.reason} - returning error (no fallback)`)

  completeTask(task.id, 'error', { plannerFailed: true }, 'validation', ...)

  ok(res, {
    success: false,
    error: `No se pudo planificar la tarea: ${planResult.reason}`,
    plannerFailed: true,
    meta: {...}
  })
  return  // ✅ P6.11: RETURN AGREGADO
}
```

### Fix 2: Queue Failure (líneas 436-490)

```typescript
} else {
  // P6.11: Queue failed - DO NOT fall through to direct execution
  console.log(`[GranClaw P6.11] Queue failed - returning error (no fallback)`)

  completeTask(task.id, 'error', { queueFailed: true }, 'queue', ...)

  ok(res, {
    success: false,
    error: 'No se pudo encolar la tarea multistep para ejecución',
    queueFailed: true,
    meta: {...}
  })
  return  // ✅ P6.11: RETURN AGREGADO
}
```

### Fix 3: Fallback Protection (líneas 1213-1254)

```typescript
// P6.11: CRITICAL - Check if multistep task reached fallback
if (executionMode.useQueue) {
  console.log(`[GranClaw P6.11] CRITICAL: Multistep task reached fallback - blocking`)

  completeTask(task.id, 'error', { routingError: true }, 'error', ...)

  ok(res, {
    success: false,
    error: 'No se pudo procesar la tarea multistep. Por favor, intente de nuevo.',
    routingError: true,
    meta: {...}
  })
  return  // ✅ P6.11: PROTECTION AGREGADA
}
```

---

## Flujo Corregido

```
1. Usuario: "descarga un programa random freeware"
   ↓
2. classifyExecutionMode() → useQueue=true
   ↓
3. buildCompositeExecutionPlan()
   ↓
4a. SI planner falla:
    - completeTask('error', plannerFailed)
    - RETURN con error amigable ← P6.11 FIX
   ↓
4b. SI planner OK → enqueueCompositeTask()
   ↓
5a. SI queue falla:
    - completeTask('error', queueFailed)
    - RETURN con error amigable ← P6.11 FIX
   ↓
5b. SI queue OK:
    - completeTask('queued')
    - RETURN con success ✅
```

---

## Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `orchestrator/routes.ts` | +85 líneas: P6.11 returns y protección fallback |

---

## Verificaciones

| Check | Resultado |
|-------|-----------|
| npm run check (api) | ✅ PASS |
| npm run build (api) | ✅ PASS |
| Planner failure retorna | ✅ |
| Queue failure retorna | ✅ |
| Fallback protegido | ✅ |
| Guard no alcanzado | ✅ |

---

## Documentos Relacionados

- [P6_11_guard_path_audit.md](P6_11_guard_path_audit.md) - Auditoría de paths
- [P6_11_self_audit.md](P6_11_self_audit.md) - Self audit final
- [P6_10_task_queue_reconciliation_report.md](P6_10_task_queue_reconciliation_report.md) - Base de P6.11
- [P6_9R_multistep_execution_report.md](P6_9R_multistep_execution_report.md) - Guard original

---

## Conclusión

El sistema ahora maneja correctamente los casos de error en tareas multistep:

1. **Planner failure**: Retorna error amigable inmediatamente
2. **Queue failure**: Retorna error amigable inmediatamente
3. **Fallback protection**: Previene que multistep llegue a runSimpleAgentTask
4. **Guard de P6.9**: Ya solo actúa como última línea de defensa

La UI ya no mostrará el error técnico "Multistep tasks must use queue/workflow system" para casos normales de error.
