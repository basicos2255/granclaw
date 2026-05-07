# P5.2 — Consistency Hardening & Technical Debt Cleanup

**Fecha:** 2026-05-07
**Autor:** Claude (Arquitecto Enterprise)
**Estado:** COMPLETADO

## Objetivo Ejecutado

Cerrar inconsistencias y deuda técnica antes de escalar GranClaw, asegurando:
- Config naming unificado
- API client centralizado
- Routes sin duplicados
- Status enums canónicos
- Provider/adapter roles claros
- WS-first architecture
- Queue authority maintained

## FASE A: Config Consistency

### Cambios Realizados

| Archivo | Cambio |
|---------|--------|
| `.env.example` | Renombrado `VITE_API_URL` → `VITE_API_BASE_URL`, `VITE_WS_URL` → `VITE_WS_BASE_URL` |
| `api.ts` | Backward compat: acepta ambos nombres |
| `runtime-ws.ts` | Backward compat: acepta ambos nombres |

### Variables Canónicas

```bash
VITE_API_BASE_URL=http://localhost:3001
VITE_WS_BASE_URL=ws://localhost:3001
```

### Deprecados (con backward compat)

- `VITE_API_URL` → usar `VITE_API_BASE_URL`
- `VITE_WS_URL` → usar `VITE_WS_BASE_URL`
- `VITE_API_PORT` → usar `VITE_WS_BASE_URL`

## FASE B: API Client Consolidation

### Estado

**CENTRALIZADO** - Todos los fetches pasan por `api.ts`

### Patrón Usado

```typescript
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResult<T>>
```

### Archivos Auditados

| Archivo | Estado |
|---------|--------|
| `api.ts` | Central - define `API_BASE` |
| `ProductDashboard.tsx` | Usa `getRuntimeState()` de api.ts |
| `RuntimePage.tsx` | Usa `getRuntimeState()` de api.ts |
| Resto de componentes | Sin fetches directos |

## FASE C: Route Consistency

### Backend Routes (Sin Duplicados)

```
/health, /auth/*, /tenants, /users, /agents, /sessions, /presets
/tasks/*, /tool-proposals/*, /capabilities/*, /os-tools/*
/orchestrator/*, /task-memory/*, /composite-tasks/*
/dag/*, /queue/*, /runtime/*, /granclaw-hub/*
/openclaw/*, /system/*, /execution-policy
```

### Frontend Routes (Sin Duplicados)

```
/, /dashboard, /tasks, /automations, /channels/*
/credentials, /approvals, /notifications, /runtime, /settings
/control/*, /dev/*, /login, /register
```

### Resultado

**NO HAY RUTAS DUPLICADAS NI CONFLICTOS**

## FASE D: Status Normalization

### Canonical Status Enums

| Dominio | Estados |
|---------|---------|
| **Queue** | `pending`, `running`, `completed`, `failed`, `dead-lettered` |
| **Task** | `pending`, `running`, `success`, `blocked`, `error`, `unconfirmed` |
| **Workflow** | `pending`, `running`, `completed`, `failed`, `cancelled`, `validation_failed` |
| **Node** | `pending`, `queued`, `running`, `completed`, `validated`, `failed`, `skipped`, `blocked` |
| **Proposal** | `pending`, `approved`, `rejected`, `archived` |
| **Requirement** | `active`, `resolved` |
| **Repair** | `pending`, `waiting_user`, `checking`, `ready`, `failed`, `cancelled` |

### Resultado

**SIN CONFLICTOS** - Cada dominio tiene estados distintos y bien definidos.

## FASE E: Provider/Adapter Cleanup

### Provider Types (Execution)

| Provider | Descripción |
|----------|-------------|
| `openclaw` | OpenClaw runtime execution |
| `local` | Local tool execution |
| `task_memory` | Task memory retrieval |
| `capability` | Capability-based execution |
| `proposal` | Proposal workflow execution |

### Channel Providers

| Channel | Protocolo |
|---------|-----------|
| `email` | SMTP/IMAP |
| `whatsapp` | WhatsApp API |
| `browser` | Puppeteer/Playwright |
| `ftp` | FTP/SFTP |
| `calendar` | CalDAV/Google |
| `api` | REST/GraphQL |
| `webhook` | HTTP callbacks |

### Adapter Types

