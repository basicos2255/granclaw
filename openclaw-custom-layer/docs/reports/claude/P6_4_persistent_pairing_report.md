# P6.4 - Persistent Pairing, Auth Lifecycle & Route Consistency

**Fecha:** 2026-05-09
**Autor:** Claude
**Estado:** Completado

---

## 1. Objetivo Ejecutado

Crear un sistema robusto de pairing/auth lifecycle con:
- State machine de pairing persistente
- Consistency entre capability y pairing states
- Health check endpoints
- WS events para cambios de estado
- Dashboard visibility de auth health
- Route consistency (sin 404 silenciosos)

---

## 2. Problemas Corregidos

| Problema | Estado |
|----------|--------|
| /tasks/new retornaba 404 | CORREGIDO (usar ?create=true) |
| No habia state machine de pairing | CORREGIDO |
| Inconsistencia capability/pairing | CORREGIDO (sync service) |
| Sin health check endpoint | CORREGIDO |
| Sin WS events de pairing | CORREGIDO |
| Dashboard sin auth health | CORREGIDO |

---

## 3. Pairing State Machine

### Estados

```typescript
type OverallPairingState =
  | 'unknown'        // Inicial
  | 'disconnected'   // OpenClaw no alcanzable
  | 'connected'      // Alcanzable pero sin auth
  | 'paired'         // Conectado + auth + capabilities OK
  | 'degraded'       // Conectado + auth pero scopes fallando
  | 'blocked'        // Issues criticos de auth/capability
  | 'error'          // Error fatal
```

### Transiciones

| Estado Actual | Evento | Nuevo Estado |
|---------------|--------|--------------|
| unknown | connection_ok | connected |
| unknown | connection_failed | disconnected |
| connected | auth_ok | paired |
| connected | auth_failed | blocked |
| paired | capability_degraded | degraded |
| paired | capability_blocked | blocked |
| degraded | repair_completed | paired |
| blocked | auth_ok | paired |
| * | fatal_error | error |
| * | reset | unknown |

---

## 4. Archivos Creados

### Backend (apps/api/src/modules/pairing-state/)

| Archivo | Descripcion |
|---------|-------------|
| `types.ts` | Tipos: PairingState, states, events, transitions |
| `service.ts` | State machine, persistence, listeners, health |
| `sync.ts` | Sync con system-state, auth-check |
| `routes.ts` | HTTP endpoints |
| `index.ts` | Module exports |

---

## 5. Endpoints Nuevos

### GET Endpoints

| Ruta | Descripcion |
|------|-------------|
| `/pairing/state` | Estado completo de pairing |
| `/pairing/health` | Health response (simplificado para UI) |
| `/pairing/combined` | Health combinado pairing + system-state |

### POST Endpoints

| Ruta | Descripcion |
|------|-------------|
| `/pairing/check` | Ejecuta health check completo |
| `/pairing/reset` | Reset state a defaults |
| `/pairing/reload` | Reload desde disco |

---

## 6. WebSocket Events

Nuevos eventos en runtime-ws/types.ts:

```typescript
| 'pairing:state-change'
| 'pairing:connected'
| 'pairing:disconnected'
| 'pairing:paired'
| 'pairing:degraded'
| 'pairing:blocked'
| 'pairing:error'
```

Emitidos automaticamente cuando cambia el overall state.

---

## 7. Startup Validation

En `index.ts`:

```typescript
// P6.4: Startup pairing health check (async, non-blocking)
runPairingHealthCheck().then((health) => {
  console.log(`[PairingState] Startup check: ${health.overall}`)
}).catch((err) => {
  console.warn('[PairingState] Startup check failed:', err)
})
```

---

## 8. Dashboard Health Section

En `ProductDashboard.tsx`:

- Nueva seccion "OpenClaw Connection"
- Estado de pairing con badge colorizado
- Indicador de capacidad de ejecucion
- Lista de issues activos
- Actualiza automaticamente via WS events

---

## 9. Route Consistency Fix

### Antes
```
Topbar.tsx: onClick={() => onNavigate('/tasks/new')}
```
Resultado: 404 porque no existe route

### Despues
```
Topbar.tsx: onClick={() => onNavigate('/tasks?create=true'))
```
Resultado: TasksPage abre modal de creacion

---

## 10. Sync Service

`sync.ts` mantiene consistencia entre:
- `pairing-state` (nuevo module)
- `system-state` (existente)
- `auth-check.service` (existente)

Funciones:
- `runPairingHealthCheck()` - Full check + sync
- `syncSuccessfulExecution()` - Sync en ejecucion exitosa
- `syncScopeAuthFailure()` - Sync en scope auth failure
- `syncScopeAuthResolved()` - Sync en scope resolved
- `getCombinedHealthStatus()` - Health combinado

---

## 11. Archivos Modificados

### Backend

| Archivo | Cambio |
|---------|--------|
| `index.ts` | Import/register pairing-state routes, startup check |
| `runtime-ws/types.ts` | Added pairing event types |
| `runtime-ws/event-bridge.ts` | Added emitPairingStateChange |
| `runtime-ws/index.ts` | Export emitPairingStateChange |

### Frontend

| Archivo | Cambio |
|---------|--------|
| `layouts/Topbar.tsx` | /tasks/new -> /tasks?create=true |
| `services/api.ts` | Added PairingHealthData, getPairingHealth, runPairingCheck |
| `pages/product/ProductDashboard.tsx` | Added OpenClaw health section |

---

## 12. Estado Final

| Feature | Estado |
|---------|--------|
| Route consistency | COMPLETADO |
| Pairing state machine | COMPLETADO |
| Persistence | COMPLETADO |
| Sync service | COMPLETADO |
| Health endpoints | COMPLETADO |
| WS events | COMPLETADO |
| Dashboard health | COMPLETADO |
| Startup validation | COMPLETADO |

---

## 13. Pendiente (No Critico)

| Item | Razon |
|------|-------|
| Self-healing automatico | Repair manual via UI es suficiente |
| Periodic background checks | Health check en startup + manual es suficiente |

---

## 14. Uso

### Frontend

```typescript
// Obtener health
const { data } = await getPairingHealth()
if (data.overall === 'paired') {
  // OK para ejecutar
}

// Subscribir a cambios via WS
const { lastEvent } = useRuntimeEvents('runtime', ['pairing:state-change'])
```

### Backend

```typescript
import { runPairingHealthCheck, getPairingHealth } from './modules/pairing-state'

// Check manual
const health = await runPairingHealthCheck()

// Get cached state
const health = getPairingHealth()

// Sync successful execution
import { syncSuccessfulExecution } from './modules/pairing-state'
syncSuccessfulExecution({ scopeKey: 'os:browser' })
```
