# 025 - Pre Mac mini Ready Report

**Fecha**: 2026-04-29
**Prompt ID**: 026
**Estado**: Completado

---

## 1. Objetivo ejecutado

Aplicar FIX 025 para dejar el sistema listo para validación en Mac mini. Correcciones quirúrgicas sin features nuevas.

---

## 2. Archivos creados/modificados

| Archivo | Accion | Cambio |
|---------|--------|--------|
| `packages/openclaw-adapter/src/ws/openclaw-ws.client.ts` | Modificado | ClientInfo.id, handshake v3 completo |
| `apps/api/src/modules/orchestrator/types.ts` | Modificado | StreamMode: 'ack' en lugar de 'stream' |
| `apps/api/src/modules/orchestrator/service.ts` | Modificado | mode: 'ack' en runRpcStreamingTask |
| `apps/web/src/components/chat/types.ts` | Modificado | mode: 'ack' |
| `apps/web/src/services/api.ts` | Modificado | mode: 'ack' |
| `apps/web/src/components/chat/Chat.tsx` | Modificado | "ACK mode (streaming real pendiente)" |
| `apps/web/src/pages/chat/index.tsx` | Modificado | Sin referencia a streaming |
| `packages/openclaw-adapter/src/tools/openclaw-tools-http.client.ts` | Modificado | Doc seguridad /tools/invoke |
| `PROJECT_MEMORY.md` | Modificado | FIX 025 documentado, handshake actualizado |
| `reports/claude/025_pre_macmini_ready_report.md` | Creado | Este reporte |

---

## 3. Decisiones aplicadas

| Decision | Motivo |
|----------|--------|
| Handshake v3 (minProtocol/maxProtocol: 3) | Protocolo oficial OpenClaw Gateway |
| ClientInfo.id en lugar de name | Alineado con spec oficial |
| caps/commands vacíos, permissions {} | Mínimo necesario, validar en runtime |
| locale: 'en' | Default neutral |
| userAgent: 'granclaw-client' | Identificación del cliente |
| StreamMode 'ack' | Refleja realidad: no hay streaming, solo ACK |
| UI sin referencias a streaming real | Evitar confusión al usuario |
| /tools/invoke doc seguridad | Endpoint sensible, solo loopback/privado |

---

## 4. Problemas encontrados

| Problema | Solucion |
|----------|----------|
| Handshake con params obsoletos | Actualizado a v3 completo |
| mode: 'stream' confuso | Cambiado a 'ack' en todo el sistema |
| UI dice "Streaming mode" | Cambiado a "ACK mode" |
| /tools/invoke sin warning | Añadida documentación de seguridad |
| dist/ y tsbuildinfo en repo | Limpiados |

---

## 5. Pruebas realizadas

```bash
# Limpieza artefactos
rm -rf apps/api/dist apps/web/dist packages/*/dist
rm -f apps/web/tsconfig.node.tsbuildinfo

# Verificación TypeScript
npm run check --workspaces --if-present
# @granclaw/api: OK
# @granclaw/web: OK
# @granclaw/core: OK
# @granclaw/openclaw-adapter: OK

# Build completo
npm run build --workspaces --if-present
# @granclaw/api: OK
# @granclaw/web: OK (151kb)
# @granclaw/core: OK
# @granclaw/openclaw-adapter: OK
```

---

## 6. Pendiente recomendado

1. **Validar handshake en runtime real**: Capturar tráfico contra OpenClaw Gateway
2. **Implementar eventos streaming**: Suscribirse a chat.chunk, chat.done, chat.error
3. **Test de conectividad**: Verificar /health, /openclaw/status en Mac mini
4. **Logs de debug**: Añadir logging para handshake failures

---

## 7. Estado de PROJECT_MEMORY.md

Actualizado con:
- Sección FIX 025 - Pre Mac mini Ready
- Prompt 026 registrado
- Reporte 025 registrado
- Handshake actual actualizado a v3
- ClientInfo.id documentado

---

## Checklist deploy Mac mini

```bash
# 1. Clonar repo limpio
git clone <repo>
cd openclaw-custom-layer

# 2. Instalar dependencias
npm install

# 3. Build
npm run build --workspaces

# 4. Configurar variables
export OPENCLAW_BASE_URL=...
export OPENCLAW_WS_URL=...
export OPENCLAW_API_KEY=...
export APP_PORT=3001

# 5. Arrancar
npm run start --workspace=@granclaw/api

# 6. Verificar
curl http://localhost:3001/health
curl http://localhost:3001/openclaw/status
curl http://localhost:3001/openclaw/ws-rpc-status
```

---

## Handshake WS actualizado

```typescript
{
  role: 'operator',
  scopes: ['operator.read', 'operator.write'],
  minProtocol: 3,
  maxProtocol: 3,
  client: {
    id: 'granclaw',
    version: '1.0.0',
    platform: process.platform,
    mode: 'operator'
  },
  caps: [],
  commands: [],
  permissions: {},
  locale: 'en',
  userAgent: 'granclaw-client',
  auth: apiKey ? { token: apiKey } : undefined
}
```

---

## StreamMode actualizado

```typescript
// Antes
type StreamMode = 'stream' | 'fallback' | 'tool'

// Despues
type StreamMode = 'ack' | 'fallback' | 'tool'
```

---

## Seguridad /tools/invoke

```typescript
/**
 * /tools/invoke es superficie de operador completo.
 * - Debe usarse solo en loopback o red privada.
 * - Nunca exponer publicamente.
 */
```
