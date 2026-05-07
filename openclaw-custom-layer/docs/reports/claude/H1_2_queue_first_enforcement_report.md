# H1.2 — Enforce Queue-First Runtime & Handler Initialization Report

**Fecha**: 2026-05-07
**Estado**: COMPLETADO

## 1. Objetivo Ejecutado

Hacer que queue-first sea realmente la autoridad para ejecuciones largas:
- Inicializar handlers en startup
- Queue-first por defecto en DAG y Composite
- Estado 'queued' para UI
- Runtime state con handlersReady
- Atomic persistence en file-db
- Trace/Debug con queueFirst

## 2. Cambios Realizados

### FASE A: Inicializar Handlers en Startup

**Archivo**: `apps/api/src/index.ts`

```typescript
// H1.2: Runtime Queue initialization
import { initializeRuntimeQueue, getRegisteredHandlers } from './modules/runtime-queue'

// En server.listen callback:
const queueInit = initializeRuntimeQueue({ initExecutionHandlers: true })
console.log(`[RuntimeQueue] Loaded ${queueInit.loadedJobs} jobs, ${queueInit.orphanedJobs} orphaned, ${queueInit.deadLetterCount} dead-lettered`)
console.log(`[RuntimeQueue] Registered handlers: ${getRegisteredHandlers().join(', ')}`)
```

### FASE B: Queue-First Real en DAG

**Archivo**: `apps/api/src/modules/dag-execution/routes.ts`

- Cambiado de `asyncMode` a `forceDirect` flag
- Por defecto: queue-first para DAGs no triviales
- Solo ejecución directa si `forceDirect=true`

```typescript
// H1.2: Queue-first options (queue by default for non-trivial DAGs)
forceQueue = false,
forceDirect = false

// Queue by default unless forceDirect
if (queueDecision.shouldQueue && !forceDirect) {
  // Enqueue via queue system
}
```

### FASE C: Queue-First Real en Composite

**Archivo**: `apps/api/src/modules/composite-tasks/routes.ts`

- Añadido imports de `shouldEnqueueExecution`, `enqueueDagExecution`
- Añadido `forceQueue`, `forceDirect` flags
- Queue-first para composite DAG execution

```typescript
// H1.2: Queue-first by default for composite DAG execution
if (queueDecision.shouldQueue && !forceDirect) {
  // Enqueue via queue system
  executionMode: 'queued-composite-dag'
}
```

### FASE D: Estado 'queued' para UI

**Archivo**: `apps/api/src/modules/execution-status/types.ts`

```typescript
export type ExecutionStatus =
  | 'not_started'
  | 'queued'    // H1.2: Queued for execution
  // ...

export type FinalUiStatus =
  // ...
  | 'queued'   // H1.2: Queue-first execution
```

**Archivo**: `apps/api/src/modules/execution-status/status-resolver.ts`

```typescript
// H1.2: Queue-first execution
queued: {
  title: 'EN COLA',
  defaultMessage: 'La tarea está en cola esperando ejecución.'
}

// Severity
queued: 'info'
```

### FASE E: Runtime State Consistente

**Archivo**: `apps/api/src/modules/runtime-queue/runtime-routes.ts`

```typescript
scheduler: {
  // ...
  handlersReady: boolean  // H1.2: Are execution handlers registered and ready?
}

// En response:
handlersReady: getRegisteredHandlers().includes('dag-execution') &&
               getRegisteredHandlers().includes('composite-task')
```

### FASE F: Atomic Persistence file-db

**Archivo**: `apps/api/src/storage/file-db.ts`

- Migrado de `fs.writeFileSync` directo a `atomicWriteJson`
- Usa `atomicReadJsonOrDefault` con fallback a backup

```typescript
import { atomicWriteJson, atomicReadJsonOrDefault } from '../shared/atomic-persistence'

export function write<T>(entity: string, data: T[]): void {
  const filePath = getFilePath(entity)
  const result = atomicWriteJson(filePath, data)
  // ...
}
```

### FASE G: Trace/Debug

**Archivos**: `dag-execution/routes.ts`, `composite-tasks/routes.ts`

```typescript
console.log(`[DAGRoutes] queueFirst: true, graphId=${graphId}, nodeCount=${nodeCount}, reason=${reason}`)

ok(res, {
  // ...
  queueFirst: true,  // H1.2: Trace
})
```

## 3. Auditoría de Verificación

### initializeRuntimeQueue
```
✅ Llamado en index.ts:576 con initExecutionHandlers: true
```

### executeGraph/executeCompositePlan directos
```
✅ Solo en:
- Fallbacks cuando DAG build falla
- Cuando forceDirect=true (intencional)
- Handlers de queue (ruta intendida)
```

### writeFileSync
```
✅ Solo en:
- shared/atomic-persistence.ts (dentro de función atómica)
- runtime-queue/persistence.ts (implementación atómica propia)
- storage/sandbox.ts (contenido de usuario, no estado de sistema)
```

## 4. Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| apps/api/src/index.ts | Inicialización de runtime queue |
| apps/api/src/modules/dag-execution/routes.ts | Queue-first por defecto |
| apps/api/src/modules/composite-tasks/routes.ts | Queue-first para composite DAG |
| apps/api/src/modules/execution-status/types.ts | Estado 'queued' |
| apps/api/src/modules/execution-status/status-resolver.ts | Label y severity para 'queued' |
| apps/api/src/modules/runtime-queue/runtime-routes.ts | handlersReady flag |
| apps/api/src/storage/file-db.ts | Atomic persistence |

## 5. Archivos Nuevos

| Archivo | Propósito |
|---------|-----------|
| docs/reports/claude/H1_2_queue_first_enforcement_report.md | Este reporte |

## 6. npm run check

```
✅ @granclaw/api - Sin errores
✅ @granclaw/web - Sin errores
✅ @granclaw/core - Sin errores
✅ @granclaw/openclaw-adapter - Sin errores
```

## 7. npm run build (API)

```
✅ @granclaw/api - Build exitoso
```

## 8. Queue-First ahora es Autoridad Real

| Antes | Después |
|-------|---------|
| initializeExecutionHandlers no llamado | ✅ Llamado en startup |
| DAG solo queue si asyncMode=true | ✅ Queue por defecto, direct solo si forceDirect |
| Composite llama executeGraph directo | ✅ Queue-first para composite DAG |
| No estado 'queued' en UI | ✅ Estado 'queued' con label y severity |
| file-db usa writeFileSync directo | ✅ Usa atomicWriteJson |
| /runtime/state sin handlersReady | ✅ handlersReady indica handlers registrados |
| Sin trace queueFirst | ✅ queueFirst en logs y responses |

## 9. Decisiones de Diseño

1. **forceDirect flag**: Permite bypass explícito para casos especiales
2. **handlersReady check**: Verifica que dag-execution Y composite-task estén registrados
3. **Fallback paths**: Mantenidos para resiliencia (si DAG build falla → legacy)
4. **sandbox.ts sin atomic**: Es contenido de usuario, no estado de sistema