| Adapter | Función |
|---------|---------|
| `openclaw-runtime-adapter` | WS/REST communication con OpenClaw |
| `channel-adapters` | Protocol adapters por canal |

### Resultado

**CLARA SEPARACIÓN** entre providers (qué ejecuta) y adapters (cómo comunica).

## FASE F-G: WS/REST Consistency

### Arquitectura

```
WS = PRIMARY (realtime events)
REST = FALLBACK (polling cada 30s como backup)
```

### Verificación

- `ProductDashboard.tsx`: WS events con REST fallback cada 30s
- `RuntimePage.tsx`: WS events con REST fallback
- No hay polling agresivo detectado

### Resultado

**WS-FIRST ARCHITECTURE MAINTAINED**

## FASE H-K: Runtime/Logging/Types/Legacy

### Runtime Consistency

- Queue y Scheduler mantienen autoridad
- DAG execution handler registrado
- Composite task handler registrado
- No hay bypasses detectados

### Logging

- Console.log usado consistentemente
- Timestamps en frames WS
- Error handling con mensajes claros

### Legacy Code Inventory

| Item | Ubicación | Estado |
|------|-----------|--------|
| `VITE_API_URL` | .env.example | DEPRECATED (documented) |
| `VITE_WS_URL` | .env.example | DEPRECATED (documented) |
| `VITE_API_PORT` | runtime-ws.ts | DEPRECATED (documented) |

**Recomendación:** Remover en próxima major version.

## FASE L: Readiness Endpoint

### Endpoint Creado

```
GET /runtime/consistency
```

### Response

```json
{
  "configDrift": {
    "envNaming": "UNIFIED",
    "deprecatedVars": ["VITE_API_URL", "VITE_WS_URL", "VITE_API_PORT"],
    "backwardCompatEnabled": true
  },
  "canonicalStatuses": {
    "queue": ["pending", "running", "completed", "failed", "dead-lettered"],
    "task": ["pending", "running", "success", "blocked", "error", "unconfirmed"],
    "workflow": ["pending", "running", "completed", "failed", "cancelled", "validation_failed"],
    "node": ["pending", "queued", "running", "completed", "validated", "failed", "skipped", "blocked"]
  },
  "providerRoles": {
    "execution": ["openclaw", "local", "task_memory", "capability", "proposal"],
    "channel": ["email", "whatsapp", "browser", "ftp", "calendar", "api", "webhook"]
  },
  "legacyInventory": {
    "count": 3,
    "items": ["VITE_API_URL", "VITE_WS_URL", "VITE_API_PORT"]
  },
  "queueBypassRisk": "NONE"
}
```

## FASE M: npm run check & build

### Check

```bash
$ npm run check
✓ No type errors
✓ No lint errors
```

### Build

```bash
$ npm run build
✓ Build completed successfully
✓ No warnings
```

## Riesgos Restantes

| Riesgo | Severidad | Mitigación |
|--------|-----------|------------|
| Deprecated env vars en producción | LOW | Backward compat activo |
| Legacy code acumulado | LOW | Inventariado para cleanup |
| Config drift futuro | LOW | Endpoint `/runtime/consistency` para monitoreo |

## Estado PROJECT_MEMORY.md

**ACTUALIZADO** con:
- Sección P5.2 completa
- Variables de entorno canónicas
- Status enums por dominio
- Provider/adapter roles
- Endpoint de consistency

## Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `apps/web/.env.example` | Unified env naming |
| `apps/web/src/services/api.ts` | Backward compat |
| `apps/web/src/services/runtime-ws.ts` | Backward compat |
| `apps/web/src/pages/product/ProductDashboard.tsx` | Updated error message |
| `apps/web/vite.config.ts` | Updated comment |
| `apps/api/src/modules/runtime-queue/runtime-routes.ts` | Added handleGetConsistency |
| `apps/api/src/index.ts` | Added /runtime/consistency route |

## Conclusión

P5.2 completado exitosamente. El sistema está listo para escalar con:
- Config unificado (con backward compat)
- API client centralizado
- Routes sin conflictos
- Status normalizados
- Provider/adapter roles claros
- WS-first architecture
- Queue authority maintained
- Endpoint de monitoreo de consistency

**Próximos pasos recomendados:**
1. Remover deprecated env vars en próxima major version
2. Monitorear `/runtime/consistency` en producción
3. Continuar con P6 (Scalability & Performance)
