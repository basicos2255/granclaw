# P6.18D6B — Terminal Task Thread Hydration

**Fecha:** 2026-05-20
**Estado:** COMPLETADO

## Resumen Ejecutivo

P6.18D6B corrige el problema donde tareas que completan ANTES de que exista un thread causaban que el frontend creara un thread con `status: 'thinking'` mostrando badge "Pensando..." aunque la tarea ya estaba completada.

---

## Problema Identificado

### Síntomas Observados

1. Tarea simple completa exitosamente (ej: "dime la hora de brasil")
2. Usuario navega a `/tasks/:id`
3. Frontend llama `createThread()` para la tarea completada
4. Thread se crea con `status: 'thinking'` → badge "Pensando..."
5. No aparece mensaje del asistente con la respuesta real

### Root Cause

1. **createThread()**: Siempre creaba threads con `status: 'thinking'` sin importar el estado de la tarea
2. **syncThreadWithTask()**: Si no existía thread, retornaba `null` sin crear thread hydrated
3. **Frontend**: Esperaba que el backend creara el thread con estado correcto

---

## Correcciones Implementadas

### Fix 1: createThread() - Terminal Task Detection

```typescript
// P6.18D6B: Check if task is already terminal - hydrate thread from task result
let initialStatus: HumanTaskState = 'thinking'
let assistantResponse: string | null = null

if (input.taskId) {
  const task = getTask(input.taskId)
  if (task) {
    if (task.status === 'success') {
      initialStatus = 'completed'
      assistantResponse = extractAssistantResponseFromResult(task.result)
    } else if (task.status === 'error') {
      initialStatus = 'failed'
    }
  }
}
```

**Resultado:** Thread se crea con estado correcto según estado de la tarea.

### Fix 2: createThread() - Assistant Message Hydration

```typescript
// P6.18D6B: Add assistant message for completed tasks
if (initialStatus === 'completed' && assistantResponse) {
  thread.messages.push({
    id: generateId('msg'),
    role: 'assistant',
    content: assistantResponse,
    timestamp: now
  })
}
```

**Resultado:** Thread completado incluye mensaje del asistente con la respuesta real.

### Fix 3: syncThreadWithTask() - Create Hydrated Thread If Missing

```typescript
// P6.18D6B: If no thread exists and task is terminal success, create hydrated thread
if (!thread) {
  if (taskStatus === 'success') {
    const task = getTask(taskId)
    if (task) {
      thread = createThread({
        taskId: taskId,
        tenantId: task.tenantId,
        title: task.input?.substring(0, 100) || 'Tarea completada',
        initialMessage: task.input
      })
      // Thread was already created with completed status by createThread P6.18D6B
      return thread
    }
  }
  return null
}
```

**Resultado:** syncThreadWithTask crea thread hydrated si no existe para tareas success.

---

## Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `apps/api/src/modules/task-threads/service.ts` | createThread detecta tarea terminal, syncThreadWithTask crea thread hydrated |
| `apps/api/src/modules/testing/e2e/p6-18-harness.ts` | +3 tests P6.18D6B (total: 35) |
| `PROJECT_MEMORY.md` | Documentación P6.18D6B |

---

## Harness P6.18D6B (35 tests)

### Distribución

```
Tests base: 6
Tests P6.18C: 3
Tests P6.18D: 6
Tests P6.18D3: 4
Tests P6.18D4: 5
Tests P6.18D5: 5
Tests P6.18D6: 3
Tests P6.18D6B: 3 (nuevo)
Total: 35 tests
```

### Tests P6.18D6B

1. `testCompletedTaskCreatesTerminalThreadIfMissing`
   - Crea task success, luego createThread
   - Verifica thread.status === 'completed'
   - Verifica mensaje assistant presente

2. `testCreateThreadForTerminalTaskDoesNotThink`
   - Para task terminal, createThread nunca devuelve 'thinking'
   - Verifica error → failed, success → completed

3. `testNoDuplicateAssistantMessagesOnRepeatedSync`
   - syncThreadWithTask repetido no duplica mensajes
   - Verifica idempotencia

---

## Verificación

### TypeScript Check/Build

```bash
npm run check --workspace=@granclaw/api  # PASS
npm run check --workspace=@granclaw/web  # PASS
npm run build --workspace=@granclaw/api  # PASS
npm run build --workspace=@granclaw/web  # PASS
```

### Self Audit

| Check | Resultado |
|-------|-----------|
| P6.17R7B markers intactos | OK (4 markers) |
| P6.18D5 markers intactos | OK (30+ markers) |
| P6.18D6B markers añadidos | OK (30+ markers) |
| createThread hydration | OK (service.ts:115-134) |
| syncThreadWithTask hydration | OK (service.ts:945-958) |
| extractAssistantResponseFromResult | OK (service.ts:887-930) |
| 35 tests en harness | OK |

---

## Contrato Obligatorio de Thread para Tarea Terminal

A partir de P6.18D6B:

1. Si `task.status === 'success'` y no existe thread:
   - `createThread()` crea thread con `status: 'completed'`
   - Thread incluye mensaje `role: 'assistant'` con respuesta real

2. Si `task.status === 'error'` y no existe thread:
   - `createThread()` crea thread con `status: 'failed'`
   - Thread incluye mensaje system con error

3. `syncThreadWithTask()` crea thread hydrated si falta para success tasks

4. No "Pensando..." en tareas terminales

5. Idempotencia: sync repetido no duplica mensajes

---

## Flujo Correcto Post-P6.18D6B

```
1. Usuario: "dime la hora de brasil"
2. Task creada → status: 'running'
3. Task completa → status: 'success', result: { choices: [...] }
4. (NO hay thread aún)
5. Usuario abre /tasks/:id
6. Frontend: GET /threads/by-task/:taskId → null
7. Frontend: POST /threads { taskId, ... }
8. Backend: createThread detecta task.status === 'success'
9. Backend: Thread creado con status: 'completed' + assistant message
10. UI: Muestra "Completada" + respuesta real (no "Pensando...")
```

---

## Limitaciones Honestas

1. **Blocked tasks**: No auto-crean threads (P6.17R7B - user debe decidir acción)
2. **Cancelled tasks**: createThread no hydrata cancelled (solo success/error)
3. **Response extraction**: Depende de estructura conocida de result

---

## Conclusión

P6.18D6B cierra definitivamente el bug de "Pensando..." para tareas completadas. Ahora no importa si el thread se crea antes o después de que la tarea termine: siempre reflejará el estado terminal correcto y mostrará la respuesta del asistente.

La visión "máscara bonita" de GranClaw sobre OpenClaw está operativa: entrada simple, ejecución invisible, resultado visible sin estado falso.
