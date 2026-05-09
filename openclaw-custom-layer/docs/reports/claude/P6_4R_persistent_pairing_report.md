# P6.4R - Verified Persistent Pairing, Auth Lifecycle & Route Consistency

**Fecha:** 2026-05-09
**Autor:** Claude
**Estado:** Completado

---

## 1. Resumen Ejecutivo

P6.4R implementa correctamente el sistema de OpenClaw Auth con:
- Modulo `apps/api/src/modules/openclaw-auth/` completo
- Endpoint `GET /openclaw/health`
- Funcion `isCapabilityActuallyUsable()`
- Persistencia en `data/openclaw-auth-state.json`
- WS events: `openclaw-connected`, `openclaw-degraded`, `pairing-expired`, etc.
- Dashboard integration con auth health UX

---

## 2. Pre-Audit Findings (Antes)

| Item | Estado Antes |
|------|--------------|
| `apps/api/src/modules/openclaw-auth/` | NO EXISTIA |
| `GET /openclaw/health` | NO EXISTIA |
| `isCapabilityActuallyUsable()` | NO EXISTIA |
| `data/openclaw-auth-state.json` | NO EXISTIA |
| WS auth events | NO EXISTIAN |
| `/tasks/new` route fix | YA CORREGIDO |

**Nota:** Existia un modulo `pairing-state` creado incorrectamente. P6.4R crea el modulo correcto `openclaw-auth`.

---

## 3. Archivos Creados

### Backend: `apps/api/src/modules/openclaw-auth/`

| Archivo | Descripcion |
|---------|-------------|
| `types.ts` | OpenClawAuthState, events, transitions, health response types |
| `persistence.ts` | Load/save to `data/openclaw-auth-state.json` |
| `pairing-state.ts` | State machine, event processing, state updates |
| `auth-lifecycle.ts` | Connection/auth/capability checks, repair session |
| `session-check.ts` | Quick session validation, startup check |
| `capability-check.ts` | **isCapabilityActuallyUsable()**, scope management |
| `repair-flow.ts` | Repair session creation, completion, cleanup |
| `ws-events.ts` | WS event emission for state changes |
| `routes.ts` | Express router (for reference) |
| `handlers.ts` | Native HTTP handlers for index.ts |
| `index.ts` | Module exports |

---

## 4. Endpoints Implementados

### GET Endpoints

| Ruta | Descripcion |
|------|-------------|
| `/openclaw/health` | **CRITICAL** - Auth health status |
| `/openclaw/auth/status` | Quick session status |
| `/openclaw/auth/state` | Full auth state (debug) |
| `/openclaw/can-execute` | Can execute capabilities |
| `/openclaw/scopes-needing-auth` | List of scopes needing re-auth |
| `/openclaw/capability/:scopeKey` | Check specific scope usability |
| `/openclaw/auth/repair/active` | Get active repair session |
| `/openclaw/auth/repair/:sessionId` | Get repair session by ID |
| `/openclaw/quick-repair` | Create and return repair URL |

### POST Endpoints

| Ruta | Descripcion |
|------|-------------|
| `/openclaw/check` | Run full health check |
| `/openclaw/refresh` | Refresh session |
| `/openclaw/pre-check` | Pre-execution check |
| `/openclaw/auth/repair` | Create repair session |
| `/openclaw/auth/repair/:id/start` | Start repair session |
| `/openclaw/auth/repair/:id/complete` | Complete repair session |
| `/openclaw/auth/repair/:id/fail` | Fail repair session |
| `/openclaw/reset` | Reset auth state |
| `/openclaw/reload` | Reload from disk |

### DELETE Endpoints

| Ruta | Descripcion |
|------|-------------|
| `/openclaw/auth/repair/:sessionId` | Cancel repair session |

---

## 5. Funcion Critica: isCapabilityActuallyUsable()

```typescript
// apps/api/src/modules/openclaw-auth/capability-check.ts

export function isCapabilityActuallyUsable(scopeKey?: string): CapabilityUsabilityResult {
  const state = loadAuthState()

  // 1. Check overall state
  if (state.overall === 'disconnected') {
    return { usable: false, reason: 'OpenClaw is not connected', requiresAuth: false }
  }
  if (state.overall === 'expired' || state.overall === 'reauthorization_required') {
    return { usable: false, reason: 'OpenClaw requires re-authorization', requiresAuth: true, repairUrl: '/openclaw/repair' }
  }
  if (state.overall === 'repair_required') {
    return { usable: false, reason: 'OpenClaw requires manual repair', requiresAuth: true, repairUrl: '/openclaw/repair' }
  }

  // 2. Check specific scope
  if (scopeKey && state.scopesNeedingAuth.includes(scopeKey)) {
    return { usable: false, reason: `Scope ${scopeKey} requires re-authorization`, requiresAuth: true, scopeKey, repairUrl: ... }
  }

  // 3. Allow if paired or degraded
  if (state.overall === 'paired' || state.overall === 'degraded' || state.overall === 'connected') {
    return { usable: true, requiresAuth: false }
  }

  return { usable: false, reason: `Unknown state: ${state.overall}`, requiresAuth: false }
}
```

---

## 6. WebSocket Events

Eventos agregados a `runtime-ws/types.ts`:

```typescript
// P6.4R: OpenClaw auth events
| 'openclaw-connected'
| 'openclaw-disconnected'
| 'openclaw-degraded'
| 'pairing-expired'
| 'reauthorization-required'
| 'repair-required'
| 'pairing-restored'
| 'openclaw-health-change'
```

---

## 7. Persistencia

