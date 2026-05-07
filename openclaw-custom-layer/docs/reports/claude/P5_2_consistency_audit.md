# P5.2 Consistency Audit

**Fecha:** 2026-05-07
**Autor:** Claude (Arquitecto Enterprise)

## Config Drift

### Environment Variables

| Variable | Status | Replacement |
|----------|--------|-------------|
| `VITE_API_URL` | DEPRECATED | `VITE_API_BASE_URL` |
| `VITE_WS_URL` | DEPRECATED | `VITE_WS_BASE_URL` |
| `VITE_API_PORT` | DEPRECATED | `VITE_WS_BASE_URL` |

Backward compatibility maintained in:
- `api.ts` - checks both old and new
- `runtime-ws.ts` - checks both old and new

## Status Drift

### Canonical Status Enums

| Domain | Statuses |
|--------|----------|
| Queue | pending, running, completed, failed, dead-lettered |
| Task | pending, running, success, blocked, error, unconfirmed |
| Workflow | pending, running, completed, failed, cancelled, validation_failed |
| Node | pending, queued, running, completed, validated, failed, skipped, blocked |
| Proposal | pending, approved, rejected, archived |
| Requirement | active, resolved |
| Repair | pending, waiting_user, checking, ready, failed, cancelled |

**Finding:** No conflicts detected. Each domain has distinct statuses.

## Provider Drift

### Provider Types

| Role | Values |
|------|--------|
| Execution Provider | openclaw, local, task_memory, capability, proposal |
| Channel Provider | email, whatsapp, browser, ftp, calendar, api, webhook |

### Adapter Types

| Type | Description |
|------|-------------|
| openclaw-runtime-adapter | OpenClaw WS/REST communication |
| channel-adapters | Per-channel protocol adapters |

**Finding:** Clear separation between providers and adapters.

## Route Drift

### Backend Routes (No Duplicates)

- `/health` - Health check
- `/auth/*` - Authentication
- `/tenants`, `/users`, `/agents`, `/sessions`, `/presets`
- `/tasks/*` - Task management
- `/tool-proposals/*`, `/capabilities/*`
- `/os-tools/*` - OS tool confirmations
- `/orchestrator/*` - Execution orchestration
- `/task-memory/*`, `/composite-tasks/*`
- `/dag/*` - DAG execution
- `/queue/*` - Runtime queue
- `/runtime/*` - Runtime state
- `/granclaw-hub/*` - Hub config
- `/openclaw/*` - OpenClaw status/repair
- `/system/*` - System state
- `/execution-policy` - Execution policy

### Frontend Routes (No Duplicates)

- `/`, `/dashboard` - Product dashboard
- `/tasks`, `/automations`, `/channels/*`
- `/credentials`, `/approvals`, `/notifications`
- `/runtime`, `/settings`
- `/control/*` - Technical panel
- `/dev/*` - Development tools
- `/login`, `/register`

**Finding:** No duplicate or conflicting routes.

## Legacy Fetches

### Direct Fetches Audit

| File | Status |
|------|--------|
| `api.ts` | Centralized - uses `API_BASE` |
| `ProductDashboard.tsx` | Uses `getRuntimeState()` |
| `RuntimePage.tsx` | Uses `getRuntimeState()` |

**Finding:** All fetches centralized through `api.ts`.

## WS Inconsistencies

**Finding:** WebSocket is primary for realtime. REST is fallback. No aggressive polling detected.

## Deprecated Code Inventory

| Item | Location | Status |
|------|----------|--------|
| `VITE_API_URL` | .env.example | Documented as deprecated |
| `VITE_WS_URL` | .env.example | Documented as deprecated |
| `VITE_API_PORT` | runtime-ws.ts | Documented as deprecated |

**Recommendation:** Remove deprecated env vars in future major version.

## Queue Bypass Check

**Finding:** Queue and scheduler maintain authority. DAG execution and composite task handlers registered.

## Summary

| Area | Status |
|------|--------|
| Config naming | UNIFIED (with backward compat) |
| API client | CENTRALIZED |
| Routes | CONSISTENT |
| Statuses | CANONICAL |
| Providers | CLEAR |
| WS/REST | WS-PRIMARY |
| Queue authority | MAINTAINED |
| Legacy code | DOCUMENTED |
