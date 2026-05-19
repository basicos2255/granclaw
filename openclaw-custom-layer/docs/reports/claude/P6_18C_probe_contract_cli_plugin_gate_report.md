# P6.18C — Probe Contract, CLI/Plugin/Tool Evidence & Task Gate Alignment

**Fecha:** 2025-05-17
**Estado:** COMPLETADO
**Requiere:** P6.18B completado

## Resumen Ejecutivo

P6.18C corrige 5 bugs críticos identificados en P6.18B relacionados con el sistema de readiness de capabilities:

1. **API/UI Response Shape Mismatch** - Backend devolvía doble wrapper
2. **GET /capabilities/probe/:capability Roto** - Ruta caía en patrón genérico
3. **False Ready Bug** - Gateway 200 → capability marcada "ready" sin evidencia
4. **Task Gates Estáticos** - Planner usaba config estática en lugar de probe
5. **Harness Débil** - Tests no validaban comportamiento real

## Bugs Corregidos

### Bug 1: API/UI Response Shape Mismatch

**Problema:**
```typescript
// Backend devolvía:
{ success: true, data: { success: true, snapshot: {...} } }

// UI esperaba:
{ success: true, data: snapshot }  // ApiResponse<SystemReadinessSnapshot>
```

**Solución:** Modificado `routes.ts` para devolver datos directamente:
```typescript
// ANTES
ok(res, { success: true, snapshot: result })

// DESPUÉS (P6.18C)
ok(res, result)
```

**Archivos:** `apps/api/src/modules/capabilities/routes.ts`

### Bug 2: GET /capabilities/probe/:capability Route Priority

**Problema:** La ruta `/capabilities/probe/:capability` caía en el patrón genérico `/capabilities/:id` porque estaba ordenada después.

**Solución:** Reordenado en `index.ts` getDynamicRoutes:
```typescript
// P6.18C: Probe route MUST be before generic capability route
{ pattern: /^\/capabilities\/probe\/([^/]+)$/, handler: handleProbeCapability },
{ pattern: /^\/capabilities\/([^/]+)$/, handler: handleGetCapabilityById },
```

**Archivos:** `apps/api/src/index.ts`

### Bug 3: False Ready para OpenClaw Capabilities

**Problema:** Si OpenClaw Gateway respondía 200 en `/health`, todas las capabilities dependientes (web_search, browser, download) se marcaban como "ready" sin verificar que el tool/plugin realmente existiera.

**Solución:** Nuevo estado `'unknown'` para capabilities OpenClaw sin evidencia:
```typescript
// P6.18C: Gateway is alive but we have NO evidence the specific tool works
if (definition.requiresOpenClaw && gatewayProbe.state === 'ready') {
  if (!isApproved) {
    state = 'unavailable'
  } else {
    // NO false ready - mark as unknown
    state = 'unknown'
    evidence = {
      responseSummary: 'Gateway vivo pero disponibilidad de herramienta no verificada'
    }
  }
}
```

**Archivos:**
- `apps/api/src/modules/capabilities/probe.ts`
- `apps/api/src/modules/capabilities/types.ts`

### Bug 4: Task Gates Estáticos

**Problema:** `getCapabilityReadiness()` en service.ts usaba config estática que marcaba `web_search` como `implemented: true` aunque realmente depende de OpenClaw.

**Solución:** Agregado campo `requiresOpenClaw` y corregido lógica:
```typescript
web_search: {
  implemented: false,  // P6.18C: NOT implemented without tool verification
  provider: 'openclaw',
  requiresApproval: false,
  requiresOpenClaw: true,  // P6.18C: Added field
  missingSetup: ['OpenClaw web_search tool not verified']
},
```

**Archivos:** `apps/api/src/modules/capabilities/service.ts`

### Bug 5: Harness Débil

**Problema:** Tests solo validaban estructura JSON, no comportamiento real.

**Solución:** Agregados 3 tests P6.18C específicos:
- `testNoFalseReadyForOpenClawCapabilities` - Verifica NO false ready
- `testFilesystemIsReady` - Verifica que local capability SÍ está ready
- `testSnapshotHonestCounts` - Verifica summary.ready < summary.total

**Archivos:** `apps/api/src/modules/testing/e2e/p6-18-harness.ts`

## ReadinessState Actualizado

```typescript
export type ReadinessState =
  | 'ready'              // Capability verificada y disponible
  | 'unavailable'        // No disponible en esta instancia
  | 'not_installed'      // Plugin/tool no instalado
  | 'not_configured'     // Falta configuración (env vars)
  | 'not_authorized'     // Usuario no autorizado
  | 'gateway_unreachable'// OpenClaw gateway no responde
  | 'cli_unavailable'    // CLI local no corriendo
  | 'plugin_missing'     // Plugin requerido falta
  | 'tool_missing'       // Tool específico no encontrado
  | 'policy_blocked'     // Bloqueado por política
  | 'sandbox_blocked'    // Bloqueado por sandbox
  | 'auth_expired'       // Autenticación expirada
  | 'rate_limited'       // Límite de uso alcanzado
  | 'unknown'            // Gateway vivo pero tool no verificado
```

## UI Updates

`Tools.tsx` actualizado para manejar nuevos estados:
- `unknown` → "NO VERIFICADO" (índigo)
- `tool_missing` → "HERRAMIENTA FALTANTE" (amber)
- `plugin_missing` → "PLUGIN FALTANTE" (amber)
- `policy_blocked` → "BLOQUEADO" (rojo)
- `sandbox_blocked` → "SANDBOX" (rojo)

## Verificaciones Realizadas

### Check/Build
```bash
✅ apps/api: npm run check PASSED
✅ apps/api: npm run build PASSED
✅ apps/web: npm run check PASSED
✅ apps/web: npm run build PASSED
```

### Self-Audit
```bash
✅ No data.snapshot, data.probe, data.readiness patterns in frontend
✅ Probe route correctly ordered before generic route
✅ R7B markers intact (lines 650, 740, 810 in ConversationalTaskDetail.tsx)
✅ No false ready for OpenClaw capabilities
```

## Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `apps/api/src/modules/capabilities/routes.ts` | Response shape fix |
| `apps/api/src/index.ts` | Route priority fix |
| `apps/api/src/modules/capabilities/types.ts` | ReadinessState expansion |
| `apps/api/src/modules/capabilities/probe.ts` | No false ready logic |
| `apps/api/src/modules/capabilities/service.ts` | requiresOpenClaw field |
| `apps/web/src/services/api.ts` | ReadinessState type sync |
| `apps/web/src/pages/control/Tools.tsx` | New state styles |
| `apps/api/src/modules/testing/e2e/p6-18-harness.ts` | 3 new tests |

## Principios Aplicados

1. **NO False Ready**: Gateway alive ≠ tool available
2. **Evidence-Based**: Solo `ready` con evidencia real
3. **Honest States**: `unknown` cuando no hay verificación
4. **Type Safety**: ReadinessState expandido con todos los estados posibles
5. **R7B Intact**: Failure panel UX preservado

## Próximos Pasos

1. **P6.19**: Implementar verificación real de tools via OpenClaw `/tools` endpoint
2. **P6.20**: Cache de tool availability con TTL
3. **P6.21**: WebSocket notifications para cambios de readiness