### Archivo: `data/openclaw-auth-state.json`

```json
{
  "overall": "unknown",
  "connection": "unknown",
  "auth": "unknown",
  "capability": "unknown",
  "scopesNeedingAuth": [],
  "recentEvents": [],
  "createdAt": "2026-05-09T...",
  "updatedAt": "2026-05-09T..."
}
```

Usa atomic-persistence para escritura segura con backup.

---

## 8. State Machine

### Estados

| Estado | Descripcion |
|--------|-------------|
| `unknown` | Inicial, sin checks |
| `disconnected` | OpenClaw no alcanzable |
| `connected` | Alcanzable pero sin auth |
| `paired` | Conectado + auth + capabilities OK |
| `degraded` | Conectado + auth pero scopes fallando |
| `reauthorization_required` | Auth expirado |
| `repair_required` | Issues criticos |
| `expired` | Session completamente expirada |

### Transiciones

| Estado Actual | Evento | Nuevo Estado |
|---------------|--------|--------------|
| unknown | connection_ok | connected |
| connected | auth_ok | paired |
| paired | capability_degraded | degraded |
| degraded | repair_completed | paired |
| reauthorization_required | auth_ok | paired |
| repair_required | repair_completed | paired |

---

## 9. Integracion Frontend

### api.ts

```typescript
// Nuevos tipos y funciones
export type OpenClawAuthState = 'unknown' | 'disconnected' | 'connected' | 'paired' | 'degraded' | 'reauthorization_required' | 'repair_required' | 'expired'

export interface OpenClawAuthHealthData {
  overall: OpenClawAuthState
  healthy: boolean
  canExecute: boolean
  issues: OpenClawAuthIssue[]
  repairAvailable: boolean
}

export async function getOpenClawAuthHealth(): Promise<...>
export async function runOpenClawAuthCheck(): Promise<...>
export async function isCapabilityUsable(scopeKey?: string): Promise<...>
```

### ProductDashboard.tsx

- Subscripcion a WS events de OpenClaw auth
- Estado `openclawHealth` separado de `pairingHealth`
- Load automatico on mount y on WS event

---

## 10. Startup Check

En `index.ts`:

```typescript
// P6.4R: OpenClaw Auth startup check (async, non-blocking)
runOpenClawStartupCheck().then((health) => {
  console.log(`[OpenClawAuth] Startup check: ${health.overall} ...`)
}).catch((err) => {
  console.warn('[OpenClawAuth] Startup check failed:', err.message)
})
```

---

## 11. Verificacion Final

| Requisito | Estado |
|-----------|--------|
| Modulo `apps/api/src/modules/openclaw-auth/` | CREADO |
| Archivo `types.ts` | CREADO |
| Archivo `pairing-state.ts` | CREADO |
| Archivo `auth-lifecycle.ts` | CREADO |
| Archivo `session-check.ts` | CREADO |
| Archivo `capability-check.ts` | CREADO |
| Archivo `repair-flow.ts` | CREADO |
| Archivo `persistence.ts` | CREADO |
| Archivo `handlers.ts` | CREADO |
| Archivo `index.ts` | CREADO |
| Endpoint `GET /openclaw/health` | REGISTRADO |
| Funcion `isCapabilityActuallyUsable()` | IMPLEMENTADA |
| Persistencia `data/openclaw-auth-state.json` | CONFIGURADA |
| WS events (openclaw-connected, etc.) | AGREGADOS |
| Dashboard integration | ACTUALIZADO |
| Startup check | CONFIGURADO |

---

## 12. Uso

### Backend

```typescript
import {
  isCapabilityActuallyUsable,
  runAuthHealthCheck,
  getAuthHealth
} from './modules/openclaw-auth'

// Check before execution
const result = isCapabilityActuallyUsable('os:browser')
if (!result.usable) {
  throw new Error(result.reason)
}

// Run full health check
const health = await runAuthHealthCheck()
```

### Frontend

```typescript
import { getOpenClawAuthHealth, isCapabilityUsable } from './services/api'

// Get health
const { data } = await getOpenClawAuthHealth()
if (data.canExecute) {
  // OK to execute
}

// Check specific scope
const { usable, reason, repairUrl } = await isCapabilityUsable('os:browser')
if (!usable && repairUrl) {
  // Redirect to repair
}
```

---

## 13. Diferencias vs P6.4 Original

| Aspecto | P6.4 Original (Incorrecto) | P6.4R (Correcto) |
|---------|----------------------------|------------------|
| Modulo | `pairing-state` | `openclaw-auth` |
| Endpoint | `/pairing/health` | `/openclaw/health` |
| WS events | `pairing:*` | `openclaw-*`, `pairing-*` |
| Funcion critica | No existia | `isCapabilityActuallyUsable()` |
| Persistencia | `pairing-state.json` | `openclaw-auth-state.json` |
| Archivos | 5 archivos | 10 archivos (completo) |

---

## 14. Conclusion

P6.4R implementa correctamente todos los requisitos especificados:

1. **Modulo correcto**: `apps/api/src/modules/openclaw-auth/`
2. **Endpoint correcto**: `GET /openclaw/health`
3. **Funcion critica**: `isCapabilityActuallyUsable()`
4. **Persistencia correcta**: `data/openclaw-auth-state.json`
5. **WS events correctos**: `openclaw-connected`, `openclaw-degraded`, `pairing-expired`, etc.
6. **Dashboard actualizado**: Subscripcion a eventos, estado separado
7. **Startup check**: Configurado y funcionando

El sistema esta listo para validar autenticacion antes de ejecuciones de capabilities.
