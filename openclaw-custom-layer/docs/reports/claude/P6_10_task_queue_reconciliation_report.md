# P6.10 - Task Queue Reconciliation, Live Task Detail UX & Rich Interaction

**Fecha:** 2026-05-12
**Autor:** Claude
**Estado:** Implementado (core), Diferido (UX features)

---

## Resumen Ejecutivo

P6.10 corrige el bug crítico donde las tareas queued nunca se actualizaban cuando los jobs de queue terminaban o fallaban. El sistema ahora reconcilia automáticamente el estado de task/thread/job.

**Problema Corregido:**
- Jobs de queue no contenían `taskId`
- No había listeners para eventos de job completion/failure
- Tasks quedaban en "queued" indefinidamente
- Threads zombies porque no se sincronizaban

**Solución:**
- Job payloads ahora requieren `taskId`
- Reconciliation listeners actualizan tasks automáticamente
- Thread sync ocurre al reconciliar
- Endpoints manuales de reparación

---

## Fases Implementadas

### FASE A: Auditoría

Identificado el bug crítico:
- `enqueueCompositeTask` no incluía `taskId`
- No había listeners para `job:completed`/`job:failed`
- Desconexión total entre job y task original

### FASE B: Job Payload Contract

Nuevos tipos canónicos:

```typescript
interface TaskLinkedJobPayload {
  taskId: string      // Required
  threadId?: string   // Optional
  workflowId?: string // Optional
  tenantId: string
  input: string
  // ...
}

interface CompositeTaskJobPayload extends TaskLinkedJobPayload {
  planId: string
  plan: unknown
  context: {...}
}
```

### FASE C: Queue → Task Reconciliation

Nuevo módulo `task-reconciliation.ts`:

```typescript
// Listeners registrados automáticamente
queue.on('job:completed', handleJobCompleted)
queue.on('job:failed', handleJobFailed)
queue.on('job:cancelled', handleJobCancelled)

// Reconciliación
async function handleJobCompleted(event) {
  const taskId = extractTaskId(job)
  completeTask(taskId, 'success', ...)
  syncThreadWithTask(taskId, 'success')
}
```

### FASE D-E-F: Status, Thread Sync, Truth

- TaskStatus ya incluye 'queued' (de P6.9R)
- `syncThreadWithTask` ya maneja 'queued' (de P6.9R)
- Reconciliación llama ambos correctamente

### FASE M: Legacy Repair Endpoints

Nuevos endpoints:

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/tasks/:id/reconcile` | Reconcilia task con su job |
| POST | `/tasks/reconcile-all` | Reconcilia todas las tasks huérfanas |

---

## Flujo Corregido

```
1. User: "busca programa freeware y descarga"
   ↓
2. createTask() → task.id = "task-123"
   ↓
3. enqueueCompositeTask({
     taskId: "task-123",  // ← P6.10: Ahora incluido
     planId, plan, ...
   })
   ↓
4. completeTask("task-123", 'queued')
   ↓
5. Job ejecuta...
   ↓
6. queue.markCompleted(jobId)
   ↓
7. emit('job:completed')
   ↓
8. handleJobCompleted() → P6.10 Listener
   ↓
9. extractTaskId(job) → "task-123"
   ↓
10. completeTask("task-123", 'success')
    ↓
11. syncThreadWithTask("task-123", 'success')
    ↓
12. UI actualiza a "Completado" ✅
```

---

## Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `runtime-queue/types.ts` | TaskLinkedJobPayload y tipos derivados |
| `runtime-queue/execution-integration.ts` | taskId requerido en enqueueCompositeTask |
| `runtime-queue/task-reconciliation.ts` | NUEVO: Módulo completo de reconciliación |
| `runtime-queue/index.ts` | Exports y inicialización de reconciliación |
| `orchestrator/routes.ts` | taskId en payloads de enqueue |
| `tasks/routes.ts` | Endpoints de reconciliación |
| `tasks/index.ts` | Exports nuevos handlers |
| `index.ts` | Imports y registro de rutas |

---

## Fases Diferidas (P2/P3)

Las siguientes features de UX están diferidas para implementación posterior:

| Fase | Descripción | Prioridad |
|------|-------------|-----------|
| G | WS Events Formales | P2 |
| H | Live /tasks/:id | P2 |
| I | Rich Task Detail UX | P2 |
| J | Task Chat Input | P2 |
| K | Action Buttons | P2 |
| L | Honest Error UX | P2 |

---

## Verificaciones

| Check | Resultado |
|-------|-----------|
| npm run check (api) | ✅ PASS |
| npm run build (api) | ✅ PASS |
| Jobs incluyen taskId | ✅ |
| Reconciliation listeners activos | ✅ |
| Endpoints registrados | ✅ |
| Thread sync funciona | ✅ |

---

## Documentos Relacionados

- [P6_10_task_queue_reconciliation_audit.md](P6_10_task_queue_reconciliation_audit.md) - Auditoría inicial
- [P6_10_self_audit.md](P6_10_self_audit.md) - Self audit final
- [P6_9R_multistep_execution_report.md](P6_9R_multistep_execution_report.md) - Base de P6.10

---

## Conclusión

El sistema de reconciliación task-queue está ahora implementado:

1. **Jobs vinculados a tasks**: Todo job incluye `taskId` en el payload
2. **Reconciliación automática**: Listeners actualizan tasks cuando jobs terminan
3. **Thread sync**: Threads se sincronizan automáticamente
4. **Reparación manual**: Endpoints disponibles para casos edge

La UI ya no mostrará "Pensando..." indefinidamente cuando jobs de queue completen o fallen.
