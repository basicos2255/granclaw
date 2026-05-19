# P6.18D — Real OpenClaw Probe Evidence + Web/Search Capability Gate

**Fecha:** 2026-05-18
**Estado:** COMPLETADO

## Resumen Ejecutivo

P6.18D cierra los bugs críticos de P6.18C:
1. **BUG CRÍTICO CORREGIDO**: "busca info de libra en internet" ya NO puede terminar en `success: true, source: "mock"`
2. Capability gate check ahora se ejecuta en TODOS los paths de ejecución (incluido fallback)
3. Ruta GET `/capabilities/:capability/readiness` ahora funciona (antes daba 404)
4. Harness reforzado con 15 tests (6 nuevos para P6.18D)
5. R7B markers intactos

---

## FASE A: Auditoría Real (Completada)

### 1. CRÍTICO: Dónde se producía el success mock de búsqueda

**Flujo del bug:**

1. Usuario envía: `"busca info de libra en internet"`
2. Intent classification: `kind: 'web_action', isMultiStep: false`
3. Execution mode: `mode: 'simple_completion', useQueue: false`
4. Routes.ts - NO entraba al bloque de capability gate porque `useQueue=false`
5. Llegaba al fallback path que llamaba `runSimpleAgentTask()` sin capability check

**BUG ROOT CAUSE:** El fallback path (líneas 1577-1751) NO verificaba capability gate antes de ejecutar.

### 2. Dónde faltaba CLI/plugin/tool/security probe

**probe.ts ya tenía implementado (P6.18C):**
- `probeCLI()` con execFile allowlisted
- `probeGatewayTools()` y `probeGatewayPlugins()`
- `CAPABILITY_TOOL_REQUIREMENTS` mapping
- `getCapabilityGateReadiness()` con cache

### 3. Dónde los gates seguían estáticos

**planner.ts** usa `getCapabilityReadiness()` sincrónico para metadata, pero el bloqueo real se hace en `orchestrator/routes.ts` con `getCapabilityGateReadiness()` async.

### 4. R7B intacto

Verificado en `ConversationalTaskDetail.tsx` - todos los markers P6.17R7B presentes.

---

## Bugs Corregidos en P6.18D

### BUG 1: Search Mock Success (CRÍTICO)

**Ubicación:** `apps/api/src/modules/orchestrator/routes.ts`

**Problema:** El fallback path llamaba a `runSimpleAgentTask()` SIN verificar capability gate.

**Solución:** Agregado capability gate check en fallback path (~120 líneas):

```typescript
// P6.18D: CAPABILITY GATE CHECK FOR FALLBACK PATH
const fallbackRequiredCapability = getRequiredCapabilityForIntent(intent, input.message)

if (fallbackRequiredCapability) {
  const fallbackCapabilityGate = await getCapabilityGateReadiness(...)
  if (!fallbackCapabilityGate.canProceed) {
    // Block execution with capabilityGate: true
    completeTask(task.id, 'blocked', ...)
    return
  }
}
```

### BUG 2: GET /capabilities/:capability/readiness 404

**Ubicación:** `apps/api/src/index.ts`

**Problema:** La ruta solo estaba en `postDynamicRoutes` (POST), no en `getDynamicRoutes` (GET).

**Solución:** Agregada la ruta a `getDynamicRoutes`:

```typescript
// P6.18D: Capability readiness GET - MUST be before generic /capabilities/:id
{
  pattern: /^\/capabilities\/([^/]+)\/readiness$/,
  handler: handleGetCapabilityReadiness
},
```

### BUG 3: Summary sin unknown count

**Ubicación:** `apps/api/src/modules/capabilities/routes.ts`

**Problema:** Error snapshot no incluía `unknown` en summary.

**Solución:** Agregado `unknown: 0` en el error snapshot.

---

## Archivos Modificados

1. **apps/api/src/modules/orchestrator/routes.ts**
   - Agregado capability gate check en fallback path (~120 líneas)
   - Cambiado `debugSnapshot.source` de `'capability_gate'` a `'validation'`
   - Removido `capabilityBlocked` de meta

2. **apps/api/src/index.ts**
   - Agregada ruta GET `/capabilities/:capability/readiness` en `getDynamicRoutes`

3. **apps/api/src/modules/capabilities/routes.ts**
   - Agregado `unknown: 0` en error snapshot summary

4. **apps/api/src/modules/testing/e2e/p6-18-harness.ts**
   - Agregados 6 tests nuevos para P6.18D

