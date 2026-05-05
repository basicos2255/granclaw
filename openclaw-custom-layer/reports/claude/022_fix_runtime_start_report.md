# 022 - Fix Runtime Start Report

**Fecha**: 2026-04-29
**Prompt ID**: 023
**Estado**: Completado

---

## 1. Objetivo ejecutado

Corregir todos los problemas que impiden ejecutar el sistema en entorno real antes de desplegar en Mac mini.

---

## 2. Archivos creados/modificados

| Archivo | Acción | Cambio |
|---------|--------|--------|
| `packages/core/package.json` | Modificado | `main: dist/index.js`, `types: dist/index.d.ts` |
| `packages/openclaw-adapter/package.json` | Modificado | `main: dist/index.js`, `types: dist/index.d.ts` |
| `packages/openclaw-adapter/src/ws/openclaw-ws.client.ts` | Modificado | ConnectParams.auth sin `type: bearer`, TODO campos adicionales |
| `packages/openclaw-adapter/src/ws/openclaw-chat.rpc.ts` | Modificado | ChatSendResult con `status: 'ack'` |
| `packages/openclaw-adapter/src/tools/openclaw-tools.rpc.ts` | Modificado | tools.execute DESHABILITADO, requiere flag experimental |
| `packages/openclaw-adapter/src/runtime/openclaw-runtime.adapter.ts` | Modificado | sendMessage devuelve ack, no respuesta |
| `apps/api/src/modules/tools/service.ts` | Modificado | Añadidos `.local`, `.internal`, redes privadas a bloqueados |
| `apps/api/src/shared/auth-context.ts` | Modificado | `/openclaw/tools-status` removido de públicos |
| `apps/api/src/index.ts` | Modificado | Console.log corregido |
| `apps/api/src/modules/orchestrator/service.ts` | Modificado | Usa status ack, TODO streaming |
| `PROJECT_MEMORY.md` | Modificado | Documentado fix runtime |
| `reports/claude/022_fix_runtime_start_report.md` | Creado | Este reporte |

---

## 3. Decisiones aplicadas

| Decisión | Motivo |
|----------|--------|
| package.json apunta a dist | ERR_UNSUPPORTED_DIR_IMPORT al importar desde src |
| auth sin `type: bearer` | Documentación indica solo `{ token: string }` |
| chat.send devuelve ack | NO devuelve respuesta final, streaming via eventos |
| tools.execute deshabilitado | Método NO CONFIRMADO, usar /tools/invoke HTTP |
| Flag OPENCLAW_TOOLS_RPC_EXPERIMENTAL | Permite habilitar tools.execute para pruebas |
| Bloquear .local, .internal | Seguridad adicional en httpTool |
| /tools y /openclaw/tools-status protegidos | Endpoints sensibles requieren auth |

---

## 4. Problemas encontrados

| Problema | Solución |
|----------|----------|
| ERR_UNSUPPORTED_DIR_IMPORT | package.json apunta a dist en lugar de src |
| ChatSendResult.response no existe | Cambiado a status: 'ack', streaming pendiente |
| type: bearer no documentado | Removido, solo auth.token |
| tools.execute no confirmado | Deshabilitado por defecto |
| Endpoints sensibles públicos | /tools y /openclaw/tools-status protegidos |

---

## 5. Pruebas realizadas

```bash
npm install
# added 89 packages

npm run check --workspaces
# @granclaw/api: OK
# @granclaw/core: OK
# @granclaw/openclaw-adapter: OK

npm run build --workspaces
# All packages built successfully
```

---

## 6. Pendiente recomendado

1. **Streaming real**: Implementar suscripción a eventos `chat.chunk`, `chat.done`, `chat.error`
2. **Validar payloads**: Capturar tráfico WS real contra OpenClaw
3. **Test en Mac mini**: Deploy y verificar arranque con `node dist/index.js`
4. **Limpiar antes de deploy**: Eliminar `node_modules/`, `dist/`, `data/` del repo

---

## 7. Estado de PROJECT_MEMORY.md

Actualizado con:
- Decisiones de fix runtime start
- Estado actual marcado como completado
- Prompt 023 registrado
- Reporte 022 registrado
- Nota sobre deploy desde repo limpio

---

## Nota importante para deploy

**NO usar ZIP contaminado con:**
- `node_modules/`
- `dist/`
- `data/`

**Proceso correcto:**
```bash
git clone <repo>
cd openclaw-custom-layer
npm install
npm run build --workspaces
npm run start --workspace=@granclaw/api
```

---

## Configuración de handshake WS corregida

```typescript
// ConnectParams actualizados
{
  role: 'operator',
  scopes: ['operator.read', 'operator.write'],
  auth: {
    token: apiKey  // Sin type: bearer
  }
}

// TODO pendientes:
// - minProtocol
// - maxProtocol
// - client/device
```

---

## tools.execute deshabilitado

```typescript
// Para habilitar (EXPERIMENTAL):
OPENCLAW_TOOLS_RPC_EXPERIMENTAL=true

// Método oficial:
POST /tools/invoke via OpenClawToolsHttpClient
```

---

## chat.send devuelve ack

```typescript
interface ChatSendResult {
  status: 'ack' | 'error'
  sessionId?: string
  error?: string
}

// La respuesta real llega via eventos:
// - chat.chunk
// - chat.done
// - chat.error
```
