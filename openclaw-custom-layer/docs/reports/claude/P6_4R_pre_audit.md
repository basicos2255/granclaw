# P6.4R - Pre-Audit Report

**Fecha:** 2026-05-09
**Autor:** Claude
**Estado:** Auditoría Completada

---

## 1. Objetivo

Auditar el estado REAL del proyecto antes de implementar P6.4R:
- Persistent Pairing
- Auth Lifecycle
- Route Consistency

---

## 2. Resultados de Auditoría

### 2.1 Módulo openclaw-auth

| Item | Esperado | Estado |
|------|----------|--------|
| `apps/api/src/modules/openclaw-auth/` | Existe | **NO EXISTE** |
| `pairing-state.ts` | Existe | NO |
| `auth-lifecycle.ts` | Existe | NO |
| `session-check.ts` | Existe | NO |
| `capability-check.ts` | Existe | NO |
| `repair-flow.ts` | Existe | NO |
| `persistence.ts` | Existe | NO |
| `types.ts` | Existe | NO |
| `index.ts` | Existe | NO |

**Nota:** Existe un módulo `pairing-state` que fue creado incorrectamente. Debe ser reemplazado por `openclaw-auth`.

### 2.2 Endpoints

| Endpoint | Esperado | Estado |
|----------|----------|--------|
| `GET /openclaw/health` | Existe | **NO EXISTE** |
| `POST /openclaw/check` | Existe | NO |
| `POST /openclaw/repair` | Existe | NO |

### 2.3 Funciones Críticas

| Función | Esperado | Estado |
|---------|----------|--------|
| `isCapabilityActuallyUsable()` | Existe | **NO EXISTE** |
| `checkPairingStatus()` | Existe | NO |
| `runAuthHealthCheck()` | Existe | NO |

### 2.4 Persistencia

| Item | Esperado | Estado |
|------|----------|--------|
| `data/openclaw-auth-state.json` | Usado | **NO EXISTE** |

**Nota:** Existe `data/pairing-state.json` del módulo incorrecto.

### 2.5 WebSocket Events

| Evento | Esperado | Estado |
|--------|----------|--------|
| `openclaw-connected` | Emitido | **NO EXISTE** |
| `openclaw-degraded` | Emitido | NO |
| `pairing-expired` | Emitido | NO |
| `reauthorization-required` | Emitido | NO |
| `repair-required` | Emitido | NO |
| `pairing-restored` | Emitido | NO |

### 2.6 Route Consistency

| Item | Esperado | Estado |
|------|----------|--------|
| `/tasks/new` no existe | Usar `/tasks?create=true` | **CORREGIDO** |

---

## 3. Módulo Existente (Incorrecto)

El módulo `apps/api/src/modules/pairing-state/` fue creado pero:
- Nombre incorrecto (debería ser `openclaw-auth`)
- No tiene los archivos requeridos por el spec
- Endpoints bajo `/pairing/*` en lugar de `/openclaw/*`
- WS events usan `pairing:*` en lugar de los nombres requeridos

---

## 4. Plan de Acción

### FASE 1: Crear módulo openclaw-auth
- [ ] `apps/api/src/modules/openclaw-auth/types.ts`
- [ ] `apps/api/src/modules/openclaw-auth/pairing-state.ts`
- [ ] `apps/api/src/modules/openclaw-auth/auth-lifecycle.ts`
- [ ] `apps/api/src/modules/openclaw-auth/session-check.ts`
- [ ] `apps/api/src/modules/openclaw-auth/capability-check.ts`
- [ ] `apps/api/src/modules/openclaw-auth/repair-flow.ts`
- [ ] `apps/api/src/modules/openclaw-auth/persistence.ts`
- [ ] `apps/api/src/modules/openclaw-auth/routes.ts`
- [ ] `apps/api/src/modules/openclaw-auth/index.ts`

### FASE 2: Crear endpoints
- [ ] `GET /openclaw/health`
- [ ] `POST /openclaw/check`
- [ ] `POST /openclaw/repair`

### FASE 3: Crear funciones críticas
- [ ] `isCapabilityActuallyUsable()`
- [ ] `checkPairingStatus()`
- [ ] `runAuthHealthCheck()`

### FASE 4: WS Events
- [ ] Agregar event types a runtime-ws
- [ ] Implementar emitters para cada evento

### FASE 5: Registrar en index.ts
- [ ] Import openclaw-auth routes
- [ ] Register en Express app

---

## 5. Conclusión

**Estado actual: P6.4 NO IMPLEMENTADO CORRECTAMENTE**

Se requiere crear el módulo `openclaw-auth` completo desde cero con:
- Nombres correctos de archivos
- Endpoints bajo `/openclaw/*`
- WS events con nombres correctos
- Persistencia en `data/openclaw-auth-state.json`
