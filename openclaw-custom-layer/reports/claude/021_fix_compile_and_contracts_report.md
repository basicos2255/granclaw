# 021 - Fix Compile and Contracts Report

**Fecha**: 2026-04-29
**Prompt ID**: 022
**Estado**: Completado

---

## Objetivo

Corregir todos los bloqueadores de compilación detectados en auditoría estática del proyecto GranClaw.

---

## Problemas identificados

### 1. Import `json()` faltante en tools/routes.ts
- **Archivo**: `apps/api/src/shared/response.ts`
- **Error**: `tools/routes.ts` importa `json` pero no existía
- **Fix**: Añadida función `json<T>()` que envía respuesta JSON directa

### 2. Imports de workspace rotos
- **Archivos afectados**:
  - `openclaw-runtime.adapter.ts`
  - `openclaw-taskflow.adapter.ts`
  - `openclaw-webhook.adapter.ts`
  - `openclaw-config.adapter.ts`
- **Error**: Usaban rutas relativas `../../../core/src/...` violando rootDir
- **Fix**: Cambiados a `from '@granclaw/core'`

### 3. TypeScript configuration
- **Archivos afectados**:
  - `packages/openclaw-adapter/tsconfig.json`
  - `apps/api/tsconfig.json`
- **Error**: Faltaban `types: ["node"]` y `moduleResolution: "node"`
- **Fix**: Añadidos a compilerOptions

### 4. Core package.json
- **Archivo**: `packages/core/package.json`
- **Error**: Faltaba `@types/node` en devDependencies
- **Fix**: Añadido `"@types/node": "^20.0.0"`

### 5. REST orchestrator no usaba OpenClawRestClient
- **Archivo**: `apps/api/src/modules/orchestrator/service.ts`
- **Error**: `runOpenClawTask` usaba fetch manual en lugar del cliente
- **Fix**:
  - Añadido singleton `getRestClient()`
  - Refactorizado `runOpenClawTask` para usar `OpenClawRestClient.postChatCompletion()`
  - Eliminado parámetro `config` innecesario

### 6. WS/RPC streaming sin TODO claro
- **Archivo**: `packages/openclaw-adapter/src/ws/openclaw-chat.rpc.ts`
- **Error**: No estaba claro que `chat.send` NO devuelve respuesta final
- **Fix**: Añadido TODO detallado explicando el patrón de streaming:
  ```typescript
  /**
   * TODO: IMPORTANTE - chat.send NO devuelve la respuesta final.
   * Solo devuelve confirmación de envío. La respuesta real llega via
   * eventos de streaming (chat.chunk, chat.done, etc).
   */
  ```

### 7. OpenClawToolsHttpClient no exportado
- **Archivo**: `packages/openclaw-adapter/src/index.ts`
- **Error**: Cliente HTTP para tools no estaba en exports principales
- **Fix**: Añadido `export { OpenClawToolsHttpClient } from './tools'`

### 8. OpenClawChatRpc no exportado
- **Archivo**: `packages/openclaw-adapter/src/index.ts`
- **Error**: Wrapper RPC de chat no estaba exportado
- **Fix**: Actualizado `export { OpenClawWsClient, OpenClawChatRpc, OpenClawToolsRpc } from './ws'`

### 9. Error de tipos en sessions service
- **Archivo**: `apps/api/src/modules/sessions/service.ts`
- **Error**: `storage.update()` no infería tipo correctamente
- **Fix**: Especificado tipo explícito `storage.update<Session>(...)`

---

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `apps/api/src/shared/response.ts` | Añadida función `json()` |
| `packages/core/src/index.ts` | Imports con `/index` suffix |
| `packages/core/package.json` | Añadido `@types/node` |
| `packages/openclaw-adapter/src/runtime/openclaw-runtime.adapter.ts` | Import `@granclaw/core` |
| `packages/openclaw-adapter/src/taskflow/openclaw-taskflow.adapter.ts` | Import `@granclaw/core` |
| `packages/openclaw-adapter/src/webhook/openclaw-webhook.adapter.ts` | Import `@granclaw/core` |
| `packages/openclaw-adapter/src/config/openclaw-config.adapter.ts` | Import `@granclaw/core` |
| `packages/openclaw-adapter/tsconfig.json` | `types`, `moduleResolution` |
| `apps/api/tsconfig.json` | `types`, `moduleResolution` |
| `apps/api/src/modules/orchestrator/service.ts` | Singleton REST client |
| `packages/openclaw-adapter/src/ws/openclaw-chat.rpc.ts` | TODO streaming |
| `packages/openclaw-adapter/src/index.ts` | Exports adicionales |
| `apps/api/src/modules/sessions/service.ts` | Tipo explícito en update |

---

## Verificación

```bash
npm install
# added 89 packages

npm run check
# @granclaw/api: OK
# @granclaw/core: OK
# @granclaw/openclaw-adapter: OK
```

**Build pasa sin errores.**

---

## Auth verification

Verificado que todas las rutas protegidas:
1. Validan contexto de autenticación
2. Usan `context.tenant.id` para filtrar datos
3. Devuelven 401 si no hay token válido

**Endpoints públicos**: `/health`, `/auth/login`, `/openclaw/status`, `/openclaw/ws-status`, `/openclaw/ws-rpc-status`, `/openclaw/tools-status`

---

## Decisiones técnicas

| Decisión | Motivo |
|----------|--------|
| Singleton `restClient` | Evita crear múltiples instancias del cliente |
| Tipo explícito en `storage.update<Session>` | TypeScript no puede inferir el tipo correcto |
| TODO detallado en `chatSend` | Evita confusión sobre el patrón de streaming RPC |
| Exportar `OpenClawToolsHttpClient` | Es la vía documentada preferida sobre RPC |

---

## Próximos pasos sugeridos

1. Implementar streaming HTTP real (SSE) para frontend
2. Implementar suscripción a eventos de chat.chunk/chat.done
3. Validar payloads RPC contra OpenClaw real
4. Añadir tests de integración

---

## Notas

- El error de IDE "Cannot find type definition file for 'node'" se resuelve con `npm install`
- Los imports de workspace (`@granclaw/*`) funcionan correctamente con npm workspaces
- El refactor de `runOpenClawTask` simplifica el código eliminando duplicación