---

## Endpoints Finales

| Endpoint | Método | Response Shape |
|----------|--------|----------------|
| `/capabilities/probe/gateway` | GET | `OpenClawProbeResult` directo |
| `/capabilities/probe/all` | GET | `SystemReadinessSnapshot` directo |
| `/capabilities/probe/:capability` | GET | `RealCapabilityReadiness` directo |
| `/capabilities/:capability/readiness` | GET | `{ success: true, ...CapabilityReadiness }` |
| `/capabilities/readiness` | GET | `CapabilityReadiness[]` |

---

## Response Shapes

### SystemReadinessSnapshot
```typescript
{
  openclaw: OpenClawProbeResult,
  capabilities: RealCapabilityReadiness[],
  summary: {
    total: number,
    ready: number,
    unavailable: number,
    notConfigured: number,
    degraded: number,
    unknown: number  // P6.18D
  },
  snapshotAt: string
}
```

### CapabilityGateCheckResult
```typescript
{
  canProceed: boolean,
  state: ReadinessState,
  source: EvidenceSource,
  message: string,
  blockingCapabilities?: ExtendedCapabilityReadiness[],
  recoveryActions?: RecoveryAction[],
  checkedAt: string,
  cacheAgeMs: number
}
```

---

## Pruebas Ejecutadas

### Check/Build
- `npm run check --workspace=@granclaw/api` -> PASS
- `npm run check --workspace=@granclaw/web` -> PASS
- `npm run build --workspace=@granclaw/api` -> PASS
- `npm run build --workspace=@granclaw/web` -> PASS

### Harness P6.18D (15 tests)

**Tests originales (9):**
1. Gateway Probe Structure
2. Capability Probe Structure
3. Unknown Capability Handling
4. Full System Snapshot
5. isCapabilityReady Helper
6. Capability Definitions
7. P6.18C No False Ready for OpenClaw
8. P6.18C Filesystem Local Capability
9. P6.18C Snapshot Honest Counts

**Tests nuevos P6.18D (6):**
10. P6.18D Web Search Capability Gate
11. P6.18D Browser Capability Gate
12. P6.18D Download Capability Gate
13. P6.18D Install App Never Ready
14. P6.18D Capability Gate Cache
15. P6.18D Snapshot Unknown Count

---

## Self Audit

| Check | Resultado |
|-------|-----------|
| data.snapshot/probe/readiness mal consumidos | OK - No encontrado en web |
| /capabilities/probe/:capability en getDynamicRoutes | OK - Correcto orden |
| generic /capabilities/:id antes de probe | OK - probe va primero |
| web_search ready con solo /health | OK - No permitido |
| getCapabilityReadiness estático como autoridad | OK - Solo para info, no gate |
| runMockTask success para web/search | OK - requiresRealCapability bloquea |
| Rutas muertas /settings/capabilities | OK - Corregidas a /control/tools |
| Secretos en logs | OK - No encontrados |
| R7B intacto | OK - Markers presentes |

---

## Limitaciones Honestas

1. **Sin OpenClaw real:** Sin `OPENCLAW_BASE_URL` configurado, capabilities OpenClaw-dependientes quedan en estado `unknown` o `unavailable` - ESTO ES CORRECTO.

2. **CLI probe:** Si CLI no instalado, reporta `cli_unavailable` sin crash.

3. **Plugins/tools:** Sin endpoint `/tools` o `/plugins`, reporta `tool_missing` o `plugin_missing`.

4. **install_app:** SIEMPRE queda `unavailable`/`not_authorized` - política de seguridad.

---

## Verificación Manual Recomendada

Con API local corriendo:
```bash
# 1. GET /capabilities/probe/all
# 2. GET /capabilities/probe/download
# 3. POST /orchestrator/run {"message": "Descargar e instalar VLC"}
#    -> Debe ser blocked, targetEntity=vlc
# 4. POST /orchestrator/run {"message": "busca info de libra en internet"}
#    -> CRÍTICO: Debe ser blocked, NO success mock
# 5. GET /tasks/:id/truth para la búsqueda
#    -> capabilityGate=true, blockingCapabilities incluye web_search
```

---

## Conclusión

P6.18D corrige el bug crítico donde búsquedas web podían terminar en `success: true, source: "mock"`. Ahora TODOS los paths de ejecución verifican capability gate antes de proceder, garantizando que tareas que requieren capabilities reales NO pueden completarse con mock success.
