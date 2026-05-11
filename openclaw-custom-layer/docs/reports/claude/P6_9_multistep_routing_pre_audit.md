# P6.9 - Multistep Routing Pre-Audit Report

**Fecha:** 2026-05-11
**Autor:** Claude
**Estado:** Completado

---

## Resumen Ejecutivo

Se identificó un **BUG CRÍTICO DE ROUTING**: tareas multistep (descargar, instalar, buscar en web) pasan por `runSimpleAgentTask()` REST síncrono en lugar del sistema de queue/workflow existente.

---

## Problema Identificado

### Flujo Actual (Incorrecto)

```
User: "busca programa freeware y descarga"
  ↓
orchestrator/routes.ts
  ↓
classifyIntent() → install_download_action, isMultiStep=true, needsAgent=true
  ↓
decideExecutionRoute() → provider='openclaw'
  ↓
runSimpleAgentTask()  ← BUG: NO usa queue/workflow
  ↓
runOpenClawTask() ← REST POST síncrono
  ↓
UI "Pensando..." sin progress
  ↓
Resultado sin artifacts/evidence
```

### Lo Que Debería Pasar

```
User: "busca programa freeware y descarga"
  ↓
orchestrator/routes.ts
  ↓
classifyIntent() → install_download_action, isMultiStep=true
  ↓
classifyExecutionMode() → queued_workflow
  ↓
enqueueCompositeTask() o enqueueDagExecution()
  ↓
Queue → Worker → OpenClaw con progress
  ↓
ExecutionEvidence + Artifacts
  ↓
UI con estados reales
```

---

## Archivos Auditados

### 1. orchestrator/routes.ts

**Problema:** Líneas 462-465, 986-989

```typescript
// Siempre usa runSimpleAgentTask, ignorando intent.isMultiStep
const result = await runSimpleAgentTask(taskInput)
```

**El intent se clasifica correctamente pero se ignora para routing.**

### 2. execution-policy/intent-classifier.ts

**Estado:** CORRECTO

- `install_download_action` → `isMultiStep: true`, `needsAgent: true`
- `complex_agent_task` → `isMultiStep: true`, `needsAgent: true`
- `analysis_task` → `needsAi: true`

### 3. execution-policy/execution-router.ts

**Estado:** PARCIALMENTE CORRECTO

- Retorna `provider: 'openclaw'` para multistep
- PERO no indica `useQueue: true` o `executionMode`
- El caller (orchestrator/routes.ts) no actúa sobre `intent.isMultiStep`

### 4. runtime-queue/execution-integration.ts

**Estado:** EXISTE PERO NO SE USA

- `shouldEnqueueExecution()` - criterios para decidir queue
- `enqueueCompositeTask()` - para tareas compuestas
- `enqueueDagExecution()` - para DAG workflows
- `enqueueSimpleTask()` - para tareas simples

**Estas funciones EXISTEN pero NUNCA se llaman desde orchestrator.**

### 5. orchestrator/service.ts - runSimpleAgentTask()

**Problema:** No tiene guard contra tareas multistep

```typescript
// Acepta cualquier tarea sin validar si es multistep
export async function runSimpleAgentTask(input: RunTaskInput): Promise<RunTaskResult> {
  // Sin validación de intent/mode
}
```

---

## Resumen de Issues

| Archivo | Issue | Severidad |
|---------|-------|-----------|
| `orchestrator/routes.ts` | Siempre usa runSimpleAgentTask | CRÍTICO |
| `orchestrator/service.ts` | Sin guard para multistep | ALTO |
| `execution-router.ts` | No indica executionMode | MEDIO |
| `runtime-queue` | Existe pero no se usa | ALTO |

---

## Plan de Corrección

### FASE B: TaskExecutionMode

Crear nuevo tipo:

```typescript
type TaskExecutionMode =
  | 'simple_completion'    // Pregunta rápida, respuesta texto
  | 'agent_workflow'       // Multistep con agente
  | 'queued_workflow'      // Multistep con queue/workers
  | 'requires_approval'    // Requiere confirmación usuario
  | 'unsupported'          // No soportado
```

### FASE C: Multistep Routing Enforcement

Modificar orchestrator/routes.ts:

```typescript
const executionMode = classifyExecutionMode(intent)
if (executionMode === 'queued_workflow') {
  // Usar queue en lugar de runSimpleAgentTask
  const queueResult = enqueueCompositeTask(...)
  return { queued: true, jobId: queueResult.jobId }
}
```

### FASE D: runSimpleAgentTask Guard

```typescript
export async function runSimpleAgentTask(input: RunTaskInput): Promise<RunTaskResult> {
  const intent = classifyIntent(input.message)
  if (intent.isMultiStep) {
    return {
      success: false,
      error: 'Multistep tasks must use queue/workflow',
      status: 'must_use_workflow'
    }
  }
  // ... resto
}
```

### FASE E-G: Queue Workflow + Evidence

- Integrar con composite-tasks/executor.ts
- Generar ExecutionEvidence
- Validar artifacts para download/install

---

## Conclusión

El sistema tiene TODAS las piezas necesarias:
- Intent classification ✓
- Execution routing ✓
- Runtime queue ✓
- Composite task executor ✓
- Evidence validation ✓

**El problema es que NO están conectadas.** `orchestrator/routes.ts` ignora la clasificación y siempre usa `runSimpleAgentTask()`.
