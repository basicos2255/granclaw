# P6.18D6 — Simple Task Output Visibility & OpenClaw Mask UX

**Fecha:** 2026-05-20
**Estado:** COMPLETADO

## Resumen Ejecutivo

P6.18D6 corrige el problema donde tareas simples completadas mostraban "Ejecutado via openclaw" en lugar de la respuesta real, y el thread quedaba con "Pensando..." aunque la tarea estaba completada.

---

## Problema Identificado

### Síntomas Observados

1. `/tasks` mostraba "Ejecutado via openclaw" como summary en vez de la respuesta real
2. `/tasks/:id` mostraba status "Completada" pero thread con badge "Pensando..."
3. No aparecía bubble del asistente con la respuesta real en el thread
4. Violaba el contrato de Task OS: tarea completada debe mostrar output visible

### Root Cause

1. **formatter.ts**: `extractSummary()` no reconocía `ChatCompletionResponse` de OpenClaw
   - Buscaba `obj.message`, `obj.response`, `obj.summary`
   - No encontraba nada → fallback "Ejecutado via ${provider}"

2. **syncThreadWithTask**: Al completar tarea exitosamente, añadía mensaje de tipo `system` genérico
   - No extraía la respuesta real del resultado
   - No añadía mensaje de tipo `assistant`

3. **Frontend**: No recargaba thread cuando tarea transitaba a estado terminal
   - Polling solo activo para `running`/`queued`
   - Al completar, no se refrescaba el thread

---

## Correcciones Implementadas

### Fix 1: formatter.ts - ChatCompletionResponse Support

```typescript
// P6.18D6: OpenClaw ChatCompletionResponse format
// Structure: { choices: [{ message: { role: 'assistant', content: 'response' } }] }
if (Array.isArray(obj.choices) && obj.choices.length > 0) {
  const firstChoice = obj.choices[0] as Record<string, unknown> | undefined
  if (firstChoice && typeof firstChoice === 'object') {
    const msg = firstChoice.message as Record<string, unknown> | undefined
    if (msg && typeof msg.content === 'string') {
      const content = msg.content
      return content.length > 300 ? content.substring(0, 297) + '...' : content
    }
  }
}
```

**Resultado:** Summary ahora contiene la respuesta real de OpenClaw.

### Fix 2: syncThreadWithTask - Assistant Message

```typescript
// P6.18D6: For successful completion, add assistant message with real response
if (newThreadStatus === 'completed') {
  const task = getTask(taskId)
  const assistantResponse = task?.result ? extractAssistantResponseFromResult(task.result) : null

  if (assistantResponse) {
    addMessage({
      threadId: thread.id,
      role: 'assistant',
      content: assistantResponse
    })
  }
}
```

**Resultado:** Thread tiene mensaje de assistant con respuesta real.

### Fix 3: ConversationalTaskDetail.tsx - Thread Reload

```typescript
// P6.18D6: Reload thread when task transitions to terminal state
useEffect(() => {
  if (prevStatus && currentStatus &&
      (prevStatus === 'running' || prevStatus === 'queued') &&
      (currentStatus === 'success' || currentStatus === 'error' || currentStatus === 'blocked')) {
    api.getThreadByTask(taskId).then(response => {
      if (response.success && response.data) {
        setThread(response.data)
      }
    })
  }
}, [task?.status, taskId])
```

**Resultado:** Frontend recarga thread al completar tarea.

---

## Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `apps/api/src/modules/task-results/formatter.ts` | +20 líneas ChatCompletionResponse support |
| `apps/api/src/modules/task-threads/service.ts` | +70 líneas extractAssistantResponseFromResult + syncThreadWithTask fix |
| `apps/web/src/pages/product/ConversationalTaskDetail.tsx` | +20 líneas thread reload on terminal |
| `apps/api/src/modules/testing/e2e/p6-18-harness.ts` | +3 tests P6.18D6 (total: 32) |

---

## Harness P6.18D6 (32 tests)

### Distribución

```
Tests base: 6
Tests P6.18C: 3
Tests P6.18D: 6
Tests P6.18D3: 4
Tests P6.18D4: 5
Tests P6.18D5: 5
Tests P6.18D6: 3 (nuevo)
Total: 32 tests
```

### Tests P6.18D6

1. `testChatCompletionResponseParsing` - Verifica extracción de choices[0].message.content
2. `testSimpleMockResponseFormat` - Verifica extracción de response field
3. `testBlockedTaskNoEjecutadoVia` - Verifica que blocked no dice "Ejecutado via"

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
| P6.18D5 markers intactos | OK (21 en routes.ts, 5 en probe.ts) |
| ChatCompletionResponse parsing | OK (formatter.ts:41-52) |
| extractAssistantResponseFromResult | OK (service.ts:827-876) |
| Thread reload on terminal | OK (ConversationalTaskDetail.tsx:127-147) |
| Blocked task no "Ejecutado via" | OK (formatter.ts:31-39) |
| 32 tests en harness | OK |

---

## Contrato Obligatorio de Tarea Simple

A partir de P6.18D6:

1. Si `task.status === 'success'`:
   - `task.summary` contiene respuesta textual (no "Ejecutado via X")
   - `task.outputs[0]` contiene la respuesta como `{ type: 'text', value: 'respuesta' }`
   - Thread tiene mensaje `role: 'assistant'` con la respuesta

2. Thread no muestra "Pensando..." si task es terminal

3. "via OpenClaw" puede ser metadata/source, nunca el único "resultado"

---

## Limitaciones Honestas

1. **Sin OpenClaw real:** Mock responses también se formatean correctamente
2. **Long responses:** Se truncan a 300 chars en summary, completo en outputs
3. **Polling:** Frontend recarga thread solo en transición a terminal, no continuamente

---

## Conclusión

P6.18D6 cierra el gap de UX donde tareas simples completadas no mostraban la respuesta real. Ahora:

- `/tasks` muestra preview real de la respuesta
- `/tasks/:id` muestra mensaje del asistente en el thread
- No más "Pensando..." en tareas terminales
- "Ejecutado via X" solo aparece si no hay respuesta estructurada

La visión "máscara bonita" de GranClaw sobre OpenClaw ahora es operativa: entrada simple, resultado visible, truth accesible.
