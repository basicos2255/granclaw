# Report 020: Estabilización Build/Auth/RPC

**Fecha**: 2026-04-29
**Prompt ID**: 021
**Objetivo**: Estabilizar GranClaw antes de seguir con nuevas features

---

## 1. Objetivo Ejecutado

Estabilización completa del proyecto:
- Configuración de workspaces npm
- Autenticación real aplicada en todas las rutas
- Tenant isolation implementado
- Protocolo WS/RPC alineado con documentación OpenClaw
- REST completions con model obligatorio
- Cliente HTTP /tools/invoke documentado

---

## 2. Archivos Creados

| Archivo | Descripción |
|---------|-------------|
| package.json (root) | Workspaces npm con apps/* y packages/* |
| packages/core/package.json | @granclaw/core package |
| packages/core/tsconfig.json | TypeScript config para core |
| packages/openclaw-adapter/package.json | @granclaw/openclaw-adapter package |
| packages/openclaw-adapter/tsconfig.json | TypeScript config para adapter |
| packages/openclaw-adapter/src/tools/openclaw-tools-http.client.ts | Cliente HTTP documentado para /tools/invoke |

---

## 3. Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| apps/api/package.json | Añadidas dependencias @granclaw/* y script check |
| apps/api/src/index.ts | Auth middleware aplicado, handlers con context |
| apps/api/src/shared/auth-context.ts | Añadidos endpoints públicos OpenClaw |
| apps/api/src/modules/presets/routes.ts | Tenant isolation via context |
| apps/api/src/modules/agents/routes.ts | Tenant isolation via context |
| apps/api/src/modules/sessions/routes.ts | Tenant isolation via context |
| apps/api/src/modules/orchestrator/routes.ts | Tenant isolation via context |
| apps/api/src/modules/tenants/routes.ts | Tenant isolation (solo propio tenant) |
| apps/api/src/modules/users/routes.ts | Tenant isolation via context |
| apps/api/src/modules/users/service.ts | Añadido getUsersByTenant |
| apps/api/src/modules/tasks/routes.ts | Tenant isolation via context |
| apps/api/src/modules/audit/routes.ts | Tenant isolation via context |
| apps/api/src/modules/audit/service.ts | Añadido getAuditEntriesByTenant |
| packages/openclaw-adapter/src/ws/openclaw-ws.client.ts | Protocolo ok/payload, role operator, auth bearer |
| packages/openclaw-adapter/src/rest/openclaw-rest.client.ts | Model obligatorio en chat completions |
| packages/openclaw-adapter/src/tools/index.ts | Export HTTP client, nota sobre RPC tentativo |
| packages/openclaw-adapter/src/tools/openclaw-tools.rpc.ts | Marcado como NO CONFIRMADO |
| PROJECT_MEMORY.md | Actualizado con fase estabilización |

---

## 4. Decisiones Aplicadas

### Build/Workspaces
- Root package.json con workspaces `["apps/*", "packages/*"]`
- Cada package con su propio package.json y tsconfig.json
- Scripts: build, check, dev:api, dev:web

### Auth Real
- Middleware `requireAuth` aplicado a todas las rutas en index.ts
- Handlers reciben `context: AuthContext | null`
- Rutas protegidas verifican `if (!context)` y responden 401
- Endpoints públicos:
  - /health
  - /auth/login
  - /openclaw/status
  - /openclaw/ws-status
  - /openclaw/ws-rpc-status
  - /openclaw/tools-status

### Tenant Isolation
- Todas las rutas protegidas usan `context.tenant.id`
- Servicios filtran por tenantId
- Un tenant solo ve sus propios datos

### WS/RPC Protocolo Documentado
```typescript
// Response (antes)
{ type: "res", id, result?, error? }

// Response (ahora - documentado)
{ type: "res", id, ok: boolean, payload?, error? }

// Event (antes)
{ type: "event", event, data? }

// Event (ahora - documentado)
{ type: "event", event, payload? }

// Connect params (ahora)
{
  role: "operator",
  scopes: ["operator.read", "operator.write"],
  auth: { type: "bearer", token: apiKey }
}
```

### REST Chat Completions
```typescript
// Antes
postChatCompletion(payload) // model opcional

// Ahora
postChatCompletion(payload) {
  // Valida messages no vacío
  // Asegura model: payload.model || "openclaw/default"
}
```

### Tools OpenClaw
- **OpenClawToolsHttpClient** (documentado): POST /tools/invoke
- **OpenClawToolsRpc** (NO CONFIRMADO): tools.execute vía WS
- Preferir HTTP sobre RPC hasta confirmar protocolo

---

## 5. Problemas Encontrados

1. **createPreset/createAgent sin tenantId**: Routes no pasaban tenantId al service
   - **Solución**: Handlers ahora reciben context y pasan tenant.id

2. **Tipos de handler incompatibles**: Handlers tenían firmas sin context
   - **Solución**: Wrapper functions para adaptar handlers públicos

3. **Endpoints públicos incompletos**: Faltaban ws-status, ws-rpc-status, tools-status
   - **Solución**: Añadidos a PUBLIC_ENDPOINTS

---

## 6. Pruebas Realizadas

No se ejecutaron pruebas automáticas (no hay test runner configurado).

**Verificaciones manuales recomendadas**:
```bash
# Instalar dependencias
cd openclaw-custom-layer
npm install

# Verificar TypeScript
npm run check --workspaces

# Iniciar API
npm run dev:api
```

---

## 7. Pendiente Recomendado

1. **npm install y verificar workspaces**: El usuario debe ejecutar `npm install`
2. **Test de compilación**: `npm run check` para verificar tipos
3. **Test de auth**: Verificar que rutas protegidas requieren token
4. **Test de tenant isolation**: Verificar que datos están aislados
5. **Configurar tests automáticos**: Jest o similar
6. **Documentar endpoints públicos vs protegidos**: README o docs

---

## 8. Estado de PROJECT_MEMORY.md

**Actualizado con**:
- Decisiones de estabilización
- Estado actual con nuevos items completados
- Prompt 021 registrado
- Report 020 registrado
- Cambio importante registrado

---

## Resumen de Cambios

| Categoría | Antes | Ahora |
|-----------|-------|-------|
| Build | Sin workspaces | npm workspaces configurados |
| Auth | Middleware existente no aplicado | Aplicado en todas las rutas |
| Tenant | Filter opcional | Obligatorio en rutas protegidas |
| WS Response | result/error | ok/payload/error |
| WS Event | data | payload |
| WS Connect | role: "control" | role: "operator", auth.type: "bearer" |
| REST | model opcional | model obligatorio |
| Tools HTTP | No existía | /tools/invoke documentado |
| Tools RPC | Asumido como válido | Marcado NO CONFIRMADO |

---

**Estado**: ✅ Completado
**Siguiente**: Ejecutar npm install y verificar compilación
