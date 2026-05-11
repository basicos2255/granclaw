# P6.9R - Real Multistep Queue Execution, Evidence Enforcement & Lifecycle Completion

**Fecha:** 2026-05-11
**Autor:** Claude
**Estado:** Implementado (fases core), Deferred (fases secundarias)

---

## Resumen Ejecutivo

P6.9R completa el trabajo de P6.9 asegurando que las tareas multistep realmente se ejecuten a través del sistema de queue sin fallar por el guard de protección.

**Problema Crítico Corregido:**
El guard en `runSimpleAgentTask()` (P6.9) bloqueaba las llamadas internas de los executors de queue/composite/DAG, causando fallo total de tareas multistep.

**Solución:**
Nueva función `executeProviderTask()` sin guard para uso interno de executors.

---

## Fases Implementadas

### FASE A: Auditoría Real del Executor

Identificados los puntos donde `runSimpleAgentTask()` se llamaba internamente:

| Archivo | Línea | Uso | Estado |
|---------|-------|-----|--------|
| `composite-tasks/executor.ts` | 117, 242 | Step execution | CORREGIDO |
| `dag-execution/executor.ts` | 151 | Node execution | CORREGIDO |
| `runtime-queue/execution-integration.ts` | 398 | Simple task handler | CORREGIDO |
| `orchestrator/routes.ts` | 610, 1134 | Fallback (OK) | No requiere cambio |
| `tasks/routes.ts` | 199 | Entry point (OK) | No requiere cambio |

### FASE B: Multistep Executor Real

Creada nueva función `executeProviderTask()` en `orchestrator/service.ts`:

```typescript
/**
 * P6.9R: Execute provider task without multistep guard
 * Use this for INTERNAL executor calls where the task has already
 * been validated at the entry point and queued appropriately.
 */
export async function executeProviderTask(input: RunTaskInput): Promise<RunTaskResult>
```

**Diferencia clave:**
- `runSimpleAgentTask()` - Para entry points, TIENE guard
- `executeProviderTask()` - Para executors internos, SIN guard

### FASE C: Step Execution Types

Los executors ahora usan `executeProviderTask`:

```typescript
// composite-tasks/executor.ts
import { executeProviderTask } from '../orchestrator/service'

async function executeOpenClawStep(step, tenantId, sessionId) {
  const result = await executeProviderTask({
    message: step.description,
    tenantId,
    sessionId
  })
}
```

### FASE D: Queue Status Explícito

Añadido status 'queued' para distinguir de 'pending':

```typescript
// tasks/types.ts
export type TaskStatus = 'pending' | 'running' | 'success' | 'blocked' | 'error' | 'unconfirmed' | 'queued'
```

Actualizado en `orchestrator/routes.ts`:
```typescript
completeTask(task.id, 'queued', ...) // Era 'pending'
```

### FASE H: Thread Lifecycle Real

Actualizado `syncThreadWithTask()` para manejar 'queued':

```typescript
// task-threads/service.ts
} else if (taskStatus === 'queued') {
  newThreadStatus = 'queued'
}
```

---

## Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `orchestrator/service.ts` | +70 líneas: executeProviderTask() |
| `composite-tasks/executor.ts` | Cambiado a executeProviderTask |
| `dag-execution/executor.ts` | Cambiado a executeProviderTask |
| `runtime-queue/execution-integration.ts` | Cambiado a executeProviderTask |
| `tasks/types.ts` | Añadido 'queued' a TaskStatus |
| `task-threads/service.ts` | Manejo de 'queued' en syncThreadWithTask |
| `orchestrator/routes.ts` | 'pending' → 'queued' para queue tasks |

---

## Flujo Corregido

### Flujo 1: Multistep Task via Queue (FUNCIONA)

```
User: "busca programa freeware y descarga"
  ↓
classifyIntent() → install_download_action
  ↓
classifyExecutionMode() → queued_workflow, useQueue=true
  ↓
buildCompositeExecutionPlan() → Plan with steps
  ↓
enqueueCompositeTask() → Job created
  ↓
compositeTaskHandler → executeCompositePlan()
  ↓
executeStep() → executeOpenClawStep()
  ↓
executeProviderTask() → NO GUARD (internal)
  ↓
Task executed successfully
```

### Flujo 2: Simple Task (FUNCIONA)

```
User: "cuál es la capital de Francia"
  ↓
classifyIntent() → simple_question
  ↓
classifyExecutionMode() → simple_completion, useQueue=false
  ↓
runSimpleAgentTask() → GUARD OK (simple task)
  ↓
Task executed successfully
```

### Flujo 3: Bypass Attempt (BLOCKED)

```
Code: runSimpleAgentTask({ message: "descarga X" })
  ↓
classifyIntent() → install_download_action
  ↓
classifyExecutionMode() → queued_workflow, useQueue=true
  ↓
GUARD TRIGGERS → BLOCKED
  ↓
Error: "Multistep tasks must use queue/workflow system"
```

---

## Verificaciones

| Check | Resultado |
|-------|-----------|
| npm run check (api) | PASS |
| npm run build (api) | PASS |
| Guard bloquea multistep en entry | OK |
| Executors internos bypasean guard | OK |
| Status 'queued' fluye correctamente | OK |
| Thread sync maneja 'queued' | OK |

---

## Fases Diferidas (P2/P3)

| Fase | Descripción | Prioridad |
|------|-------------|-----------|
| E-F | Evidence enforcement / Artifact validation | P2 |
| G | WebSocket events para progress | P2 |
| J-K | Download flow / Task memory integration | P3 |

Estas fases no son críticas para el funcionamiento del sistema pero mejorarán la experiencia de usuario y trazabilidad.

---

## Documentos Relacionados

- [P6_9_multistep_routing_report.md](P6_9_multistep_routing_report.md) - Routing inicial
- [P6_9R_executor_pre_audit.md](P6_9R_executor_pre_audit.md) - Auditoría pre-fix
- [P6_9R_multistep_execution_self_audit.md](P6_9R_multistep_execution_self_audit.md) - Self audit final

---

## Conclusión

El bug crítico donde los executors de queue fallaban por el guard ha sido corregido. Ahora:

1. Entry points (`runSimpleAgentTask`) protegen contra ejecución directa de multistep
2. Executors internos (`executeProviderTask`) pueden ejecutar steps sin bloqueo
3. Status 'queued' distingue tareas en cola de tareas pendientes
4. Thread lifecycle sincroniza correctamente con status 'queued'

El sistema de multistep queue execution es ahora funcional.
