# P6.10 - Task Queue Reconciliation Audit

**Fecha:** 2026-05-12
**Autor:** Claude
**Estado:** CRÍTICO

---

## Resumen Ejecutivo

**BUG CRÍTICO DETECTADO:** Los jobs de queue NO contienen `taskId`. Cuando un job completa/falla, no hay forma de actualizar la task original. Resultado: UI queda en "Pensando..." indefinidamente.

---

## Flujo Actual (ROTO)

```
1. POST /orchestrator/run
   ↓
2. createTask() → task.id = "task-123"
   ↓
3. enqueueCompositeTask({
     planId, plan, input, context  // ← NO taskId!
   })
   ↓
4. completeTask(task.id, 'queued', ...) // Task marcada queued
   ↓
5. Job ejecuta...
   ↓
6. queue.markCompleted(jobId) → emit('job:completed')
   ↓
7. NADIE ESCUCHA → Task NO actualizada
   ↓
8. UI: "Pensando..." FOREVER
```

---

## Problema 1: Job Payload Sin taskId

**Archivo:** `orchestrator/routes.ts` líneas 301-325

```typescript
const queueResult = enqueueCompositeTask(
  {
    planId: planResult.plan.id,
    plan: planResult.plan,
    input: input.message,
    context: {
      tenantId,
      userId,
      sessionId,
      // ... NO taskId!
    }
  },
  ...
)
```

**taskId disponible:** Sí (línea 366 `taskId: task.id`)
**taskId en payload:** NO

---

## Problema 2: Sin Listener de Job Events

**Archivo:** `runtime-queue/queue.ts` líneas 165, 198

```typescript
this.emit('job:completed', jobId, ...)
this.emit('job:failed', jobId, ...)
```

**Listeners registrados:** NINGUNO

Los eventos se emiten pero nadie los escucha para reconciliar con la task.

---

## Problema 3: Thread Desincronizado

Cuando la task pasa a 'queued', el thread debería sincronizarse. Pero cuando el job completa/falla:
- Thread sigue en 'queued' o 'executing'
- NO hay llamada a `syncThreadWithTask()`
- Thread zombie

---

## Problema 4: enqueueCompositeTask No Acepta taskId

**Archivo:** `runtime-queue/execution-integration.ts` líneas 209-246

```typescript
export function enqueueCompositeTask(
  payload: {
    planId: string
    plan: unknown
    input: string
    context: unknown  // ← context no es tipado, taskId podría estar aquí
  },
  ...
)
```

El tipo no define claramente taskId.

---

## Archivos Afectados

| Archivo | Problema |
|---------|----------|
| `orchestrator/routes.ts:301` | No pasa taskId al job |
| `orchestrator/routes.ts:1541` | Ídem (stream) |
| `runtime-queue/execution-integration.ts:209` | No define taskId en payload |
| `runtime-queue/queue.ts:165` | Emite evento sin handler |
| `runtime-queue/queue.ts:198` | Emite evento sin handler |
| `composite-tasks/executor.ts` | No actualiza task al terminar |
| `dag-execution/executor.ts` | No actualiza task al terminar |

---

## Búsqueda: syncThreadWithTask

```bash
grep -r "syncThreadWithTask" apps/api/src/
```

Llamado desde:
- `tasks/service.ts` (completeTask lo llama)
- NO desde handlers de queue

---

## Búsqueda: completeTask desde handlers

Los handlers de queue (`compositeTaskHandler`, `dagExecutionHandler`, `simpleTaskHandler`) NO llaman a `completeTask()`.

Solo retornan `{ success, result }` al queue.

---

## Fix Requerido

### 1. Añadir taskId al Job Payload

```typescript
enqueueCompositeTask(
  {
    planId,
    plan,
    input,
    taskId: task.id,  // ← AÑADIR
    threadId,         // ← AÑADIR si existe
    context: { ... }
  },
  ...
)
```

### 2. Crear Reconciliation Listener

```typescript
queue.on('job:completed', async (jobId, jobType, meta) => {
  const job = queue.get(jobId)
  const taskId = job.payload.taskId
  if (taskId) {
    completeTask(taskId, 'completed', job.result, ...)
    syncThreadWithTask(taskId)
    emitWsEvent('task-completed', { taskId })
  }
})

queue.on('job:failed', async (jobId, jobType, meta) => {
  const job = queue.get(jobId)
  const taskId = job.payload.taskId
  if (taskId) {
    completeTask(taskId, 'failed', null, ...)
    syncThreadWithTask(taskId)
    emitWsEvent('task-failed', { taskId })
  }
})
```

### 3. Actualizar Handlers

Los handlers deben pasar el taskId en el resultado para que el reconciliador lo use.

---

## Verificación Adicional

### completeTask llama syncThreadWithTask?

Revisando `tasks/service.ts`:

```typescript
export function completeTask(...) {
  // ... update task
  syncThreadWithTask(id) // ← Se llama aquí
  return task
}
```

Sí, pero el problema es que `completeTask` NO se llama cuando el job termina.

---

## Conclusión

El sistema tiene un bug arquitectural: los jobs de queue son huérfanos de la task original. La reconciliación entre job y task no existe.

**Prioridad:** P0 - Sin esto, las tareas multistep nunca actualizan la UI.
