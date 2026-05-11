# P6.8 - Thread Lifecycle Pre-Audit Report

**Fecha:** 2026-05-10
**Autor:** Claude
**Estado:** Completado

---

## Resumen Ejecutivo

Este reporte documenta los BUGS CRÍTICOS encontrados en la sincronización entre Task y Thread lifecycles. El problema principal: **Tasks pueden completarse exitosamente pero threads quedan en estado "thinking" indefinidamente**.

---

## Problemas Identificados

### 1. CRÍTICO: createThread() No Verifica Unicidad

**Location:** `task-threads/service.ts:createThread()`

| Aspecto | Valor |
|---------|-------|
| Behavior | Crea thread nuevo sin verificar si ya existe uno para el mismo taskId |
| Risk | ALTO - Genera duplicados, 2+ threads por task |
| Duplicate? | SÍ - Causa directa |
| Zombie? | Contribuye |
| Fix | Implementar getOrCreateThreadForTask() |

```typescript
// ACTUAL (Bug)
export function createThread(input: CreateThreadInput): TaskThread {
  const thread: TaskThread = {
    id: generateId('thread'),
    taskId: input.taskId,  // NO hay check de unicidad!
    // ...
  }
  state.threads.push(thread)  // Crea duplicado
  saveState()
  return thread
}

// REQUERIDO (Fix)
export function getOrCreateThreadForTask(taskId: string, ...): TaskThread {
  const existing = getThreadByTaskId(taskId)
  if (existing) return existing  // Retorna existente
  return createThread(...)  // Crea solo si no existe
}
```

---

### 2. CRÍTICO: completeTask() No Sincroniza Thread

**Location:** `orchestrator/routes.ts` (20+ llamadas a completeTask)

| Aspecto | Valor |
|---------|-------|
| Behavior | completeTask() actualiza task status pero NUNCA actualiza thread status |
| Risk | ALTO - Thread queda "thinking" aunque task sea "success" |
| Duplicate? | No |
| Zombie? | SÍ - Causa directa |
| Fix | completeTask debe llamar syncThreadWithTask() |

```typescript
// ACTUAL (Bug) - orchestrator/routes.ts
completeTask(taskId, 'success', result)  // Solo actualiza task
// Thread permanece en 'thinking' o 'executing'

// REQUERIDO (Fix)
completeTask(taskId, 'success', result)
syncThreadWithTask(taskId)  // Sincroniza thread con task status
```

**Lugares afectados en orchestrator/routes.ts:**
- `/execute` route (~5 llamadas)
- `/ask` route (~3 llamadas)
- `/interpret` route (~2 llamadas)
- Error handlers (~10+ llamadas)

---

### 3. CRÍTICO: Frontend Race Condition en Thread Creation

**Location:** `ConversationalTaskDetail.tsx`

| Aspecto | Valor |
|---------|-------|
| Behavior | Si getThreadByTask retorna null, crea nuevo thread (puede crear duplicado) |
| Risk | MEDIO-ALTO - Race condition entre requests concurrentes |
| Duplicate? | SÍ - Contribuye |
| Zombie? | No directamente |
| Fix | Backend debe garantizar unicidad, no frontend |

```typescript
// ACTUAL (Bug)
const threadResponse = await api.getThreadByTask(taskId)
if (threadResponse.success && threadResponse.data) {
  setThread(threadResponse.data)
} else {
  // Race condition: otro request puede crear thread mientras este ejecuta
  const createResponse = await api.createThread({...})
}

// REQUERIDO (Fix)
// Backend: POST /threads debe usar getOrCreateThreadForTask
// Frontend: Single call a POST /threads que garantiza unicidad
```

---

### 4. ALTO: getThreadByTaskId() Solo Retorna Primero

**Location:** `task-threads/service.ts:getThreadByTaskId()`

| Aspecto | Valor |
|---------|-------|
| Behavior | Usa .find() que retorna solo el primer match |
| Risk | MEDIO - Si hay duplicados, ignora los demás |
| Duplicate? | Oculta duplicados |
| Zombie? | Contribuye (otros threads quedan huérfanos) |
| Fix | Agregar getThreadsByTaskId() para detección de duplicados |

```typescript
// ACTUAL
export function getThreadByTaskId(taskId: string): TaskThread | null {
  return state.threads.find(t => t.taskId === taskId) || null  // Solo primero
}

// REQUERIDO (Adicional)
export function getThreadsByTaskId(taskId: string): TaskThread[] {
  return state.threads.filter(t => t.taskId === taskId)  // Todos
}
```

---

### 5. ALTO: No Existe syncThreadWithTask()

**Location:** `task-threads/service.ts`

| Aspecto | Valor |
|---------|-------|
| Behavior | No existe función para sincronizar thread status con task status |
| Risk | ALTO - Lifecycle desconectado |
| Duplicate? | No |
| Zombie? | SÍ - Sin esto, threads nunca se sincronizan |
| Fix | Crear syncThreadWithTask() |

