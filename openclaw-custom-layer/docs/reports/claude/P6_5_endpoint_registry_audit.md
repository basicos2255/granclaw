# P6.5 - Endpoint Registry Audit Report

**Fecha:** 2026-05-09
**Autor:** Claude
**Estado:** Completado

---

## 1. Backend Routes Registradas (index.ts)

### GET Routes (Estaticas)

| Endpoint | Handler | Estado |
|----------|---------|--------|
| `/health` | handleHealth | OK |
| `/tenants` | handleTenants | OK |
| `/users` | handleUsers | OK |
| `/presets` | handlePresets | OK |
| `/agents` | handleAgents | OK |
| `/sessions` | handleListSessions | OK |
| `/tasks` | handleTasks | OK |
| `/tool-proposals` | handleGetToolProposals | OK |
| `/capabilities` | handleGetCapabilities | OK |
| `/audit` | handleAudit | OK |
| `/tools` | handleListTools | OK |
| `/openclaw/status` | handleOpenClawStatus | OK |
| `/openclaw/ws-status` | handleOpenClawWsStatus | OK |
| `/openclaw/ws-rpc-status` | handleWsRpcStatus | OK |
| `/openclaw/tools-status` | handleToolsStatus | OK |
| `/openclaw/auth-status` | handleAuthStatus | OK |
| `/openclaw/check-auth` | handleCheckAuth | OK |
| `/system/state` | handleGetSystemState | OK |
| `/system/pending-action` | handleGetPendingAction | OK |
| `/auth/me` | handleGetMe | OK |
| `/granclaw-hub/config` | handleGetAllConfig | OK |
| `/os-tools` | handleGetOSTools | OK |
| `/os-tools/pending` | handleGetPendingConfirmations | OK |
| `/execution-policy` | handleGetExecutionPolicy | OK |
| `/openclaw/repair/active` | handleGetActiveRepairs | OK |
| `/openclaw/repair/history` | handleGetRepairHistory | OK |
| `/task-memory/patterns` | handleGetPatterns | OK |
| `/task-memory/stats` | handleGetStats | OK |
| `/composite-tasks` | handleGetCompositeTasks | OK |
| `/composite-tasks/stats` | handleGetCompositeStats | OK |
| `/dag/executions` | handleListDagExecutions | OK |
| `/dag/config` | handleGetDagConfig | OK |
| `/queue/stats` | handleGetQueueStats | OK |
| `/queue/jobs` | handleListJobs | OK |
| `/queue/dead-letter` | handleListDeadLetter | OK |
| `/queue/events` | handleGetEvents | OK |
| `/queue/health` | handleQueueHealth | OK |
| `/runtime/state` | handleGetRuntimeState | OK |
| `/runtime/health` | handleGetRuntimeHealth | OK |
| `/runtime/consistency` | handleGetConsistency | OK |
| `/pairing/state` | handleGetPairingState | OK |
| `/pairing/health` | handleGetPairingHealth | OK |
| `/pairing/combined` | handleGetCombinedHealth | OK |
| `/openclaw/health` | handleGetOpenClawHealth | OK |
| `/openclaw/auth/status` | handleGetOpenClawStatus | OK |
| `/openclaw/auth/state` | handleGetOpenClawState | OK |
| `/openclaw/can-execute` | handleCanExecute | OK |
| `/openclaw/scopes-needing-auth` | handleGetScopesNeedingAuth | OK |
| `/openclaw/auth/repair/active` | handleGetActiveOpenClawRepair | OK |
| `/openclaw/quick-repair` | handleQuickRepair | OK |

---

## 2. Endpoints Usados por Dashboard

| Endpoint | Backend | Frontend | Estado |
|----------|---------|----------|--------|
| `/runtime/state` | REGISTRADO | api.ts:getRuntimeState | OK |
| `/openclaw/health` | REGISTRADO | api.ts:getOpenClawAuthHealth | OK |
| `/pairing/health` | REGISTRADO | api.ts:getPairingHealth | OK |

---

## 3. Endpoints Legacy vs Canonicos

| Legacy | Canonico (P6.4R) | Ambos Existen |
|--------|------------------|---------------|
| `/pairing/health` | `/openclaw/health` | SI |
| `/pairing/state` | `/openclaw/auth/state` | SI |

**Nota:** Ambos endpoints funcionan. `/pairing/*` es legacy pero sigue soportado. `/openclaw/*` es el canonico para P6.4R.

---

## 4. Frontend Endpoint Registry

Creado archivo: `apps/web/src/services/endpoints.ts`

Contiene definiciones canonicas para todos los endpoints, evitando strings hardcodeados.

---

## 5. Conclusion

Todos los endpoints usados por el Dashboard ESTAN correctamente registrados en el backend:
- `/health`
- `/runtime/state`
- `/runtime/health`
- `/pairing/health`
- `/openclaw/health`

El error ERR_CONNECTION_REFUSED ocurre SOLO cuando el backend no esta corriendo.
