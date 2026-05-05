# 032 - WS Runtime Alignment Report

**Fecha**: 2026-04-30
**Prompt ID**: 032
**Estado**: Completado

---

## 1. Objetivo ejecutado

Aislar y mejorar el cliente WebSocket para debug sin romper el sistema funcional
(REST, tools/invoke, orchestrator).

---

## 2. Archivos modificados

| Archivo | Accion | Descripcion |
|---------|--------|-------------|
| `packages/openclaw-adapter/src/ws/openclaw-ws.client.ts` | Modificado | Logging detallado, fallback auth |
| `apps/api/src/modules/openclaw/auth-check.service.ts` | Modificado | wsHandshakeResponse añadido |
| `PROJECT_MEMORY.md` | Modificado | Sección WS Runtime Alignment |
| `reports/claude/032_ws_runtime_alignment_report.md` | Creado | Este reporte |

---

## 3. Decisiones aplicadas

| Decision | Motivo |
|----------|--------|
| Logging con prefijo [WS] | Debug claro sin contaminar otros logs |
| Fallback de variantes auth | Descubrir qué formato acepta OpenClaw |
| Captura de lastError y lastHandshakeResponse | Diagnóstico sin reintentar |
| No modificar REST ni orchestrator | Sistema funcional intacto |
| WS opcional hasta validación | REST es camino principal actual |

---

## 4. Logging añadido

```
[WS] Connecting to: <url>
[WS] Connection opened
[WS] CONNECT REQUEST: { role, scopes, auth: [REDACTED], ... }
[WS] RAW MESSAGE: <raw data>
[WS] PARSED: <parsed frame>
[WS] CONNECT RESPONSE: <response>
[WS] Auth variant succeeded: raw token | Bearer token | no auth
[WS] Auth variant failed: <variant> - <error>
[WS] Handshake complete | failed
[WS] ERROR: <error>
[WS] Connection closed, code: <code>, reason: <reason>
```

---

## 5. Fallback de auth implementado

Orden de intento:
1. `auth: { token: API_KEY }` (raw)
2. `auth: { token: "Bearer " + API_KEY }`
3. sin auth

El cliente prueba cada variante y registra cuál funciona.

---

## 6. Cambios en auth-check.service.ts

```typescript
interface AuthCheckDetails {
  // ... existentes
  wsHandshakeResponse?: unknown  // NUEVO: captura respuesta de handshake
}
```

El endpoint `/openclaw/auth-status` ahora devuelve:
- `wsError`: último error
- `wsHandshakeResponse`: última respuesta del handshake (para debug)

---

## 7. Pruebas realizadas

```bash
npm run check --workspaces --if-present  # OK
npm run build --workspaces --if-present  # OK
```

---

## 8. Problemas encontrados

| Problema | Solucion |
|----------|----------|
| WS falla en handshake | Logging para diagnóstico |
| No sabemos qué variante auth acepta OpenClaw | Fallback automático con logging |
| No tenemos OpenClaw real para probar | Código preparado para debug en Mac mini |

---

## 9. Pendiente recomendado

1. Probar en Mac mini con OpenClaw real
2. Revisar logs `[WS]` para identificar:
   - Si WS conecta
   - Qué variante de auth funciona
   - Qué responde el handshake
3. Si WS funciona, implementar eventos de streaming
4. Si WS no funciona, documentar y mantener REST como principal

---

## 10. Estado de PROJECT_MEMORY.md

Actualizado con:
- Sección "WS Runtime Alignment"
- Estado actual de cada superficie (REST ok, WS opcional)
- Prompt 032 y reporte registrados

---

## Estado actual del sistema

| Superficie | Estado | Notas |
|------------|--------|-------|
| REST | OK | Funciona correctamente |
| /tools/invoke | OK | Funciona correctamente |
| Orchestrator | OK | Funciona con REST |
| WS | Opcional | Pendiente validación |
| Streaming real | NO | Pendiente eventos WS |
