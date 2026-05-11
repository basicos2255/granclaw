# P6.9R - Executor Pre-Audit Report

**Fecha:** 2026-05-11
**Autor:** Claude
**Estado:** CRÍTICO

---

## Resumen Ejecutivo

**BUG CRÍTICO DETECTADO:** El guard de P6.9 en `runSimpleAgentTask()` bloquea las llamadas internas de los executors de queue/composite/DAG, causando fallo total de tareas multistep.

---

## Flujo Actual (ROTO)

```
1. User: "busca programa freeware y descarga"
   ↓
2. orchestrator/routes.ts classifies as multistep
   ↓
3. enqueueCompositeTask() → Job creado
   ↓
4. compositeTaskHandler → executeCompositePlan()
   ↓
5. executeStep() → executeOpenClawStep()
   ↓
6. runSimpleAgentTask({ message: step.description })
   ↓
7. GUARD TRIGGERS! → "Multistep tasks must use queue"
   ↓
8. FALLO TOTAL ❌
```

---

## Análisis por Archivo

| Location | Behavior | Calls runSimpleAgentTask? | Multistep Safe? | Fix Required |
|----------|----------|---------------------------|-----------------|--------------|
| `composite-tasks/executor.ts:117` | Pattern step execution | ✅ YES | ❌ NO - Guard blocks | Create bypass function |
| `composite-tasks/executor.ts:242` | executeOpenClawStep() | ✅ YES | ❌ NO - Guard blocks | Create bypass function |
| `runtime-queue/execution-integration.ts:398` | simpleTaskHandler | ✅ YES | ⚠️ PARTIAL - Only for simple tasks | OK if only simple tasks |
| `dag-execution/executor.ts:151` | executeViaOpenClaw() | ✅ YES | ❌ NO - Guard blocks | Create bypass function |
| `tasks/routes.ts:199` | Direct task execution | ✅ YES | ⚠️ PARTIAL - Entry point | Guard is correct here |
| `orchestrator/routes.ts:610` | Non-queued execution | ✅ YES | ⚠️ PARTIAL - After queue check | OK - multistep already queued |
| `orchestrator/routes.ts:1134` | Fallback execution | ✅ YES | ⚠️ PARTIAL | OK - fallback case |

---

## Problema Core

### El Guard de P6.9

```typescript
// orchestrator/service.ts:256
if (executionMode.useQueue) {
  return {
    success: false,
    source: 'guard',
    error: 'Multistep tasks must use queue/workflow system.'
  }
}
```

**Este guard es CORRECTO para entry points**, pero **INCORRECTO para executors internos**.

Cuando un composite executor llama a `runSimpleAgentTask()` para ejecutar un step individual como "descargar archivo X", el guard re-clasifica el step como multistep y lo bloquea.

---

## Solución Requerida

### Opción A: Bypass Internal Flag

```typescript
export async function runSimpleAgentTask(
  input: RunTaskInput,
  options?: { _internalExecution?: boolean }
): Promise<RunTaskResult> {
  // Skip guard for internal executor calls
  if (!options?._internalExecution) {
    const intent = classifyIntent(input.message)
    const executionMode = classifyExecutionMode(intent)
    if (executionMode.useQueue) {
      return { ... guard response ... }
    }
  }
  // Continue with execution...
}
```

### Opción B: Separate Functions

```typescript
// For entry points (has guard)
export async function runSimpleAgentTask(input): Promise<RunTaskResult>

// For internal executor use (no guard)
export async function executeProviderTask(input): Promise<RunTaskResult>
```

### Opción C: Context-Aware Guard

```typescript
export async function runSimpleAgentTask(
  input: RunTaskInput & { fromQueue?: boolean }
): Promise<RunTaskResult> {
  // Skip guard if already from queue
  if (!input.fromQueue) {
    // Check intent and guard
  }
}
```

---

## Archivos a Modificar

1. **orchestrator/service.ts** - Add bypass mechanism
2. **composite-tasks/executor.ts** - Use bypass for step execution
3. **dag-execution/executor.ts** - Use bypass for node execution
4. **runtime-queue/execution-integration.ts** - Already OK for simple tasks, but composite needs fix

---

## Otros Problemas Encontrados

### 1. completeTask con 'pending'

```typescript
// orchestrator/routes.ts:345
completeTask(task.id, 'pending', ...)
```

**Problema:** Task se marca como "pending" cuando se encola, pero esto es ambiguo. ¿Es pending de queue o pending de aprobación?

**Fix:** Usar status 'queued' específico.

### 2. No ExecutionEvidence

Los executors no generan `ExecutionEvidence` para cada step. Solo retornan `result`.

### 3. No WS Events

Los executors no emiten WebSocket events durante ejecución. UI no recibe updates.

### 4. Thread No Actualizado

`executeCompositePlan()` no llama a `syncThreadWithTask()` ni actualiza thread status durante ejecución.

---

## Plan de Corrección

### FASE B: Crear executeProviderTask()

Nueva función sin guard para uso interno de executors.

### FASE C: Step Execution Types

Definir qué tipos de steps pueden usar simple execution vs required queue.

### FASE D: Queue Status vs Pending

Añadir 'queued' como TaskStatus específico.

### FASE E-F: Evidence y Artifacts

Integrar ExecutionEvidence en cada step execution.

### FASE G-H: WS Events y Thread

Emitir eventos y actualizar thread durante ejecución.

---

## Prioridad de Fix

| Priority | Issue | Impact |
|----------|-------|--------|
| **P0** | Guard blocks internal executors | Tasks fail completely |
| **P1** | No WS events | UI stuck on "Pensando..." |
| **P1** | Thread not synced | Zombie threads |
| **P2** | No evidence | Success without proof |
| **P2** | Pending ambiguous | Confusing status |
| **P3** | No artifacts | Missing downloads |

---

## Siguiente Paso

Proceder a **FASE B: Multistep Executor Real** - Crear `executeProviderTask()` sin guard para uso interno.
