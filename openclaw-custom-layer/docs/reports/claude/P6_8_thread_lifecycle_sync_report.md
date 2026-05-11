# P6.8 - Thread Lifecycle Synchronization, Execution Truth & Zombie Cleanup

**Fecha:** 2026-05-10
**Autor:** Claude
**Estado:** Completado

---

## Resumen Ejecutivo

P6.8 corrige problemas operativos donde:
- Tasks completaban pero UI mostraba "Pensando..." indefinidamente
- Se detectaban 2+ threads por task (duplicados)
- Threads zombie que nunca se cerraban
- Lifecycles de Task y Thread estaban desconectados

**Solución implementada:**
- Single thread per task guarantee (`getOrCreateThreadForTask`)
- Thread sync automático cuando task completa (`syncThreadWithTask`)
- Detección y reparación de zombies y duplicados
- Execution Truth model para verificar consistencia

---

## Problema Original

### Síntomas Observados

```
UI muestra: "Pensando..." (thread.status = 'thinking')
Backend muestra: task.status = 'success'
TUI detecta: 2 threads para el mismo taskId
```

### Causa Raíz

1. **createThread() no verificaba unicidad** - Creaba thread nuevo cada vez sin verificar si ya existía
2. **completeTask() no sincronizaba thread** - Task se marcaba success pero thread quedaba en 'thinking'
3. **Frontend race condition** - Si getThreadByTask retornaba null, creaba otro thread

---

## Arquitectura P6.8

### Nuevas Funciones en task-threads/service.ts

| Función | Propósito |
|---------|-----------|
| `getOrCreateThreadForTask()` | Garantía de single thread per task |
| `getThreadsByTaskId()` | Obtiene TODOS los threads (para detección duplicados) |
| `syncThreadWithTask()` | Sincroniza thread status con task status |
| `isTerminalTaskStatus()` | Verifica si task está en estado terminal |
| `isTerminalThreadStatus()` | Verifica si thread está en estado terminal |
| `detectZombieThreads()` | Encuentra threads zombie |
| `repairZombieThreads()` | Repara threads zombie |
| `detectDuplicateThreads()` | Encuentra threads duplicados |
| `repairDuplicateThreads()` | Repara threads duplicados |
| `mergeDuplicateThreadsForTask()` | Combina mensajes de threads duplicados |
| `getExecutionTruth()` | Combina task + thread state para verificar consistencia |

### Nuevos Endpoints API

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/tasks/:taskId/truth` | Execution truth (task + thread combinado) |
| GET | `/threads/by-task/:taskId/all` | Todos los threads de un task |
| GET | `/threads/zombies` | Detectar threads zombie |
| GET | `/threads/duplicates` | Detectar threads duplicados |
| POST | `/threads/repair-zombies` | Reparar zombies |
| POST | `/threads/repair-duplicates` | Reparar duplicados |
| POST | `/threads/by-task/:taskId/sync` | Forzar sincronización |

---

## Flujo Corregido

### Antes (Bug)

```
Task completes → task.status = 'success'
                 thread.status = 'thinking' (NEVER updated)
                 UI shows "Pensando..." forever
```

### Después (Fix)

```
Task completes → task.status = 'success'
              → syncThreadWithTask(taskId, 'success')
              → thread.status = 'completed'
              → UI shows "Completada"
```

---

## Cambios en Archivos

### Backend (apps/api/src)

| Archivo | Cambios |
|---------|---------|
| `modules/task-threads/service.ts` | +200 líneas: todas las funciones P6.8 |
| `modules/task-threads/handlers.ts` | +100 líneas: handlers P6.8 |
| `modules/task-threads/index.ts` | Exports nuevas funciones y handlers |
| `modules/task-threads/types.ts` | HumanTaskState extendido con estados P6.7 |
| `modules/tasks/service.ts` | completeTask/WithEvidence ahora llaman syncThreadWithTask |
| `index.ts` | Registro de rutas P6.8 |

### Frontend (apps/web/src)

| Archivo | Cambios |
|---------|---------|
| `services/api.ts` | +60 líneas: APIs P6.8, tipos ExecutionTruth, ZombieThreadInfo, etc. |

---

## Tipos P6.8

### ExecutionTruth

```typescript
interface ExecutionTruth {
  taskId: string
  taskExists: boolean
  taskStatus: string | null
  threadExists: boolean
  threadId: string | null
  threadStatus: HumanTaskState | null
  threadCount: number
  isConsistent: boolean  // ¿Task y Thread están sincronizados?
  truthStatus: 'completed' | 'failed' | 'in_progress' | 'unknown'
  issues: string[]  // Problemas detectados
}
```

### ZombieThreadInfo

```typescript
interface ZombieThreadInfo {
  threadId: string
  taskId: string
  threadStatus: HumanTaskState
  taskStatus: string | null
  reason: 'orphan_no_task' | 'task_terminal_thread_active'
}
```

---

## Verificaciones

| Check | Estado |
|-------|--------|
| npm run check (api) | PASS |
| npm run check (web) | PASS |
| TypeScript strict | PASS |

---

## Principio Fundamental

> **Thread y Task DEBEN estar sincronizados.**
>
> Cuando un Task llega a estado terminal (success, error, cancelled, blocked),
> el Thread asociado DEBE actualizarse a su estado correspondiente.
>
> - Task success → Thread completed
> - Task error → Thread failed
> - Task cancelled → Thread cancelled
>
> Esta sincronización ahora ocurre AUTOMÁTICAMENTE en:
> - `completeTask()`
> - `completeTaskWithEvidence()`
> - `setTaskHumanStatus()`

---

## Uso de Reparación

### Detectar Problemas

```bash
# Ver zombies
GET /threads/zombies

# Ver duplicados
GET /threads/duplicates

# Ver estado combinado de un task
GET /tasks/{taskId}/truth
```

### Reparar Problemas

```bash
# Reparar todos los zombies
POST /threads/repair-zombies

# Reparar todos los duplicados
POST /threads/repair-duplicates
```

---

## Siguiente

- Integración con WS para updates en tiempo real de thread status
- Dashboard de diagnóstico thread/task
- Métricas de consistencia
