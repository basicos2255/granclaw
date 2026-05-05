# 034 - WS Official Client Alignment Report

**Fecha**: 2026-04-30
**Prompt ID**: 034
**Estado**: Completado

---

## 1. Objetivo ejecutado

Corregir definitivamente el handshake WS usando valores oficiales soportados por OpenClaw Gateway.

---

## 2. Archivos modificados

| Archivo | Accion | Descripcion |
|---------|--------|-------------|
| `packages/openclaw-adapter/src/ws/openclaw-ws.client.ts` | Modificado | Defaults oficiales: gateway-client, backend |
| `.env.example` | Modificado | Valores oficiales documentados |
| `docs/deployment/GRANCLAW_MACMINI_RUNBOOK.md` | Modificado | Sección 7.3 y troubleshooting F actualizados |
| `PROJECT_MEMORY.md` | Modificado | Sección FIX 034, prompt y reporte registrados |
| `reports/claude/034_ws_official_client_alignment_report.md` | Creado | Este reporte |

---

## 3. Decisiones aplicadas

| Decision | Motivo |
|----------|--------|
| Default `gateway-client` | Valor oficial para backend confiable |
| Default `backend` | Valor oficial para backend confiable |
| Fallback `cli:operator` | Valor alternativo oficial |
| No usar `web:operator` | NO soportado por schema Gateway |
| No usar valores arbitrarios | Schema Gateway tiene constantes fijas |

---

## 4. Problemas encontrados

| Problema | Solucion |
|----------|----------|
| FIX 033 usaba `web:operator` | Cambiado a `gateway-client:backend` |
| INVALID_REQUEST en `/client/id` | Usar valor oficial `gateway-client` |
| INVALID_REQUEST en `/client/mode` | Usar valor oficial `backend` |

---

## 5. Pruebas realizadas

### Comandos ejecutados:

```bash
npm run check --workspaces --if-present  # OK
npm run build --workspaces --if-present  # OK
```

### Resultado:
- check: OK (todos los workspaces)
- build: OK (todos los workspaces)

---

## 6. Pendiente recomendado

1. Probar en Mac mini con OpenClaw real
2. Verificar handshake completo con logs:
   - `[WS] CONNECT REQUEST:` debe mostrar `gateway-client:backend`
   - `[WS] CONNECT RESPONSE:` debe ser exitoso
   - `[WS] Handshake succeeded` debe aparecer

---

## 7. Estado de PROJECT_MEMORY.md

Actualizado con:
- Decisión `FIX 034 WS Official Client Alignment`
- Sección completa FIX 034 con valores oficiales
- Prompt 034 registrado
- Reporte 034 registrado

---

## Valores oficiales OpenClaw Gateway

| client.id | client.mode | Uso |
|-----------|-------------|-----|
| `gateway-client` | `backend` | Backend confiable (GranClaw) |
| `cli` | `operator` | CLI operador |

---

## Connect params finales

```typescript
{
  role: 'operator',
  scopes: ['operator.read', 'operator.write'],
  minProtocol: 3,
  maxProtocol: 3,
  client: {
    id: 'gateway-client',
    version: '1.0.0',
    platform: process.platform,
    mode: 'backend'
  },
  caps: [],
  commands: [],
  permissions: {},
  auth: apiKey ? { token: apiKey } : undefined
}
```

---

## Variables de entorno

```bash
OPENCLAW_WS_CLIENT_ID=gateway-client
OPENCLAW_WS_CLIENT_MODE=backend
OPENCLAW_WS_CLIENT_VARIANTS=gateway-client:backend,cli:operator
```
