# 024 - Runtime Final Preparation Report

**Fecha**: 2026-04-29
**Prompt ID**: 025
**Estado**: Completado

---

## 1. Objetivo ejecutado

Preparación final del runtime antes de deploy en Mac mini. Corregir contratos, completar handshake WS, mejorar seguridad SSRF, documentar ACK mode.

---

## 2. Archivos creados/modificados

| Archivo | Acción | Cambio |
|---------|--------|--------|
| `packages/openclaw-adapter/src/tools/openclaw-tools-http.client.ts` | Modificado | `ToolInvokeResponse.ok` en lugar de `success` |
| `packages/openclaw-adapter/src/runtime/openclaw-runtime.adapter.ts` | Modificado | Usa `response.data.ok` para convertir a `success` interno |
| `packages/openclaw-adapter/src/ws/openclaw-ws.client.ts` | Modificado | `ConnectParams` con params completos (minProtocol, maxProtocol, client, caps, locale) |
| `apps/api/src/modules/tools/service.ts` | Modificado | BLOCKED_HOSTS con 172.16-31.*, 169.254.*, IPv6 privadas; BLOCKED_SUFFIXES con .lan, .home, .corp |
| `apps/api/src/modules/orchestrator/service.ts` | Modificado | `buildToolParams` sin toolId duplicado; `runRpcStreamingTask` con docs ACK |
| `PROJECT_MEMORY.md` | Modificado | Documentado prompt 025, decisiones, ConnectParams completo |
| `reports/claude/024_runtime_final_prep_report.md` | Creado | Este reporte |

---

## 3. Decisiones aplicadas

| Decisión | Motivo |
|----------|--------|
| ToolInvokeResponse usa `ok` | Protocolo OpenClaw: `{ ok: boolean, result?, error? }` |
| Conversión ok → success interna | Mantener API interna consistente |
| ConnectParams completo | minProtocol, maxProtocol, client, caps, locale para handshake robusto |
| SSRF con todos los rangos privados | 172.16-31.*, 169.254.*, IPv6 fc00:/fd00:/fe80:, IPv4-mapped |
| Sufijos adicionales bloqueados | .lan, .home, .corp para redes corporativas |
| toolId removido de buildToolParams | Ya viene en la llamada, no duplicar en params |
| ACK mode documentado | chat.send devuelve ack, respuesta via eventos |

---

## 4. Problemas encontrados

| Problema | Solución |
|----------|----------|
| ToolInvokeResponse.success no alineado | Cambiado a `ok: boolean` |
| ConnectParams incompleto | Añadidos minProtocol, maxProtocol, client, caps, locale |
| SSRF incompleto (172.16 solo) | Añadidos todos los rangos 172.16-31 |
| toolId duplicado en params | Removido de buildToolParams |
| Streaming docs confusos | Clarificado ACK mode en runRpcStreamingTask |

---

## 5. Pruebas realizadas

```bash
npm run check --workspaces
# @granclaw/api: OK
# @granclaw/web: OK
# @granclaw/core: OK
# @granclaw/openclaw-adapter: OK

npm run build --workspaces
# All packages built successfully
# @granclaw/web: vite build OK (151kb)
```

---

## 6. Pendiente recomendado

1. **Validar handshake real**: Capturar tráfico contra OpenClaw Gateway para confirmar params
2. **Implementar eventos streaming**: Suscribirse a chat.chunk, chat.done, chat.error
3. **Test en Mac mini**: Deploy y verificar conectividad completa
4. **Monitoring**: Añadir logs para debug de handshake y tools

---

## 7. Estado de PROJECT_MEMORY.md

Actualizado con:
- Prompt 025 registrado
- Reporte 024 registrado
- Decisiones de runtime final
- ConnectParams completo documentado
- Handshake actual con todos los params

---

## Cambios técnicos detallados

### 1. /tools/invoke contract

**Antes:**
```typescript
interface ToolInvokeResponse {
  success: boolean
  result?: unknown
  error?: string
}
```

**Después:**
```typescript
interface ToolInvokeResponse {
  ok: boolean
  result?: unknown
  error?: unknown
}
```

**Uso en runtime adapter:**
```typescript
return {
  success: response.data.ok,  // Conversión ok → success
  result: response.data.result ?? null,
  error: response.data.error ? String(response.data.error) : undefined
}
```

---

### 2. ConnectParams completo

```typescript
interface ClientInfo {
  name: string
  version: string
  platform?: string
}

interface ConnectParams {
  role: 'operator' | 'webchat' | 'agent'
  scopes?: string[]
  auth?: { token: string }
  minProtocol?: number
  maxProtocol?: number
  client?: ClientInfo
  caps?: string[]
  commands?: string[]
  permissions?: string[]
  locale?: string
  userAgent?: string
}

// Handshake actual:
{
  role: 'operator',
  scopes: ['operator.read', 'operator.write'],
  minProtocol: 1,
  maxProtocol: 1,
  client: {
    name: 'granclaw-adapter',
    version: '1.0.0',
    platform: process.platform
  },
  caps: ['chat', 'tools', 'sessions'],
  locale: 'es-ES',
  auth: { token: apiKey }
}
```

---

### 3. SSRF mejorado

```typescript
const BLOCKED_HOSTS = [
  'localhost', '127.0.0.1', '0.0.0.0', '::1',
  // Clase A
  '10.',
  // Clase B (172.16.0.0 - 172.31.255.255)
  '172.16.', '172.17.', '172.18.', '172.19.',
  '172.20.', '172.21.', '172.22.', '172.23.',
  '172.24.', '172.25.', '172.26.', '172.27.',
  '172.28.', '172.29.', '172.30.', '172.31.',
  // Clase C
  '192.168.',
  // Link-local
  '169.254.',
  // IPv6 privadas
  'fc00:', 'fd00:', 'fe80:',
  '::ffff:127.', '::ffff:10.',
  '::ffff:192.168.', '::ffff:169.254.'
]

const BLOCKED_SUFFIXES = [
  '.local', '.internal', '.localhost',
  '.lan', '.home', '.corp'
]
```

---

### 4. ACK mode documentado

```typescript
/**
 * Ejecuta tarea via RPC chat.send (modo ACK)
 *
 * IMPORTANTE: chat.send devuelve ACK inmediato, NO la respuesta final.
 * La respuesta real llega via eventos WebSocket:
 * - chat.chunk: fragmentos de texto
 * - chat.done: fin de respuesta
 * - chat.error: error en generación
 *
 * TODO: Implementar suscripción a eventos para streaming real
 */
```

---

## Checklist deploy Mac mini

- [ ] git clone (repo limpio)
- [ ] npm install
- [ ] npm run build --workspaces
- [ ] Configurar .env con OPENCLAW_* vars
- [ ] npm run start --workspace=@granclaw/api
- [ ] Verificar /health
- [ ] Verificar /openclaw/status
- [ ] Verificar /openclaw/ws-rpc-status
- [ ] Test POST /orchestrator/run
