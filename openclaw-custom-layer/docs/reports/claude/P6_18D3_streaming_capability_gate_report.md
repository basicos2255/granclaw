# P6.18D3 — Streaming Capability Gate & Response Contract Fix

**Fecha:** 2026-05-19
**Estado:** COMPLETADO

## Resumen Ejecutivo

P6.18D3 corrige los fallos bloqueantes identificados en P6.18D:
1. **FALLO BLOQUEANTE 1**: Streaming route creaba success mock para capability-backed tasks
2. **FALLO BLOQUEANTE 2**: `/run-stream` no respondía (cliente colgaba)
3. **FALLO BLOQUEANTE 3**: No había P6.18D gate en streaming
4. **FALLO 4**: Browser/open web gate ya estaba coherente
5. **FALLO 5**: Extended probe existe pero no se usaba (conservador OK)

---

## Bugs Corregidos

### BUG 1: Missing Capability Gate in Streaming (CRÍTICO)

**Ubicación:** `apps/api/src/modules/orchestrator/routes.ts:2142`

**Problema:** La ruta streaming `/orchestrator/run-stream` no tenía capability gate check. Tasks que requerían `web_search`, `browser`, `download`, `install_app` podían llegar al mock y retornar `success: true`.

**Solución:** Agregado `checkCapabilityGate()` helper compartido y usado en streaming route ANTES de cualquier ejecución:

```typescript
// P6.18D3: CRITICAL - Capability gate check BEFORE any execution
const streamCapabilityGate = await checkCapabilityGate(
  context.tenant.id,
  intent,
  input.message,
  trace,
  task.id
)

if (streamCapabilityGate.blocked && streamCapabilityGate.response) {
  // Block execution with capabilityGate: true
  completeTask(task.id, 'blocked', ...)
  ok(res, streamCapabilityGate.response)
  return
}
```

### BUG 2: Streaming Response Not Sent (CRÍTICO)

**Ubicación:** `apps/api/src/modules/orchestrator/routes.ts:2693`

**Problema:** El comentario decía "Response already sent by runStreamingTask" pero esto era **FALSO**. `runStreamingTask()` retorna un `StreamTaskResult` - NO escribe a `res`. El cliente colgaba.

**Solución:** Agregado envío real de response:

```typescript
// P6.18D3: FIX - runStreamingTask does NOT send response, we must send it here
ok(res, {
  success: result.success,
  result: result.result,
  mode: result.mode,
  error: result.error,
  meta: {
    requestId: trace.requestId,
    taskId: task.id,
    source: 'openclaw',
    ...
  }
})
```

### BUG 3: Mock Safety Net

**Ubicación:** `apps/api/src/modules/orchestrator/service.ts:978`

**Problema:** `runFallbackStreamingTask()` retornaba `success: true` con mock sin marcador explícito.

**Solución:** Agregados marcadores explícitos al mock:

```typescript
return {
  success: true,
  mode: 'fallback',
  result: {
    response: `[MOCK STREAM] Processed: "${input.message}"`,
    note: 'WS not connected, OpenClaw not configured. Mock fallback.',
    isMock: true,     // P6.18D3: Explicit mock marker
    source: 'mock'    // P6.18D3: Explicit source
  }
}
```

---

## Nuevo Helper Compartido

### checkCapabilityGate()

```typescript
async function checkCapabilityGate(
  tenantId: string,
  intent: IntentClassification,
  message: string,
  trace: ExecutionTraceBuilder,
  taskId: string
): Promise<CapabilityGateResult>
```

Usado por ambas rutas (`/run` y `/run-stream`) para verificar capability gate antes de ejecución.

---

## Archivos Modificados

1. **apps/api/src/modules/orchestrator/routes.ts**
   - Agregado helper `checkCapabilityGate()` (líneas 168-232)
   - Agregado import `CapabilityGateCheckResult`
   - Agregado capability gate check en streaming (líneas 2142-2185)
   - Corregido response en provider='openclaw' streaming (líneas 2693-2710)

2. **apps/api/src/modules/orchestrator/service.ts**
   - Agregados marcadores `isMock` y `source` a mock fallback (líneas 978-979)

3. **apps/api/src/modules/testing/e2e/p6-18-harness.ts**
   - Agregados 4 tests P6.18D3 (líneas 831-967)
   - Total: 20 tests

---

## Tests P6.18D3 (4 nuevos)

1. **P6.18D3 Capability Gate for Search Intent** - Verifica que web_search está bloqueado sin OpenClaw
2. **P6.18D3 Browser Capability Gate** - Verifica que browser está bloqueado sin OpenClaw
3. **P6.18D3 All Capability-Backed Tasks Blocked** - Verifica que TODOS los capability-backed tasks están bloqueados
4. **P6.18D3 Gate Cache Age Reporting** - Verifica que cacheAgeMs se reporta correctamente

---

## Self Audit

| Check | Resultado |
|-------|-----------|
| Streaming tiene capability gate | OK - Línea 2142 |
| Streaming envía response | OK - Línea 2693 |
| Mock tiene marcadores explícitos | OK - isMock=true, source='mock' |
| Browser está gated | OK - BROWSER_PATTERNS en getRequiredCapabilityForIntent |
| Harness actualizado | OK - 20 tests |
| Sin secretos en logs | OK |
| R7B intacto | OK - Markers en ConversationalTaskDetail.tsx |
| API check/build | PASS |
| Web check/build | PASS |

---

## Verificación Manual Recomendada

Con API local corriendo:
```bash
# 1. POST /orchestrator/run-stream {"message": "busca info de libra en internet"}
#    -> Debe ser blocked, NO success mock, NO client hanging

# 2. POST /orchestrator/run-stream {"message": "abre la página de google"}
#    -> Debe ser blocked para browser capability

# 3. GET /tasks/:id después de cualquier blocked task
#    -> Debe tener capabilityGate: true en meta
```

---

## Conclusión

P6.18D3 cierra todos los gaps de streaming identificados en P6.18D:
1. Capability gate check ahora está en AMBAS rutas (normal y streaming)
2. La ruta streaming ya no cuelga - envía response correctamente
3. El mock tiene marcadores explícitos para debugging
4. 20 tests en harness verifican el comportamiento correcto