```typescript
// REQUERIDO (Nueva función)
export function syncThreadWithTask(taskId: string): TaskThread | null {
  const task = getTask(taskId)
  const thread = getThreadByTaskId(taskId)
  if (!task || !thread) return null

  // Map task status to thread status
  if (isTerminalTaskStatus(task.status)) {
    if (task.status === 'success') {
      return completeThread(thread.id)
    } else {
      return failThread(thread.id, task.error)
    }
  }
  return thread
}
```

---

### 6. MEDIO: completeThread() y failThread() Nunca Se Llaman

**Location:** `task-threads/service.ts`

| Aspecto | Valor |
|---------|-------|
| Behavior | Funciones existen pero nunca son invocadas desde task completion flow |
| Risk | MEDIO - Código muerto efectivamente |
| Duplicate? | No |
| Zombie? | SÍ - Sin uso, threads nunca terminan |
| Fix | Llamar desde syncThreadWithTask |

---

### 7. MEDIO: No Hay Detección de Zombies

**Location:** `task-threads/service.ts`

| Aspecto | Valor |
|---------|-------|
| Behavior | No existe función para detectar threads zombie |
| Risk | MEDIO - Zombies se acumulan |
| Duplicate? | No |
| Zombie? | Contribuye |
| Fix | Crear detectZombieThreads() |

```typescript
// REQUERIDO (Nueva función)
export function detectZombieThreads(): TaskThread[] {
  const activeStatuses = ['thinking', 'executing', 'waiting_input']
  return state.threads.filter(thread => {
    if (!activeStatuses.includes(thread.status)) return false
    const task = getTask(thread.taskId)
    if (!task) return true  // Thread sin task = zombie
    return isTerminalTaskStatus(task.status)  // Task terminó pero thread activo = zombie
  })
}
```

---

### 8. MEDIO: No Hay Detección de Duplicados

**Location:** `task-threads/service.ts`

| Aspecto | Valor |
|---------|-------|
| Behavior | No existe función para detectar threads duplicados por taskId |
| Risk | MEDIO - Duplicados se acumulan |
| Duplicate? | Contribuye |
| Zombie? | No |
| Fix | Crear detectDuplicateThreads() |

```typescript
// REQUERIDO (Nueva función)
export function detectDuplicateThreads(): Map<string, TaskThread[]> {
  const byTaskId = new Map<string, TaskThread[]>()
  for (const thread of state.threads) {
    const existing = byTaskId.get(thread.taskId) || []
    existing.push(thread)
    byTaskId.set(thread.taskId, existing)
  }
  // Retornar solo los que tienen más de 1
  const duplicates = new Map<string, TaskThread[]>()
  for (const [taskId, threads] of byTaskId) {
    if (threads.length > 1) duplicates.set(taskId, threads)
  }
  return duplicates
}
```

---

## Resumen de Impacto

| Problema | Severidad | Causa Duplicados | Causa Zombies |
|----------|-----------|------------------|---------------|
| createThread sin unicidad | CRÍTICO | ✅ | ⚠️ |
| completeTask sin sync | CRÍTICO | ❌ | ✅ |
| Frontend race condition | ALTO | ✅ | ❌ |
| getThreadByTaskId solo primero | MEDIO | Oculta | ⚠️ |
| No existe syncThreadWithTask | ALTO | ❌ | ✅ |
| completeThread nunca llamado | MEDIO | ❌ | ✅ |
| No detección zombies | MEDIO | ❌ | ⚠️ |
| No detección duplicados | MEDIO | ⚠️ | ❌ |

---

## Plan de Corrección

### FASE B: Single Thread Guarantee
1. Crear `getOrCreateThreadForTask()` en service.ts
2. Modificar `handleCreateThread()` para usar getOrCreate
3. Agregar `getThreadsByTaskId()` para detección

### FASE C: Thread Finalization Sync
1. Crear `syncThreadWithTask()` en service.ts
2. Crear helper `isTerminalTaskStatus()`
3. Integrar en completeTask flow

### FASE D: Execution Truth Model
1. Crear `getExecutionTruth()` que combina task + thread state
2. Agregar GET /tasks/:id/truth endpoint

### FASE E: No Success Without Thread Sync
1. Modificar `completeTaskWithEvidence()` para llamar syncThread
2. Verificar thread sync antes de marcar success

### FASE F: Zombie Detection
1. Crear `detectZombieThreads()`
2. Agregar POST /threads/repair-zombies endpoint

### FASE G: Duplicate Cleanup
1. Crear `detectDuplicateThreads()`
2. Crear `mergeDuplicateThreadsForTask()`
3. Agregar POST /threads/repair-duplicates endpoint

### FASE H-M: UX, WS Events, Verificación, Documentación

---

## Siguiente Paso

Proceder a FASE B: Implementar `getOrCreateThreadForTask()` para garantizar single thread per task.
