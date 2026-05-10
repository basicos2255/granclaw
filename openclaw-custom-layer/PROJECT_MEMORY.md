# PROJECT_MEMORY.md

Documento central de memoria del proyecto **GranClaw**.

---

## Objetivo

Crear una capa personalizada sobre OpenClaw que permita:
- Backend API propio
- UI personalizada (GranClaw UI)
- Adapters de comunicación
- **Presets y configuraciones dinámicas**
- **Sistema de agentes configurable**
- **Sistema de sesiones con historial**
- Sistema de tareas
- Auditoría completa
- **Orquestación de tareas con configuración dinámica y contexto**
- **Sistema de tools extensible**
- **Persistencia de datos**
- **Base de streaming de respuestas via WebSocket**
- **UI tipo chat con soporte streaming**
- **Autenticacion completa (email + password, login, register, logout)**
- **Multi-tenant base (tenantId en todas las entidades)**

Sin modificar OpenClaw core.

---

## Arquitectura actual

```
GranClaw UI (web) -> Backend (api) -> Orchestrator -> Adapters (openclaw-adapter) -> OpenClaw Gateway
                                          |
                                    Presets + Agents + Sessions + Tools
                                          |
                                    Storage (file-db)
```

- Monorepo con apps/ y packages/
- Separación clara entre capa personalizada y OpenClaw
- Comunicación vía HTTP/WebSocket con OpenClaw
- Contratos internos definidos en packages/core
- Adapters implementados en packages/openclaw-adapter
- Backend API base en apps/api
- UI base en apps/web (conectada a backend local)
- REST client implementado (fallback/secundario)
- WebSocket client RPC implementado (principal) - compatible Gateway protocol
- Webhooks client implementado (TaskFlow trigger)
- **Orchestrator con configuración dinámica via agents/presets/sessions**
- **Sistema de sesiones con historial persistente**
- **Persistencia file-based (JSON)**
- **Protocolo WS/RPC base compatible con Gateway** (payloads pendientes validación)

---

## Decisiones tomadas

| Fecha | Decisión | Motivo |
|-------|----------|--------|
| 2026-04-28 | No acoplar UI directamente a OpenClaw | Mantenibilidad, seguridad, flexibilidad |
| 2026-04-28 | Estructura monorepo | Facilita desarrollo y despliegue conjunto |
| 2026-04-28 | Documentación en docs/ | Centralización y trazabilidad |
| 2026-04-28 | Uso de contratos internos antes de integración OpenClaw | Permite desarrollo paralelo, testing sin dependencias, interfaces estables |
| 2026-04-28 | Renombrar proyecto a GranClaw | Identidad propia del frontend y sistema |
| 2026-04-28 | Adapters base creados sin conexión real | Permite desarrollo UI/API sin depender de OpenClaw |
| 2026-04-28 | Backend base con HTTP nativo | Sin dependencias externas, control total |
| 2026-04-28 | UI con React + Vite | Stack moderno, desarrollo rápido |
| 2026-04-28 | Router simple sin librería | Mínimas dependencias |
| 2026-04-28 | REST como integración secundaria/fallback | WS/RPC es principal |
| 2026-04-28 | WebSocket nativo sin librerías externas | Control total, mínimas dependencias |
| 2026-04-28 | No conectar WS automáticamente | Control explícito de conexión |
| 2026-04-28 | Webhooks como capa de automatización | TaskFlow trigger sin lógica avanzada |
| 2026-04-28 | Endpoints webhooks configurables | Sin asumir estructura de OpenClaw |
| 2026-04-28 | Orchestrator con fallback mock | Sistema funciona sin OpenClaw |
| 2026-04-28 | REST antes de WS en orchestrator | Simplicidad primero |
| 2026-04-28 | Presets con systemPrompt | Configuración dinámica de comportamiento |
| 2026-04-28 | Agents vinculados a presets | Separación de identidad y comportamiento |
| 2026-04-28 | Validación de presetId al crear agent | Integridad referencial |
| 2026-04-28 | Persistencia file-based (JSON) | Simple, sin ORM, migración futura fácil |
| 2026-04-28 | Storage abstraction layer | Facilita migración a DB real |
| 2026-04-28 | Sessions con historial limitado (20 msgs) | Balance memoria/contexto |
| 2026-04-28 | Rutas dinámicas con regex | Soporte /sessions/:id sin librería |
| 2026-04-28 | Streaming base sin protocolo real | Preparación para streaming real, fallback a REST/mock |
| 2026-04-28 | WS client con on/emit genéricos | Eventos sin nombres predefinidos, TODO cuando protocolo disponible |
| 2026-04-28 | UI chat sin librerías externas | Estilos inline, componentes simples |
| 2026-04-28 | Auth email-based sin password | Desarrollo simple, TODO password/OAuth |
| 2026-04-28 | Multi-tenant por tenantId | Todas las entidades aisladas por tenant |
| 2026-04-28 | Primer usuario crea admin | Auto-bootstrap del sistema |
| 2026-04-28 | Token bearer en localStorage | Simple para desarrollo |
| 2026-04-29 | WS genérico sustituido por RPC Gateway | Protocolo compatible con OpenClaw Gateway |
| 2026-04-29 | Primer frame connect obligatorio | Handshake antes de cualquier operación |
| 2026-04-29 | chat.send/history/abort/inject como métodos RPC | Métodos documentados en Gateway |
| 2026-04-29 | Sistema de tools extensible | Base para agentes reales con capacidades |
| 2026-04-29 | Tools en agents como string[] | Permite asignar tools disponibles por agent |
| 2026-04-29 | Detección de tools por keyword | Simplifica ejecución sin NLP complejo |
| 2026-04-29 | ToolExecutionContext añadido | Permite pasar tenantId, userId, sessionId a tools |
| 2026-04-29 | httpTool con seguridad básica | Bloqueo localhost, timeout obligatorio |
| 2026-04-29 | Placeholder executeToolViaOpenClaw | Preparación para integración OpenClaw tools |
| 2026-04-29 | OpenClawToolsRpc wrapper | Capa para ejecutar tools via Gateway RPC |
| 2026-04-29 | Modo híbrido tools (internal/openclaw) | Agent.toolsConfig define modo por tool |
| 2026-04-29 | tools.execute marcado experimental | NO CONFIRMADO por documentación oficial; deshabilitado por defecto |
| 2026-04-29 | Estabilización build/auth/RPC | Workspaces, auth real, tenant isolation, protocolo alineado |
| 2026-04-29 | WS RPC usa ok/payload | Protocolo documentado en lugar de result |
| 2026-04-29 | REST chat completions con model | Requerido por OpenAI API |
| 2026-04-29 | /tools/invoke vía HTTP documentado | Preferir sobre tools.execute RPC |
| 2026-04-29 | Auth aplicado en todas las rutas | Middleware centralizado con tenant isolation |
| 2026-04-29 | Fix compile and contracts | Workspace imports, TypeScript, orchestrator refactor |
| 2026-04-29 | Orchestrator usa OpenClawRestClient | Refactor de runOpenClawTask para usar cliente singleton |
| 2026-04-29 | chat.send TODO streaming | Documentado que chat.send NO devuelve respuesta final |
| 2026-04-29 | OpenClawToolsHttpClient exportado | /tools/invoke HTTP como vía preferida |
| 2026-04-29 | Fix runtime start | package.json apunta a dist, handshake corregido, tools.execute deshabilitado |
| 2026-04-29 | Handshake connect corregido | role: operator, scopes: operator.read/operator.write, auth sin type: bearer |
| 2026-04-29 | tools.execute DESHABILITADO | Requiere OPENCLAW_TOOLS_RPC_EXPERIMENTAL=true |
| 2026-04-29 | /tools/invoke es método oficial | POST /tools/invoke via OpenClawToolsHttpClient |
| 2026-04-29 | chat.send devuelve ack | NO devuelve respuesta, streaming via eventos pendiente |
| 2026-04-29 | Seguridad httpTool mejorada | Bloquea .local, .internal, redes privadas |
| 2026-04-29 | /tools y /openclaw/tools-status protegidos | Requieren autenticación |
| 2026-04-29 | Deploy desde repo limpio | No usar ZIP contaminado con node_modules/dist/data |
| 2026-04-29 | Fix 023 pre deploy final | tenants/users usan storage, tools OpenClaw usa /tools/invoke HTTP, UI login mínima |
| 2026-04-29 | /tools/invoke usa { ok, result, error } | Contrato alineado con protocolo OpenClaw |
| 2026-04-29 | WS handshake con params completos | minProtocol, maxProtocol, client, caps, locale |
| 2026-04-29 | SSRF mejorado con más rangos | 172.16-31.*, 169.254.*, IPv6 privadas, más sufijos |
| 2026-04-29 | buildToolParams sin toolId duplicado | toolId ya viene en la llamada, no en params |
| 2026-04-29 | ACK mode documentado | chat.send devuelve ack, eventos pendientes |
| 2026-04-29 | FIX 025 pre Mac mini | WS handshake v3, ACK mode, /tools/invoke seguridad, repo limpio |
| 2026-04-30 | Validación auth OpenClaw | GET /openclaw/auth-status para validar REST, WS y tools |
| 2026-04-30 | Runbook Mac mini creado | docs/deployment/GRANCLAW_MACMINI_RUNBOOK.md |
| 2026-04-30 | TUI bootstrap commands | docs/deployment/GRANCLAW_TUI_BOOTSTRAP_COMMANDS.md |
| 2026-04-30 | Token separation documentada | OPENCLAW_API_KEY para REST/WS/tools, hooks.token separado |
| 2026-04-30 | dotenv como dependencia | npm install instala dotenv, import en primera línea de index.ts |
| 2026-04-30 | Env path resolution fix | Busca .env en cwd, ../../.env, __dirname/../../.env |
| 2026-04-30 | FIX 031 pre-commit runbook | Runbook/TUI usan Bearer token, dist/ limpio |
| 2026-04-30 | WS Runtime Alignment | Logging detallado, fallback auth, wsHandshakeResponse en auth-status |
| 2026-04-30 | FIX 033 WS Connect Schema Alignment | socketOpen flag, configurable client.id/mode, variants support |
| 2026-04-30 | FIX 034 WS Official Client Alignment | Valores oficiales: gateway-client, backend |
| 2026-04-30 | FIX 035 Frontend Real Integration | Chat consume /orchestrator/run, debug panel, source labels |
| 2026-05-01 | FIX 040 WS Client Auth Header | ws package, Authorization Bearer en upgrade, endpoint /__openclaw__/ws |
| 2026-05-02 | FIX 041 WS Handshake Protocol | connect.challenge antes de connect, flujo alineado con OpenClaw |
| 2026-05-02 | FIX 042 Deploy Reproducible | setup-env.sh, permisos ejecutables, token real en .env |
| 2026-05-02 | FEATURE 050 GranClaw Hub Base | Capa de control previa al orchestrator con reglas básicas |
| 2026-05-02 | FEATURE 051 GranClaw Hub v2 | Config dinámica, modos passthrough/strict, decisionLog |
| 2026-05-02 | FEATURE 052 GranClaw Hub v3 Multi-Tenant | Config por tenant en memoria, fallback a global |
| 2026-05-02 | FEATURE 053 GranClaw Hub v4 Admin Endpoints | Endpoints REST para gestionar config por tenant |
| 2026-05-02 | FEATURE 070 Auth Sessions Base | /auth/register, sesiones en memoria, Login/Register UI |
| 2026-05-03 | FEATURE 071 Auth Complete v1 | Password auth, logout, usuario visible, auth state |
| 2026-05-03 | FEATURE 072 Auth UX + Integration Fix | Auth guard, error translation, UX moderna, pantalla sin login |
| 2026-05-03 | FEATURE 073 Real Execution Trace | Trazabilidad real de ejecucion, Hub/orchestrator instrumentados, UI muestra flujo real |
| 2026-05-03 | FEATURE 074 Execution Guarantees & Status Bar | Trace obligatorio, no success falso, barra de estado, duraciones, adapterStatus |
| 2026-05-04 | FIX 103 Tool Approval Flow & Return Context | Backend idempotente, aprobar inline, reintentar sin navegar |
| 2026-05-04 | FIX 104 Capability Key Normalization | capabilityKey canónica, evita duplicados, lookup unificado |
| 2026-05-04 | FIX 105 Canonical Capability Groups & Cleanup | UI agrupa por capabilityKey, deduplicación, acciones visibles, sesión expirada |
| 2026-05-05 | FIX 111 Complete OS Tools UI Confirmation | OutputViewer humano, confirmación OS en UI, capability dispatcher centralizado |
| 2026-05-05 | FIX 112 TypeScript Repair After OS Tools | hubResult.mode fix, unused imports/vars cleanup, npm run check/build pass |
| 2026-05-05 | FIX 113 Register OS Tools Routes | Handlers existian pero no registrados en index.ts, ahora GET/POST /os-tools/* funcionan |

---

## FEATURE 074 - Execution Guarantees & Status Bar

**Fecha**: 2026-05-03

### Objetivo:
Corregir la falta de garantias visibles de ejecucion real y añadir barra inferior de estado/debug que muestre lo que ocurre durante evaluacion, conexion, ejecucion y respuesta.

### Problema resuelto:
La UI mostraba PERMITIDO instantaneamente y "No hay trazabilidad disponible", generando dudas sobre si la ejecucion fue real.

### Garantias implementadas:

**Backend**:
- executionTrace SIEMPRE presente en respuesta
- executionDurationMs en meta
- adapterStatus con estado de REST/WS/OpenClaw
- Warning si success pero sin resultado real
- Source siempre visible (openclaw/tool/mock/fallback)

**Frontend**:
- StatusBar.tsx: barra inferior de estado fija
- Estados progresivos reales durante ejecucion
- Warning fuerte si no hay trace
- No decir "Accion ejecutada correctamente" si no hay resultado real
- Historial mejorado con source, hasTrace, durationMs, status

### Archivos creados/modificados:

**apps/api/src/modules/orchestrator/trace.ts**:
- AdapterStatus type
- durationMs en ExecutionTraceStep
- getTotalDurationMs() en builder

**apps/api/src/modules/orchestrator/service.ts**:
- getAdapterStatus() exportado

**apps/api/src/modules/orchestrator/routes.ts**:
- meta.executionDurationMs
- meta.adapterStatus
- meta.source
- warning si success pero sin resultado

**apps/web/src/components/control/StatusBar.tsx** (nuevo):
- Barra inferior fija
- Muestra estado, fuente, duracion
- Expandible con diagnostico
- Estados: ejecutando, completado, error

**apps/web/src/components/control/ExecutionTracePanel.tsx**:
- Warning fuerte si no hay trace
- Muestra durationMs por step

**apps/web/src/pages/control/Execute.tsx**:
- Fases progresivas: evaluating, connecting, executing, completed, error
- StatusBar integrado
- Historial mejorado
- No decir "ejecutado correctamente" sin resultado real

### Respuesta del backend:
```json
{
  "success": true,
  "result": "...",
  "source": "openclaw",
  "warning": null,
  "meta": {
    "hubDecision": [...],
    "executionTrace": [...],
    "executionDurationMs": 1234,
    "tenantId": "default",
    "source": "openclaw",
    "adapterStatus": {
      "openclawConfigured": true,
      "restConfigured": true,
      "wsConfigured": false
    }
  }
}
```

### StatusBar estados:
| Estado | Color | Ejemplo |
|--------|-------|---------|
| Ejecutando | Gris | "Evaluando politicas..." |
| Permitido | Verde | "Permitido - OpenClaw respondio - 1.4s" |
| Mock | Amarillo | "Permitido - Respuesta fallback/mock" |
| Error | Rojo | "Error - No se confirmo ejecucion real" |
| Sin trace | Amarillo | "Permitido - Sin trazabilidad real" |

---

## FEATURE 073 - Real Execution Trace

**Fecha**: 2026-05-03

### Objetivo:
Implementar trazabilidad REAL de ejecucion para GranClaw. La UI debe mostrar los pasos reales que ocurrieron: Hub -> decision -> orchestrator/OpenClaw -> resultado/error.

### Principios:
- Prohibido mostrar pasos falsos o simulados
- Si no existe un paso real, no mostrarlo
- Solo trazas reales del backend
- Errores tecnicos traducidos a mensajes humanos

### Tipos creados:

**ExecutionTraceStep**:
```typescript
{
  id: string
  timestamp: string
  stage: 'hub' | 'orchestrator' | 'openclaw' | 'tool' | 'result' | 'error'
  status: 'pending' | 'running' | 'success' | 'blocked' | 'error'
  label: string
  detail?: string
  raw?: unknown
}
```

### Archivos creados/modificados:

**apps/api/src/modules/orchestrator/trace.ts** (nuevo):
- ExecutionTraceStep type
- ExecutionTraceBuilder class
- translateErrorToHuman() para errores legibles
- Metodos: hubStart, hubAllowed, hubBlocked, orchestratorStart, orchestratorSuccess, orchestratorError, resultSource

**apps/api/src/modules/orchestrator/routes.ts**:
- Import ExecutionTraceBuilder
- Traza Hub inicio/permitido/bloqueado
- Traza orchestrator inicio/exito/error
- Traza source de respuesta
- meta.executionTrace en respuesta

**apps/web/src/components/control/ExecutionTracePanel.tsx** (nuevo):
- Muestra flujo real de ejecucion
- Iconos segun status (tick, blocked, error)
- Toggle "Ver detalles tecnicos" con raw trace
- Si no hay trace: "No hay trazabilidad disponible"

**apps/web/src/pages/control/Execute.tsx**:
- Import ExecutionTracePanel
- Extrae meta.executionTrace de respuesta
- Muestra ExecutionTracePanel debajo de SecurityResultPanel

### Respuesta del backend:
```json
{
  "success": true,
  "result": "...",
  "source": "openclaw",
  "meta": {
    "hubDecision": ["Tenant: default", "Hub enabled: true", ...],
    "executionTrace": [
      { "id": "step-1", "stage": "hub", "status": "running", "label": "Evaluando politicas de la empresa" },
      { "id": "step-2", "stage": "hub", "status": "success", "label": "Accion permitida" },
      { "id": "step-3", "stage": "orchestrator", "status": "running", "label": "Enviando accion al orquestador" },
      { "id": "step-4", "stage": "orchestrator", "status": "success", "label": "Orquestador completo la ejecucion" },
      { "id": "step-5", "stage": "result", "status": "success", "label": "Respuesta generada por OpenClaw" }
    ],
    "tenantId": "default"
  }
}
```

### Traduccion de errores:
| Error tecnico | Mensaje humano |
|--------------|----------------|
| Authentication required | Debes iniciar sesion para ejecutar esta accion |
| Invalid or expired token | Sesion expirada |
| Network error | No se pudo contactar con el servidor |
| OpenClaw REST client not configured | Servicio de IA no configurado |
| default | No se pudo completar la ejecucion |

---

## FEATURE 072 - Auth UX + Integration Fix

**Fecha**: 2026-05-03

### Objetivo:
Arreglar completamente el sistema de LOGIN y REGISTRO (UX + integracion + flujo), y corregir el problema de llamadas a APIs protegidas sin sesion.

### Problemas resueltos:
1. UI de login/registro pobre (web 1.0) -> UI moderna con cards centradas
2. UX confusa -> Flujo claro entre register/login/control
3. No hay control de sesion en frontend -> Auth guard global
4. Se llamaban APIs protegidas sin estar logueado (403) -> requestProtected
5. Errores de backend mostraban mensajes crudos -> Error translation
6. Flujo roto entre paginas -> Navegacion correcta

### Caracteristicas:

**Auth Guard Global**:
- `isAuthenticated()` verifica si hay token
- `requestProtected()` devuelve error si no hay token (sin hacer request)
- `postRequestProtected()` para POST protegidos
- `deleteRequestProtected()` para DELETE protegidos
- NO se llaman APIs protegidas sin sesion (sin 403 en consola)

**Error Translation**:
- `translateError()` traduce errores de backend a espanol
- Mensajes user-friendly en lugar de "Invalid or expired token"
- Mapeo completo de errores conocidos

**UX Login/Register Mejorada**:
- Cards centradas con sombra
- Max-width 400px
- Bordes redondeados, espaciado consistente
- Estados de loading con colores deshabilitados
- Mensajes de error con estilo visual
- Links entre login/register

**Pantalla Sin Login**:
- En /control: si no autenticado muestra prompt de login
- Emoji lock grande
- Mensaje claro y boton "Ir a login"
- NO muestra input ni permite ejecutar

### Archivos modificados:

**apps/web/src/services/api.ts**:
- `isAuthenticated()` export
- `translateError()` funcion
- `requestProtected()`, `postRequestProtected()`, `deleteRequestProtected()`
- Todos los endpoints protegidos usan estas funciones

**apps/web/src/pages/login/index.tsx**:
- UI moderna con card centrada
- Campo password
- Error display estilizado
- Link a register

**apps/web/src/pages/register/index.tsx**:
- UI moderna matching login
- Validacion password min 4
- Redirect a login con mensaje

**apps/web/src/pages/control/Execute.tsx**:
- Import `isAuthenticated`
- Auth guard que muestra pantalla de login requerido
- Bloquea acceso sin sesion

### Flujo completo:
```
1. Usuario entra a /control sin sesion
   -> Ve pantalla "Inicia sesion para usar GranClaw"
   -> Click "Ir a login"

2. Usuario va a /login
   -> Ingresa email + password
   -> Si exito: token guardado, redirect a /control
   -> Si error: mensaje traducido visible

3. Usuario va a /register
   -> Ingresa email + password (min 4)
   -> Si exito: redirect a /login
   -> Si error: mensaje traducido visible

4. Usuario autenticado en /control
   -> Ve panel normal
   -> APIs protegidas funcionan
   -> NO hay 403 en consola
```

---

## FEATURE 071 - Auth Complete v1

**Fecha**: 2026-05-03

### Objetivo:
Completar autenticacion real para GranClaw Portal: registro con password, login con password, logout, usuario visible en UI.

### Caracteristicas:
- Password hash con SHA-256 (crypto nativo)
- Endpoint POST /auth/logout
- Login requiere email + password
- Register requiere email + password (min 4 chars)
- Usuario visible en header de producto
- Boton logout en header
- Hook useAuth para estado de autenticacion
- PublicUser type (sin passwordHash)

### Endpoints:

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| POST | /auth/login | Login con email + password |
| POST | /auth/register | Registro con email + password |
| POST | /auth/logout | Cerrar sesion |
| GET | /auth/me | Info del usuario autenticado |

### Archivos modificados:

**apps/api/src/modules/auth/types.ts**:
- passwordHash en User
- PublicUser type
- LoginInput con password
- RegisterInput con password

**apps/api/src/modules/auth/service.ts**:
- hashPassword() con crypto
- toPublicUser()
- login() verifica password
- register() guarda passwordHash

**apps/api/src/modules/auth/routes.ts**:
- handleLogout()
- Validacion de password en login/register

**apps/api/src/index.ts**:
- POST /auth/logout route

**apps/web/src/hooks/useAuth.ts**:
- Hook de estado de autenticacion
- login, register, logout, checkAuth

**apps/web/src/services/api.ts**:
- api.login(email, password)
- api.register(email, password)
- api.logout()

**apps/web/src/pages/login/index.tsx**:
- Campo password

**apps/web/src/pages/register/index.tsx**:
- Campo password
- Validacion min 4 chars

**apps/web/src/App.tsx**:
- ProductHeader con usuario y logout
- useAuth hook

### Seguridad:
- passwordHash no se expone en API
- SHA-256 (produccion usar bcrypt)
- Mensajes de error genericos

---

## FEATURE 070 - Auth Sessions Base

**Fecha**: 2026-05-02

### Objetivo:
Implementar base de autenticacion y sesiones para GranClaw Portal.

### Caracteristicas:
- Endpoint POST /auth/register (publico)
- Sesiones almacenadas en Map en memoria (no file-based)
- Persistencia de usuarios en data/users.json
- Login.tsx con link a registro
- Register.tsx con link a login
- Primer usuario registrado es admin

### Endpoints:

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| POST | /auth/register | Registro publico de usuarios |
| POST | /auth/login | Login con email |
| GET | /auth/me | Info del usuario autenticado |

### Archivos modificados:

**apps/api/src/modules/auth/types.ts**:
- RegisterInput
- RegisterResult

**apps/api/src/modules/auth/service.ts**:
- sessionMap: Map<string, AuthSession> (en memoria)
- register(input): RegisterResult
- getSessionCount(): number

**apps/api/src/modules/auth/routes.ts**:
- handleRegister()

**apps/api/src/shared/auth-context.ts**:
- /auth/register añadido a PUBLIC_ENDPOINTS

**apps/api/src/index.ts**:
- POST /auth/register route

**apps/api/data/users.json**:
- Archivo de persistencia de usuarios

**apps/web/src/pages/register/index.tsx**:
- RegisterPage component

**apps/web/src/pages/login/index.tsx**:
- Link a /register

**apps/web/src/services/api.ts**:
- api.register()

**apps/web/src/App.tsx**:
- Ruta /register

### Flujo de registro:
1. Usuario accede a /register
2. Introduce email
3. POST /auth/register { email }
4. Si email nuevo → crear usuario + sesion
5. Devuelve token
6. Frontend guarda token y redirige a /chat

### Sesiones en memoria:
- Map<token, AuthSession>
- 24h de duracion
- Se pierden al reiniciar servidor
- Usuarios persisten en JSON

---

## FEATURE 053 - GranClaw Hub v4 Admin Endpoints

**Fecha**: 2026-05-02

### Objetivo:
Añadir endpoints administrativos para consultar y modificar configuración del Hub por tenant.

### Características:
- Sin persistencia (en memoria)
- Sin UI
- Solo admin puede modificar (si contexto existe)
- Modo desarrollo: permite sin auth

### Endpoints:

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /granclaw-hub/config | Config global + todos los tenants |
| GET | /granclaw-hub/config/:tenantId | Config de tenant (o fallback) |
| POST | /granclaw-hub/config/:tenantId | Establecer config de tenant |
| DELETE | /granclaw-hub/config/:tenantId | Eliminar config de tenant |

### Archivos:

**admin.controller.ts** (nuevo):
```typescript
handleGetAllConfig(req, res, context)
handleGetTenantConfig(req, res, tenantId, context)
handleSetTenantConfig(req, res, tenantId, context)
handleDeleteTenantConfig(req, res, tenantId, context)
```

### Respuestas:

**GET /granclaw-hub/config**:
```json
{
  "defaultConfig": { "enabled": true, "mode": "strict", "blockedWords": ["forbidden"] },
  "tenants": {
    "acme-corp": { "enabled": true, "mode": "passthrough", "blockedWords": [] }
  }
}
```

**GET /granclaw-hub/config/:tenantId**:
```json
{
  "tenantId": "acme-corp",
  "config": { "enabled": true, "mode": "passthrough", "blockedWords": [] },
  "source": "tenant"
}
```

### Seguridad:
- Si existe contexto auth → requiere role=admin
- Si no existe contexto → permite (modo desarrollo)

### Validación:
- enabled: boolean
- mode: "passthrough" | "strict"
- blockedWords: string[]

---

## FEATURE 052 - GranClaw Hub v3 Multi-Tenant

**Fecha**: 2026-05-02

### Objetivo:
Añadir soporte multi-tenant básico al GranClaw Hub, permitiendo configuración específica por tenant con fallback a configuración global.

### Características:
- Config por tenant almacenada en memoria (Map)
- `getHubConfig(tenantId?)` - devuelve config de tenant o global
- `setTenantHubConfig(tenantId, config)` - config específica de tenant
- `getTenantHubConfig(tenantId)` - obtiene config de tenant (null si no existe)
- `removeTenantHubConfig(tenantId)` - elimina config de tenant
- `listTenantConfigs()` - lista todos los tenants con config específica
- DecisionLog incluye `Tenant: <tenantId>` como primera línea
- Si no hay tenantId → usa "default"
- Backward compatible con FEATURE 051

### Archivos modificados:

**config.ts**:
```typescript
export const DEFAULT_TENANT_ID = 'default'

const tenantConfigs: Map<string, GranClawHubConfig> = new Map()

export function getHubConfig(tenantId?: string): GranClawHubConfig
export function setTenantHubConfig(tenantId: string, config: Partial<GranClawHubConfig>): void
export function getTenantHubConfig(tenantId: string): GranClawHubConfig | null
export function removeTenantHubConfig(tenantId: string): boolean
export function listTenantConfigs(): Array<{ tenantId: string; config: GranClawHubConfig }>
```

**service.ts**:
```typescript
// process() ahora usa tenantId del contexto
const tenantId = context.tenantId || DEFAULT_TENANT_ID
const config = getHubConfig(tenantId)
decisionLog.push(`Tenant: ${tenantId}`)

// Nuevos métodos expuestos
setTenantConfig(tenantId, config)
getTenantConfig(tenantId)
removeTenantConfig(tenantId)
listTenants()
isEnabled(tenantId?) // ahora acepta tenantId
```

**rules.ts**:
- Header actualizado con FEATURE 052
- Sin cambios funcionales (config ya se pasa como parámetro)

### DecisionLog ejemplo:
```json
[
  "Tenant: acme-corp",
  "Hub enabled: true",
  "Mode: strict",
  "Blocked words: forbidden, banned",
  "Execution allowed"
]
```

### Flujo:
1. Orchestrator llama `hub.process({ ..., tenantId: context.tenant.id })`
2. Service obtiene `getHubConfig(tenantId)`
3. Si existe config específica del tenant → usa esa
4. Si no existe → usa config global
5. DecisionLog incluye tenant usado

### Extensibilidad futura:
- Persistencia de tenant configs
- Endpoint admin para gestionar configs por tenant
- Rate limiting por tenant

---

## FEATURE 051 - GranClaw Hub v2

**Fecha**: 2026-05-02

### Objetivo:
Extender GranClaw Hub con configuración dinámica, logging de decisiones y modos de ejecución.

### Características:
- Configuración dinámica (enabled, mode, blockedWords)
- Modo passthrough: registra pero no bloquea
- Modo strict: aplica reglas y bloquea
- Logging de decisiones (decisionLog)
- Hub sigue siendo opcional

### Archivos:

**config.ts** (nuevo):
```typescript
interface GranClawHubConfig {
  enabled: boolean
  mode: 'passthrough' | 'strict'
  blockedWords: string[]
}
```

**types.ts** (actualizado):
- GranClawHubResult ahora incluye `decisionLog: string[]`
- Nuevo tipo GranClawRuleResult (interno)

**rules.ts** (actualizado):
- Usa blockedWords desde config
- Soporta modo passthrough

**service.ts** (actualizado):
- getConfig(), setConfig(), isEnabled()
- Genera decisionLog detallado

**orchestrator/routes.ts** (actualizado):
- Respuesta incluye `meta: { hubDecision }`

### Respuesta ejemplo:
```json
{
  "success": true,
  "result": "...",
  "meta": {
    "hubDecision": [
      "Hub enabled: true",
      "Mode: strict",
      "Execution allowed"
    ]
  }
}
```

---

## FEATURE 050 - GranClaw Hub Base

**Fecha**: 2026-05-02

### Objetivo:
Implementar capa inicial de control "GranClaw Hub" que intercepte ejecuciones antes del orchestrator y permita aplicar reglas básicas.

### Características:
- Capa adicional, no sustitución
- No modifica comportamiento actual si no se activa
- Permite bloquear o modificar mensajes antes del orchestrator
- Extensible para futuras reglas (multi-cliente, seguridad, auditoría)

### Estructura:
```
apps/api/src/modules/granclaw-hub/
  types.ts    # GranClawHubContext, GranClawHubResult, GranClawHubRule
  rules.ts    # applyBasicRules(), reglas activas
  service.ts  # createGranClawHubService(), getGranClawHubService()
  index.ts    # Exports
```

### Tipos:
```typescript
interface GranClawHubContext {
  sessionId: string
  agentId?: string
  message: string
  tenantId?: string
  userId?: string
}

interface GranClawHubResult {
  allowed: boolean
  reason?: string
  modifiedMessage?: string
}
```

### Reglas iniciales:
1. `empty-message`: Bloquea mensajes vacíos
2. `forbidden-word`: Bloquea mensajes que contienen "forbidden"

### Integración:
```typescript
// En orchestrator/routes.ts
const hub = getGranClawHubService()
const hubResult = hub.process({ sessionId, agentId, message, tenantId, userId })

if (!hubResult.allowed) {
  ok(res, {
    success: false,
    error: 'Blocked by GranClaw Hub',
    reason: hubResult.reason
  })
  return
}
// Continúa flujo normal
```

### Respuesta de bloqueo:
```json
{
  "success": false,
  "error": "Blocked by GranClaw Hub",
  "reason": "Message contains forbidden word"
}
```

### Extensibilidad futura:
- Reglas por tenant
- Reglas por agente
- Rate limiting
- Auditoría
- Filtros de contenido
- Transformaciones de mensaje

---

## FIX 042 - Deploy Reproducible

**Fecha**: 2026-05-02

### Problema:
Despliegue fallaba por:
1. `scripts/granclaw-dev.sh` sin bit ejecutable (100644 en lugar de 100755)
2. `.env` generado con literal de comando: `OPENCLAW_API_KEY=$(openclaw config get ...)` en lugar del valor real
3. Resultado: AUTH_TOKEN_MISMATCH, 401

### Solución:
1. Corregido permisos de `granclaw-dev.sh` con `git update-index --chmod=+x`
2. Creado `scripts/setup-env.sh` que extrae token REAL y genera `.env`
3. Actualizado runbook con flujo correcto

### Archivos:

**scripts/setup-env.sh** (nuevo):
```bash
#!/bin/zsh
TOKEN=$(openclaw config get gateway.token 2>/dev/null || true)
if [[ -z "$TOKEN" ]]; then
  echo "[ENV] ERROR: no se pudo obtener token"
  exit 1
fi
cat > .env <<EOF
OPENCLAW_API_KEY=$TOKEN
...
EOF
```

**scripts/granclaw-dev.sh**:
- Cambiado de 100644 a 100755 (ejecutable)

**docs/deployment/GRANCLAW_MACMINI_RUNBOOK.md**:
- Sección 7.1 actualizada con `./scripts/setup-env.sh`
- Documentado error de command substitution literal
- Comandos rápidos actualizados

### Flujo correcto de despliegue:
```bash
npm run dev:stop
git pull && npm install
npm run check --workspaces --if-present
npm run build --workspaces --if-present
./scripts/setup-env.sh      # FIX 042: Genera .env con token REAL
npm run dev
```

### PROHIBIDO:
```bash
# Esto guarda el literal del comando, no el valor
OPENCLAW_API_KEY=$(openclaw config get gateway.token)
```

---

## FIX 041 - WS Handshake Protocol Alignment

**Fecha**: 2026-05-02

### Problema:
WS handshake fallaba porque GranClaw enviaba `connect` inmediatamente tras abrir socket.
OpenClaw Gateway requiere: `connect.challenge` → `connect` → `hello-ok`

### Causa raíz:
El cliente enviaba `connect` request en `onopen` sin esperar el evento `connect.challenge` del servidor.
Esto es un error de protocolo - el servidor espera que el cliente espere el challenge primero.

### Solución:
1. Añadidos estados: `connectChallengeSeen`, `connectChallengeNonce`, `connectChallengeResolver`
2. Nuevo método `waitForConnectChallenge(timeout)` con Promise
3. `handleEvent` detecta `connect.challenge` y resuelve la Promise
4. `performHandshake` espera challenge antes de enviar connect
5. NO se añade nonce a params (rompe schema)

### Cambios aplicados:

**packages/openclaw-adapter/src/ws/openclaw-ws.client.ts**:
```typescript
// FIX 041: connect.challenge state
private connectChallengeSeen = false
private connectChallengeNonce: string | null = null
private connectChallengeResolver: (() => void) | null = null

// Wait for challenge before connect
private async waitForConnectChallenge(timeoutMs: number): Promise<void>

// In handleEvent:
if (event.event === 'connect.challenge') {
  this.connectChallengeSeen = true
  this.connectChallengeNonce = payload?.nonce || null
  if (this.connectChallengeResolver) this.connectChallengeResolver()
}

// In performHandshake:
await this.waitForConnectChallenge(10000)
// Then send connect
```

### Flujo correcto:
```
1. Cliente abre WebSocket con Authorization header
2. Servidor envía evento connect.challenge
3. Cliente detecta challenge, guarda nonce
4. Cliente envía request connect con params
5. Servidor responde hello-ok
6. Handshake completo
```

### Logging:
```
[WS] Waiting for connect.challenge event...
[WS] CONNECT CHALLENGE RECEIVED
[WS] Challenge nonce: <nonce>
[WS] CONNECT SENT: {...}
[WS] HELLO OK: {...}
```

### CRITICAL:
- NO enviar connect antes de recibir connect.challenge
- NO añadir nonce a connect params (rompe schema)
- Cambiar este flujo rompe WS completamente

---

## FIX 040 - WS Client Authorization Header

**Fecha**: 2026-05-01

### Problema:
WS/RPC no completaba handshake. El cliente usaba `new WebSocket(url)` (browser API) que no soporta headers custom. OpenClaw Gateway requiere `Authorization: Bearer` en el upgrade request.

### Causa raíz:
1. Browser WebSocket API no permite enviar headers en el upgrade request
2. Endpoint WS correcto es `/__openclaw__/ws` (no `/ws`)
3. Token debe ir como header HTTP `Authorization: Bearer <token>`, no solo en el connect params

### Solución:
1. Instalado paquete `ws` (Node.js WebSocket con soporte de headers)
2. Modificado `OpenClawWsClient` para usar `ws` con headers
3. Añadido handler `unexpected-response` para detectar rechazos 401/403
4. Actualizado `.env.example` con URL correcta y documentación

### Cambios aplicados:

**packages/openclaw-adapter/package.json**:
- Añadido `ws` a dependencies
- Añadido `@types/ws` a devDependencies

**packages/openclaw-adapter/src/ws/openclaw-ws.client.ts**:
```typescript
import WebSocket from 'ws'

// En connect():
const wsOptions: WebSocket.ClientOptions = {
  headers: {}
}

if (this.apiKey) {
  wsOptions.headers = {
    'Authorization': `Bearer ${this.apiKey}`
  }
}

this.ws = new WebSocket(this.wsUrl, wsOptions)

// Eventos con API de ws package:
this.ws.on('open', ...)
this.ws.on('close', ...)
this.ws.on('error', ...)
this.ws.on('message', ...)
this.ws.on('unexpected-response', ...) // detecta 401/403
```

**.env.example**:
```
OPENCLAW_WS_URL=ws://localhost:18789/__openclaw__/ws
# Token sent as Authorization: Bearer header in WS upgrade
OPENCLAW_API_KEY=
```

**docs/deployment/GRANCLAW_MACMINI_RUNBOOK.md**:
- Actualizado OPENCLAW_WS_URL con endpoint correcto
- Documentado que token va como Bearer header en upgrade

### Flujo WS correcto:
1. Abrir WebSocket con `Authorization: Bearer` header en upgrade
2. Si upgrade exitoso → socket abierto
3. Enviar `connect` request con params
4. Si `connect` exitoso → handshake completo
5. Ahora se pueden enviar otros métodos RPC

### Diagnóstico de errores:
- Si 401 en upgrade: token inválido o faltante
- Si connect falla: params incorrectos (client.id, client.mode)
- Si timeout: Gateway no responde o URL incorrecta

---

## FIX 039 - Dev Runtime Stabilization

**Fecha**: 2026-05-01

### Problema:
Entorno local se contaminaba con procesos viejos, mezcla de start/dev, Vite sin `--host`, falta de flujo único de arranque/parada.

### Solución:
1. Script unificado `scripts/granclaw-dev.sh`
2. Directorio `.run/` para logs y PID files
3. package.json con scripts dev/dev:stop/dev:restart/dev:status/dev:logs
4. Vite con `--host 0.0.0.0`
5. Documentación actualizada

### Archivos creados/modificados:

**scripts/granclaw-dev.sh**:
- Script bash con comandos: start, stop, restart, status, logs
- PID files en `.run/granclaw-{api,web}.pid`
- Logs en `.run/granclaw-{api,web}.log`
- Kill por PID y por puertos (limpia huérfanos)
- Health check automático en start
- Cross-platform (lsof/netstat)

**package.json**:
```json
{
  "dev": "./scripts/granclaw-dev.sh start",
  "dev:stop": "./scripts/granclaw-dev.sh stop",
  "dev:restart": "./scripts/granclaw-dev.sh restart",
  "dev:status": "./scripts/granclaw-dev.sh status",
  "dev:logs": "./scripts/granclaw-dev.sh logs",
  "dev:web": "-- --host 0.0.0.0",
  "start:api": "npm run start --workspace=@granclaw/api",
  "start:web": "npm run preview --workspace=@granclaw/web -- --host 0.0.0.0"
}
```

**.gitignore**: Añadido `.run/`

**README.md**: Sección "Arranque local"

**docs/deployment/GRANCLAW_MACMINI_RUNBOOK.md**: Flujo actualizado

**docs/deployment/GRANCLAW_TUI_BOOTSTRAP_COMMANDS.md**: Comandos actualizados

### Uso:
```bash
npm run dev           # Arrancar
npm run dev:status    # Estado
npm run dev:logs      # Logs
npm run dev:stop      # Parar
npm run dev:restart   # Reiniciar
```

---

## FIX 038 - Chat Session Contract Fix

**Fecha**: 2026-05-01

### Problema:
Chat enviaba sessionId inventado que no existía en backend, causando error "Session with id ... not found".
Además, respuesta venía envuelta en `{ success, data: { ... } }` y no se parseaba correctamente.

### Causa raíz:
1. `generateSessionId()` creaba IDs falsos (`session_<timestamp>_<random>`)
2. Respuesta de API envuelta en `response.data`, frontend leía `response.result` directamente

### Solución:
1. Removido `generateSessionId()` y toda lógica de sesiones inventadas
2. `/orchestrator/run` se llama sin sessionId
3. Parseo correcto: `const payload = response.data || response`
4. Errores reales visibles: `payload.error`

### Cambios aplicados:

**apps/web/src/components/chat/Chat.tsx**:
- Removido `generateSessionId()`, `sessionId`, `sessions`, `showSessions`
- Removido `useEffect` para cargar sesiones
- Removidos botones "Sesiones" y "Nueva"
- Añadido botón "Limpiar" para limpiar mensajes
- `api.run(message)` sin sessionId
- Parseo: `const payload = response.data || response`
- Errores: `payload.error || 'Error del sistema'`

### Flujo simplificado:
```
1. Usuario escribe mensaje
2. api.run(message) -> POST /orchestrator/run { message }
3. Respuesta: { success, data: { success, result, source } }
4. Parseo: payload = response.data || response
5. Si payload.success: mostrar payload.result
6. Si !payload.success: mostrar payload.error
```

---

## FIX 037 - Chat Real Response Rendering

**Fecha**: 2026-04-30

### Problema:
Chat mostraba "No se obtuvo respuesta" y textos técnicos antiguos ("ACK mode, streaming real pendiente").

### Causa raíz:
1. Página `/chat` tenía texto técnico hardcodeado
2. `formatResult()` no manejaba todos los formatos de respuesta

### Solución:
1. Removido texto técnico de `pages/chat/index.tsx`
2. Mejorado `formatResult()` para extraer contenido de múltiples formatos
3. Añadido console.log temporal para debugging
4. Mejor manejo de errores con mensajes específicos

### Cambios aplicados:

**apps/web/src/pages/chat/index.tsx**:
- Removido título "Chat" y párrafo con texto técnico
- Solo renderiza `<Chat />` limpio

**apps/web/src/components/chat/Chat.tsx**:
- `formatResult()` mejorado:
  - OpenAI choices format
  - Delta/streaming format
  - Campos: content, response, text, message, output, result
  - Recursión para objetos anidados
- `handleSend()` mejorado:
  - Console.log `[CHAT] orchestrator response`
  - Manejo de `success === true` vs `success === false`
  - Errores específicos del backend visibles
  - Fallback para formatos inesperados

### Flujo de respuesta:
```
1. api.run(message, sessionId) -> POST /orchestrator/run
2. Backend devuelve: { success, result, source, error? }
3. Si success === true:
   - formatResult(result) extrae string
   - source se muestra como label
4. Si success === false:
   - Muestra error específico
5. En catch:
   - Muestra error de conexión
```

---

## FIX 036 - Frontend Product UX

**Fecha**: 2026-04-30

### Objetivo:
Convertir el frontend de desarrollo a un producto usable con buena experiencia de usuario.

### Cambios aplicados:

**apps/web/src/components/chat/types.ts**:
- ChatMessage simplificado con `source`, `toolId`, `timestamp`

**apps/web/src/components/chat/MessageList.tsx**:
- Auto-scroll usando `useRef` y `scrollIntoView({ behavior: 'smooth' })`
- Mejor estilo de burbujas (bordes redondeados, sombras)
- User messages: azul, alineados derecha
- Assistant messages: blanco/gris, alineados izquierda
- Source labels discretos debajo del mensaje
- Indicador "Escribiendo..." con animación

**apps/web/src/components/chat/MessageInput.tsx**:
- Textarea en lugar de input (multiline)
- Enter envía mensaje
- Shift+Enter añade línea nueva
- Placeholder en español
- Botón deshabilitado cuando está vacío o cargando

**apps/web/src/components/chat/Chat.tsx**:
- Gestión de sesiones integrada
- `generateSessionId()` para crear session IDs
- Selector de sesiones dropdown
- Botón "Nueva" para crear sesión
- Header con "GranClaw Asistente"
- Error messages user-friendly en español
- `formatResult()` extrae contenido de respuestas OpenAI/tool

**apps/web/src/components/chat/index.ts**:
- Removida exportación de `StreamResponse` (no usado)

### UX mejorada:
- Interfaz tipo chat profesional
- Feedback visual de carga
- Scroll automático a mensajes nuevos
- Gestión de sesiones sin cambiar de página
- Mensajes de error amigables
- Input cómodo con soporte multilinea

---

## FIX 035 - Frontend Real Integration

**Fecha**: 2026-04-30

### Problema:
Frontend NO consumía correctamente el backend real. Chat mostraba "No response received".

### Solución:
1. Chat usa `/orchestrator/run` en lugar de `/orchestrator/run-stream`
2. Interpreta respuesta real: `{ success, result, source }`
3. Muestra source: (OpenClaw), (Tool), (Fallback)
4. Debug panel muestra auth-status, tools, sessions

### Cambios aplicados:

**apps/web/src/services/api.ts**:
- `api.run()` llama a `/orchestrator/run`
- `api.getTools()` llama a `/tools`
- `api.getOpenClawAuthStatus()` llama a `/openclaw/auth-status`
- Tipo `OrchestratorResponse` exportado

**apps/web/src/components/chat/Chat.tsx**:
- Usa `api.run()` en lugar de `api.runStream()`
- `formatResult()` extrae contenido de respuesta OpenAI/tool
- `formatSource()` muestra label según source
- Header: "Asistente activo" (no "ACK mode")

**apps/web/src/pages/debug/index.tsx** (nuevo):
- Muestra `/openclaw/auth-status`
- Muestra `/tools`
- Muestra `/sessions`

**apps/web/src/App.tsx**:
- Ruta `/debug` añadida

---

## FIX 034 - WS Official Client Alignment

**Fecha**: 2026-04-30

### Problema:
FIX 033 usaba valores `web:operator` que NO son soportados por OpenClaw Gateway schema.

### Solución:
Usar valores oficiales documentados para backend confiable:
- `client.id = "gateway-client"`
- `client.mode = "backend"`

### Cambios aplicados:

**packages/openclaw-adapter/src/ws/openclaw-ws.client.ts**:
- Default `wsClientId`: `gateway-client` (era `web`)
- Default `wsClientMode`: `backend` (era `operator`)
- Fallback oficial: `gateway-client:backend`

**.env.example**:
```
OPENCLAW_WS_CLIENT_ID=gateway-client
OPENCLAW_WS_CLIENT_MODE=backend
OPENCLAW_WS_CLIENT_VARIANTS=gateway-client:backend,cli:operator
```

### Valores oficiales OpenClaw Gateway:
| client.id | client.mode | Uso |
|-----------|-------------|-----|
| `gateway-client` | `backend` | Backend confiable |
| `cli` | `operator` | CLI operador |

### Connect params finales:
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

## FIX 033 - WS Connect Schema Alignment

**Fecha**: 2026-04-30

### Bugs descubiertos en Mac mini TUI testing:

1. **Bug interno GranClaw**: `request('connect')` fallaba con "Not connected" porque:
   - En `onopen` handler, `this.state` era 'connecting' (no 'connected')
   - `request()` rechazaba porque `state !== 'connected'`
   - Fix: `socketOpen` flag separado, permitir 'connect' cuando socket abierto

2. **Bug schema OpenClaw Gateway**: Después de fix 1, Gateway rechazaba con INVALID_REQUEST:
   - `/client/id` y `/client/mode` "must be equal to constant"
   - Gateway tiene schema con constantes válidas
   - Fix: client.id/mode configurables via env vars

### Cambios aplicados:

**packages/openclaw-adapter/src/types.ts**:
- `WsClientConfig.wsClientId` - ID cliente configurable
- `WsClientConfig.wsClientMode` - Modo cliente configurable
- `WsClientConfig.wsClientVariants` - Variantes a probar

**packages/openclaw-adapter/src/ws/openclaw-ws.client.ts**:
- `socketOpen` flag separado de `handshakeComplete`
- Constructor lee de config/env con defaults (`web`, `operator`)
- `request()` permite 'connect' cuando `socketOpen=true`
- `performHandshake()` usa client.id/mode configurables
- Soporte para variantes de client identity
- Detección de errores INVALID_REQUEST de schema

### Variables de entorno:

| Variable | Default | Descripción |
|----------|---------|-------------|
| `OPENCLAW_WS_CLIENT_ID` | `web` | ID cliente (schema Gateway) |
| `OPENCLAW_WS_CLIENT_MODE` | `operator` | Modo cliente |
| `OPENCLAW_WS_CLIENT_VARIANTS` | (vacío) | Formato: `id:mode,id:mode` |

### Flujo de handshake corregido:

1. WebSocket `onopen` → `socketOpen = true`
2. `performHandshake()` llama `request('connect', ...)`
3. `request()` permite porque `socketOpen=true`
4. Si falla con INVALID_REQUEST → prueba siguiente variante
5. Si éxito → `handshakeComplete = true`, `state = 'connected'`

### Notas:
- WS se mantiene opcional hasta validación completa
- REST y /tools/invoke siguen siendo caminos principales

---

## WS Runtime Alignment

**Fecha**: 2026-04-30

### Estado actual:
- **REST**: Funciona correctamente
- **tools/invoke**: Funciona correctamente
- **Orchestrator**: Funciona correctamente
- **WS**: Opcional, aún no confirmado contra OpenClaw real

### Cambios aplicados:
- Logging detallado en OpenClawWsClient:
  - `[WS] Connecting to:`, `[WS] RAW MESSAGE:`, `[WS] PARSED:`
  - `[WS] ERROR:`, `[WS] CONNECT REQUEST:`, `[WS] CONNECT RESPONSE:`
- Fallback de variantes de auth:
  1. `{ token: API_KEY }` (raw)
  2. `{ token: "Bearer " + API_KEY }`
  3. sin auth
- Captura de `lastError` y `lastHandshakeResponse`
- `wsHandshakeResponse` añadido a `/openclaw/auth-status` details

### Notas importantes:
- WS se mantiene como opcional hasta validación completa contra OpenClaw real
- REST y /tools/invoke son los caminos principales actuales
- No se implementa streaming real hasta confirmar eventos WS

---

## FIX 031 - Pre-commit Runbook + Clean Tree

**Fecha**: 2026-04-30

### Cambios aplicados:
- Runbook actualizado: endpoints protegidos usan Bearer token
- TUI bootstrap actualizado: login antes de endpoints protegidos
- dist/ y *.tsbuildinfo eliminados del repo
- .gitignore ya contiene todas las entradas necesarias

### Endpoints públicos (sin token):
- `/health`
- `/openclaw/status`
- `/auth/login`

### Endpoints protegidos (requieren Bearer token):
- `/openclaw/auth-status`
- `/openclaw/tools-status`
- `/openclaw/ws-rpc-status`
- `/tools`
- `/orchestrator/run`

### Flujo correcto de validación:
```bash
# 1. Públicos
curl -s http://localhost:3001/health

# 2. Login
TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@granclaw.local"}' | jq -r '.data.token')

# 3. Protegidos con token
curl -s http://localhost:3001/openclaw/auth-status \
  -H "Authorization: Bearer $TOKEN"
```

---

## Env Bootstrap

**Fecha**: 2026-04-30

### Fix dotenv (prompt 029):
- `dotenv` añadido a `apps/api/package.json` dependencies

### Fix env path (prompt 030):
- Busca .env en múltiples rutas: `cwd/.env`, `cwd/../../.env`, `__dirname/../../.env`
- Muestra `[ENV] Loaded from: <path>` cuando encuentra
- Muestra `[ENV] No .env file found` si no encuentra
- Validación individual de OPENCLAW_BASE_URL y OPENCLAW_API_KEY

### Flujo garantizado:
```bash
git clone <repo>
npm install          # instala dotenv
npm run build --workspaces
npm run start --workspace=@granclaw/api  # busca .env en múltiples paths
```

---

## Deployment Runbook

**Fecha**: 2026-04-30

### Archivos creados:
- `docs/deployment/GRANCLAW_MACMINI_RUNBOOK.md` - Runbook operativo completo
- `docs/deployment/GRANCLAW_TUI_BOOTSTRAP_COMMANDS.md` - Comandos TUI secuenciales

### Variables de entorno:
| Variable | Uso |
|----------|-----|
| `OPENCLAW_BASE_URL` | REST + /tools/invoke |
| `OPENCLAW_WS_URL` | WebSocket RPC |
| `OPENCLAW_API_KEY` | Auth para todas las superficies |
| `VITE_API_URL` | UI conecta a API |

### Puertos:
| Puerto | Servicio |
|--------|----------|
| 18789 | OpenClaw Gateway |
| 3001 | GranClaw API |
| 5173 | GranClaw Web |

### Streaming actual:
- ACK mode (chat.send devuelve ack)
- Streaming real pendiente de eventos WS (chat.chunk, chat.done)

---

## FIX 025 - Pre Mac mini Ready

**Fecha**: 2026-04-29

### Cambios aplicados:
1. **WS handshake alineado con protocolo oficial**
   - minProtocol/maxProtocol: 3
   - client: { id, version, platform, mode }
   - caps/commands: []
   - permissions: {}
   - locale: 'en'
   - userAgent: 'granclaw-client'

2. **Streaming corregido a ACK mode**
   - StreamMode: 'ack' | 'fallback' | 'tool'
   - UI actualizada sin referencias a streaming real

3. **tools.invoke documentado como endpoint sensible**
   - /tools/invoke es superficie de operador completo
   - Debe usarse solo en loopback o red privada
   - Nunca exponer públicamente

4. **Repo limpio de artefactos build**
   - Eliminados dist/ de apps y packages
   - Eliminados *.tsbuildinfo

---

## Validación Auth OpenClaw

**Fecha**: 2026-04-30

### Endpoint: GET /openclaw/auth-status

Valida autenticación contra todas las superficies OpenClaw:

```typescript
interface AuthCheckResponse {
  rest: 'ok' | 'fail' | 'not_configured'
  ws: 'ok' | 'fail' | 'not_configured'
  tools: 'ok' | 'fail' | 'not_configured'
  details: {
    restStatus?: number
    restError?: string
    wsConnected?: boolean
    wsHandshakeComplete?: boolean
    wsError?: string
    toolsOk?: boolean
    toolsError?: string
  }
  timestamp: string
}
```

**Validaciones**:
1. **REST**: GET /v1/models con Bearer token
2. **WS**: Conectar y verificar handshake RPC
3. **Tools**: POST /tools/invoke con payload mínimo

---

## Estado actual

- [x] Estructura de carpetas creada
- [x] README.md inicial
- [x] PROJECT_MEMORY.md creado
- [x] packages/core con tipos base
- [x] Contratos de adapters definidos
- [x] Adapters skeleton implementados
- [x] Backend API base
- [x] Frontend UI base
- [x] REST client implementado
- [x] WebSocket client implementado (estructura básica)
- [x] Endpoint /openclaw/status
- [x] Endpoint /openclaw/ws-status
- [x] Webhooks client implementado (estructura básica)
- [x] Endpoint POST /openclaw/webhook/test
- [x] Orchestrator base implementado
- [x] Endpoint POST /orchestrator/run
- [x] Sistema de presets implementado
- [x] Sistema de agentes implementado
- [x] Orchestrator usa configuración dinámica
- [x] Persistencia file-based implementada
- [x] **Sistema de sesiones con historial**
- [x] **Orchestrator integrado con sessions**
- [x] **Streaming base implementado (WS simulado)**
- [x] **Endpoint POST /orchestrator/run-stream**
- [x] **UI chat con streaming base**
- [x] **Autenticación básica (email-based)**
- [x] **Multi-tenant base implementado**
- [x] **WS RPC base compatible Gateway**
- [x] **Endpoint GET /openclaw/ws-rpc-status**
- [x] **Sistema de tools extensible**
- [x] **Tools básicas: echo, time, http**
- [x] **Endpoints GET /tools y GET /tools/:id**
- [x] **OpenClaw Tools RPC wrapper**
- [x] **Modo híbrido tools (internal/openclaw)**
- [x] **Endpoint GET /openclaw/tools-status**
- [x] **Workspaces npm configurados**
- [x] **Auth middleware aplicado en todas las rutas**
- [x] **Tenant isolation real en rutas protegidas**
- [x] **WS RPC alineado con protocolo (ok/payload)**
- [x] **REST completions con model obligatorio**
- [x] **OpenClawToolsHttpClient (/tools/invoke documentado)**
- [x] **Runtime fix completado** (package.json apunta a dist)
- [x] **Handshake WS corregido** (role: operator, auth sin type: bearer)
- [x] **tools.execute DESHABILITADO** (requiere flag experimental)
- [x] **/tools/invoke es método oficial**
- [x] **chat.send devuelve ack** (streaming parcial)
- [x] **Seguridad httpTool mejorada** (bloquea .local, .internal, redes privadas)
- [x] **/tools y /openclaw/tools-status protegidos**
- [x] **Tenants/users migrados a storage file-based**
- [x] **UI login mínima implementada** (`/login`)
- [x] **API web configurable con VITE_API_URL**
- [x] **executeToolViaOpenClaw usa /tools/invoke HTTP por defecto**
- [x] **Frontend consume /orchestrator/run correctamente**
- [x] **Debug panel muestra auth-status, tools, sessions**
- [x] **Chat muestra source: OpenClaw/Tool/Fallback**
- [ ] Payloads RPC exactos (pendiente validación contra OpenClaw real)
- [ ] Streaming real via eventos chat.chunk/chat.done
- [ ] Flujos reales de webhooks (pendiente definición)
- [ ] Streaming HTTP real para frontend
- [ ] Password/OAuth (seguridad producción)

---

## Pendiente

1. Documentar protocolo WS/RPC real de OpenClaw
2. Implementar eventos reales de WebSocket
3. Definir flujos reales de Webhooks
4. Migrar a base de datos real (PostgreSQL/SQLite)
5. ~~Añadir autenticación~~ ✅ (básica)
6. Diseño UI elaborado
7. Configurar CI/CD
8. Extender orchestrator con más operaciones
9. CRUD completo de presets y agents
10. UI para gestión de sessions
11. Añadir password/hash a autenticación
12. Añadir OAuth support
13. ~~UI de login~~ completado (mínima)

---

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Cambios en API de OpenClaw | Adapter como capa de abstracción, contratos estables |
| Protocolo WS no documentado | Estructura flexible con TODOs |
| Complejidad creciente | Documentación estricta, ADRs |
| Dependencia de entorno | Variables de entorno, documentación de setup |
| Pérdida de datos en file-db | Migración a DB real planificada |

---

## Cambios importantes

| Fecha | Cambio | Autor |
|-------|--------|-------|
| 2026-04-28 | Bootstrap inicial del proyecto | Claude |
| 2026-04-28 | Creación de packages/core con tipos y contratos | Claude |
| 2026-04-28 | Renombrado a GranClaw | Claude |
| 2026-04-28 | Creación de adapters skeleton | Claude |
| 2026-04-28 | Creación de backend API base | Claude |
| 2026-04-28 | Creación de UI base | Claude |
| 2026-04-28 | Integración REST mínima con OpenClaw | Claude |
| 2026-04-28 | Integración WebSocket básica con OpenClaw | Claude |
| 2026-04-28 | Integración Webhooks básica | Claude |
| 2026-04-28 | Primera capa de orquestación | Claude |
| 2026-04-28 | Sistema de presets y agentes | Claude |
| 2026-04-28 | Persistencia file-based | Claude |
| 2026-04-28 | Sistema de sesiones con historial | Claude |
| 2026-04-28 | Streaming base via WebSocket | Claude |
| 2026-04-28 | UI chat con streaming | Claude |
| 2026-04-28 | Auth básica (email, sin password) | Claude |
| 2026-04-28 | Multi-tenant base | Claude |
| 2026-04-29 | WS RPC compatible Gateway | Claude |
| 2026-04-29 | Sistema de tools extensible | Claude |
| 2026-04-29 | httpTool y contexto de ejecución | Claude |
| 2026-04-29 | OpenClaw tools gateway integration | Claude |
| 2026-04-29 | Reverse engineering WS protocol docs | Claude |
| 2026-04-29 | Estabilización build/auth/RPC | Claude |
| 2026-04-29 | Fix compile and contracts | Claude |
| 2026-04-29 | Fix runtime start | Claude |
| 2026-04-29 | Fix 023 pre deploy final fixes | Codex/Claude |

---

## Prompts ejecutados

| ID | Fecha | Descripción | Resultado |
|----|-------|-------------|-----------|
| 001 | 2026-04-28 | Bootstrap estructura inicial | Completado |
| 002 | 2026-04-28 | Crear core con tipos y contratos | Completado |
| 003 | 2026-04-28 | Crear adapters skeleton | Completado |
| 004 | 2026-04-28 | Crear backend API base | Completado |
| 005 | 2026-04-28 | Crear UI base | Completado |
| 006 | 2026-04-28 | Integración REST mínima OpenClaw | Completado |
| 007 | 2026-04-28 | Integración WebSocket básica OpenClaw | Completado |
| 008 | 2026-04-28 | Integración Webhooks básica | Completado |
| 009 | 2026-04-28 | Orchestrator base | Completado |
| 010 | 2026-04-28 | Sistema presets y agentes | Completado |
| 011 | 2026-04-28 | Persistencia file-based | Completado |
| 012 | 2026-04-28 | Sistema de sesiones | Completado |
| 013 | 2026-04-28 | Streaming base WS | Completado |
| 014 | 2026-04-28 | UI chat streaming | Completado |
| 015 | 2026-04-28 | Auth y multi-tenant base | Completado |
| 016 | 2026-04-29 | WS RPC compatible Gateway | Completado |
| 017 | 2026-04-29 | Sistema de tools extensible | Completado |
| 018 | 2026-04-29 | httpTool y ejecución real | Completado |
| 019 | 2026-04-29 | OpenClaw tools gateway integration | Completado |
| 020 | 2026-04-29 | Reverse engineering WS protocol | Completado |
| 021 | 2026-04-29 | Estabilización build/auth/RPC | Completado |
| 022 | 2026-04-29 | Fix compile and contracts | Completado |
| 023 | 2026-04-29 | Fix runtime start | Completado |
| 024 | 2026-04-29 | Fix 023 pre deploy final fixes | Completado |
| 025 | 2026-04-29 | Runtime final preparation | Completado |
| 026 | 2026-04-29 | FIX 025 pre Mac mini ready | Completado |
| 027 | 2026-04-30 | OpenClaw auth validation | Completado |
| 028 | 2026-04-30 | Mac mini deployment runbook | Completado |
| 029 | 2026-04-30 | Env bootstrap fix | Completado |
| 030 | 2026-04-30 | Env path resolution fix | Completado |
| 031 | 2026-04-30 | Pre-commit runbook + clean tree | Completado |
| 032 | 2026-04-30 | WS runtime alignment | Completado |
| 033 | 2026-04-30 | WS connect schema alignment | Completado |
| 034 | 2026-04-30 | WS official client alignment | Completado |
| 035 | 2026-04-30 | Frontend real integration | Completado |
| 036 | 2026-04-30 | Frontend product UX | Completado |
| 037 | 2026-04-30 | Chat real response rendering | Completado |
| 038 | 2026-05-01 | Chat session contract fix | Completado |
| 039 | 2026-05-01 | Dev runtime stabilization | Completado |
| 040 | 2026-05-01 | WS client Authorization header | Completado |
| 041 | 2026-05-02 | WS handshake protocol alignment | Completado |
| 042 | 2026-05-02 | Deploy reproducible | Completado |
| 050 | 2026-05-02 | GranClaw Hub Base | Completado |
| 051 | 2026-05-02 | GranClaw Hub v2 | Completado |
| 052 | 2026-05-02 | GranClaw Hub v3 Multi-Tenant | Completado |
| 053 | 2026-05-02 | GranClaw Hub v4 Admin Endpoints | Completado |
| 070 | 2026-05-02 | Auth Sessions Base | Completado |
| 071 | 2026-05-03 | Auth Complete v1 | Completado |
| 072 | 2026-05-03 | Auth Guard & Error Translation | Completado |
| 073 | 2026-05-03 | Real Execution Trace | Completado |
| 074 | 2026-05-03 | Execution Guarantees | Completado |
| 075 | 2026-05-03 | Debug Snapshot & Status Bar | Completado |
| 080 | 2026-05-03 | Task System v1 | Completado |
| 090 | 2026-05-03 | Tool Proposal System v1 | Completado |
| 091 | 2026-05-03 | Approved Capabilities v1 | Completado |
| 092 | 2026-05-04 | Tool Proposal UX Feedback | Completado |

---

## Reportes Claude

| ID | Fecha | Archivo |
|----|-------|---------|
| 000 | 2026-04-28 | reports/claude/000_bootstrap_report.md |
| 001 | 2026-04-28 | reports/claude/001_core_contracts_report.md |
| 002 | 2026-04-28 | reports/claude/002_openclaw_adapter_base_report.md |
| 003 | 2026-04-28 | reports/claude/003_backend_base_report.md |
| 004 | 2026-04-28 | reports/claude/004_ui_base_report.md |
| 005 | 2026-04-28 | reports/claude/005_openclaw_rest_integration_report.md |
| 006 | 2026-04-28 | reports/claude/006_openclaw_ws_rpc_report.md |
| 007 | 2026-04-28 | reports/claude/007_openclaw_webhooks_report.md |
| 008 | 2026-04-28 | reports/claude/008_orchestrator_base_report.md |
| 009 | 2026-04-28 | reports/claude/009_presets_agents_report.md |
| 010 | 2026-04-28 | reports/claude/010_persistence_base_report.md |
| 011 | 2026-04-28 | reports/claude/011_sessions_context_report.md |
| 012 | 2026-04-28 | reports/claude/012_streaming_ws_report.md |
| 013 | 2026-04-28 | reports/claude/013_ui_chat_stream_report.md |
| 014 | 2026-04-28 | reports/claude/014_auth_multitenant_report.md |
| 015 | 2026-04-29 | reports/claude/015_openclaw_gateway_rpc_report.md |
| 016 | 2026-04-29 | reports/claude/016_agents_tools_base_report.md |
| 017 | 2026-04-29 | reports/claude/017_tools_real_integration_report.md |
| 018 | 2026-04-29 | reports/claude/018_openclaw_tools_gateway_report.md |
| 019 | 2026-04-29 | reports/claude/019_reverse_engineering_ws_report.md |
| 020 | 2026-04-29 | reports/claude/020_stabilize_build_auth_rpc_report.md |
| 021 | 2026-04-29 | reports/claude/021_fix_compile_and_contracts_report.md |
| 022 | 2026-04-29 | reports/claude/022_fix_runtime_start_report.md |
| 023 | 2026-04-29 | reports/claude/023_pre_deploy_final_fixes_report.md |
| 024 | 2026-04-29 | reports/claude/024_runtime_final_prep_report.md |
| 025 | 2026-04-29 | reports/claude/025_pre_macmini_ready_report.md |
| 026 | 2026-04-30 | reports/claude/027_openclaw_auth_validation_report.md |
| 027 | 2026-04-30 | reports/claude/028_granclaw_macmini_runbook_report.md |
| 028 | 2026-04-30 | reports/claude/029_env_bootstrap_fix_report.md |
| 029 | 2026-04-30 | reports/claude/030_env_path_fix_report.md |
| 030 | 2026-04-30 | reports/claude/031_pre_commit_runbook_clean_report.md |
| 031 | 2026-04-30 | reports/claude/032_ws_runtime_alignment_report.md |
| 032 | 2026-04-30 | reports/claude/033_ws_connect_schema_alignment_report.md |
| 033 | 2026-04-30 | reports/claude/034_ws_official_client_alignment_report.md |
| 034 | 2026-04-30 | reports/claude/035_frontend_real_integration_report.md |
| 035 | 2026-04-30 | reports/claude/036_frontend_product_polish_report.md |
| 036 | 2026-04-30 | reports/claude/037_chat_response_fix_report.md |
| 037 | 2026-05-01 | reports/claude/038_chat_session_contract_fix_report.md |
| 038 | 2026-05-01 | reports/claude/039_dev_runtime_stabilization_report.md |
| 039 | 2026-05-01 | reports/claude/040_ws_client_auth_header_report.md |
| 040 | 2026-05-02 | reports/claude/041_ws_handshake_protocol_fix_report.md |
| 041 | 2026-05-02 | reports/claude/042_deploy_reproducibility_fix_report.md |
| 050 | 2026-05-02 | reports/claude/050_granclaw_hub_base_report.md |
| 051 | 2026-05-02 | reports/claude/051_granclaw_hub_v2_report.md |
| 052 | 2026-05-02 | reports/claude/052_granclaw_hub_v3_multitenant_report.md |
| 053 | 2026-05-02 | reports/claude/053_granclaw_hub_v4_admin_report.md |
| 070 | 2026-05-02 | reports/claude/070_auth_sessions_report.md |
| 071 | 2026-05-03 | reports/claude/071_auth_complete_report.md |
| 090 | 2026-05-03 | reports/claude/090_tool_proposal_system_report.md |
| 091 | 2026-05-03 | reports/claude/091_approved_capabilities_report.md |
| 092 | 2026-05-04 | reports/claude/092_tool_proposal_ux_feedback_report.md |
| 100 | 2026-05-04 | reports/claude/100_real_capabilities_v1_report.md |
| 101 | 2026-05-04 | reports/claude/101_capabilities_ux_polish_report.md |
| 102 | 2026-05-04 | reports/claude/102_missing_capability_detector_fix_report.md |

---

## Entorno Windows

- OS: Windows
- Path proyecto: c:/Users/Guille/Desktop/GRANCLAW/openclaw-custom-layer
- Node: (pendiente verificar versión)
- NPM/PNPM: (pendiente definir)

---

## Entorno Mac mini

- (Pendiente configurar)

---

## OpenClaw assumptions

- OpenClaw expone API REST y/o WebSocket
- Se requiere API key para autenticación
- URLs base configurables via variables de entorno
- No se tiene acceso al código fuente de OpenClaw
- OpenClaw es tratado como caja negra externa
- Protocolo WS/RPC no documentado oficialmente
- Webhooks endpoints no predefinidos

---

## Tipos definidos (packages/core)

- Tenant
- User
- Agent
- Session
- Task
- Preset

---

## Contratos definidos (packages/core)

- AgentRuntimeAdapter
- TaskFlowAdapter
- ConfigAdapter
- WebhookAdapter

---

## Adapters implementados (packages/openclaw-adapter)

| Adapter | Contrato | Estado |
|---------|----------|--------|
| OpenClawRuntimeAdapter | AgentRuntimeAdapter | REST + WS RPC + executeToolViaOpenClaw via /tools/invoke HTTP |
| OpenClawTaskFlowAdapter | TaskFlowAdapter | Skeleton |
| OpenClawConfigAdapter | ConfigAdapter | Skeleton |
| OpenClawWebhookAdapter | WebhookAdapter | Skeleton |
| OpenClawRestClient | N/A | REST fallback implementado |
| OpenClawWsClient | N/A | WS RPC compatible Gateway |
| OpenClawChatRpc | N/A | Wrapper chat/sessions RPC |
| OpenClawWebhooksClient | N/A | Webhooks trigger básico |

---

## Backend API (apps/api)

| Módulo | Endpoints | Estado |
|--------|-----------|--------|
| health | GET /health | Implementado |
| tenants | GET /tenants | Implementado |
| users | GET /users | Implementado |
| presets | GET /presets | Implementado |
| presets | POST /presets | Implementado |
| agents | GET /agents | Implementado |
| agents | POST /agents | Implementado |
| sessions | GET /sessions | Implementado |
| sessions | POST /sessions | Implementado |
| sessions | GET /sessions/:id | Implementado |
| sessions | POST /sessions/:id/message | Implementado |
| tasks | GET /tasks | Implementado |
| audit | GET /audit | Implementado |
| openclaw | GET /openclaw/status | Implementado |
| openclaw | GET /openclaw/ws-status | Implementado |
| openclaw | GET /openclaw/ws-rpc-status | Implementado |
| openclaw | GET /openclaw/tools-status | Implementado |
| openclaw | POST /openclaw/webhook/test | Implementado |
| orchestrator | POST /orchestrator/run | Implementado |
| orchestrator | POST /orchestrator/run-stream | Implementado |
| tools | GET /tools | Implementado |
| tools | GET /tools/:id | Implementado |
| auth | POST /auth/login | Implementado |
| auth | POST /auth/register | Implementado |
| auth | POST /auth/logout | Implementado |
| auth | GET /auth/me | Implementado |
| granclaw-hub | GET /granclaw-hub/config | Implementado |
| granclaw-hub | GET /granclaw-hub/config/:tenantId | Implementado |
| granclaw-hub | POST /granclaw-hub/config/:tenantId | Implementado |
| granclaw-hub | DELETE /granclaw-hub/config/:tenantId | Implementado |
| tasks | GET /tasks/:id | Implementado |
| tool-proposals | GET /tool-proposals | Implementado |
| tool-proposals | GET /tool-proposals/:id | Implementado |
| tool-proposals | POST /tool-proposals/:id/approve | Implementado |
| tool-proposals | POST /tool-proposals/:id/reject | Implementado |
| capabilities | GET /capabilities | Implementado |
| capabilities | GET /capabilities/:id | Implementado |
| capabilities | POST /capabilities/:id/enable | Implementado |
| capabilities | POST /capabilities/:id/disable | Implementado |

**Stack**: Node.js + TypeScript + HTTP nativo
**Almacenamiento**: File-based (JSON)
**Puerto**: 3001

---

## Frontend UI (apps/web)

| Página | Ruta | Estado |
|--------|------|--------|
| Dashboard | / | Implementado |
| Login | /login | Implementado |
| Register | /register | Implementado |
| Chat | /chat | Implementado |
| Agents | /agents | Implementado |
| Sessions | /sessions | Implementado |
| Tasks | /tasks | Implementado |
| Presets | /presets | Implementado |
| Config | /config | Implementado |

**Stack**: React + TypeScript + Vite
**Router**: Simple (sin librería)
**Puerto**: 5173
**Backend**: `import.meta.env.VITE_API_URL || "http://localhost:3001"`

---

## Integración OpenClaw

| Tipo | Estado | Notas |
|------|--------|-------|
| REST | Implementado (fallback) | Cliente mínimo con fetch nativo |
| WebSocket/RPC | RPC compatible Gateway | Handshake connect, métodos chat.* |
| Webhooks | Estructura básica | TaskFlow trigger, sin flujos reales |

**Variables de entorno**:
- OPENCLAW_BASE_URL
- OPENCLAW_WS_URL
- OPENCLAW_API_KEY
- OPENCLAW_WEBHOOK_URL
- VITE_API_URL

**WebSocket RPC client** (OpenClawWsClient):
- connect() - Conecta y realiza handshake RPC (connect method)
- disconnect() - Cierra conexión
- request(method, params) - Envía request RPC, espera response
- notify(method, params) - Envía notificación sin esperar response
- onEvent(event, handler) - Escucha eventos del servidor
- offEvent(event, handler) - Remueve listener
- isConnected() - Verifica conexión con handshake completo
- isHandshakeComplete() - Verifica handshake
- getConnectResult() - Resultado del connect

**Chat RPC wrapper** (OpenClawChatRpc):
- chatHistory(params?) - chat.history
- chatSend(params) - chat.send
- chatAbort(params?) - chat.abort
- chatInject(params) - chat.inject
- sessionsList(params?) - sessions.list
- sessionsPatch(params) - sessions.patch
- channelsStatus(params?) - channels.status
- configPatch(params) - config.patch

**Métodos RPC conocidos**:
- connect (handshake obligatorio)
- chat.history
- chat.send
- chat.abort
- chat.inject
- sessions.list
- sessions.patch
- channels.status
- config.patch

**Runtime adapter WS**:
- connectRuntime() - Conecta con handshake RPC
- disconnectRuntime()
- isWsConnected() - Verifica handshake completo
- isHandshakeComplete()
- getConnectResult()
- getChatRpc() - Obtiene wrapper RPC
- getWsState()

**Webhooks client**:
- triggerFlow(endpoint, payload)
- getFlowStatus(endpoint)
- isConfigured()

---

## Sistema de Presets (apps/api/modules/presets)

**Configuración de comportamiento de agentes.**

```typescript
interface Preset {
  id: string
  name: string
  description?: string
  systemPrompt: string
  enabled: boolean
}
```

| Endpoint | Descripción |
|----------|-------------|
| GET /presets | Lista todos los presets |
| POST /presets | Crea un nuevo preset |

---

## Sistema de Agentes (apps/api/modules/agents)

**Identidades configurables con preset asociado y tools asignadas.**

```typescript
interface Agent {
  id: string
  tenantId: string
  name: string
  presetId: string
  tools: string[]  // IDs de tools disponibles para este agent
  active: boolean
}
```

| Endpoint | Descripción |
|----------|-------------|
| GET /agents | Lista todos los agentes |
| POST /agents | Crea un nuevo agente (valida presetId) |

---

## Sistema de Tools (apps/api/modules/tools)

**Sistema extensible de herramientas ejecutables por agents.**

```
apps/api/src/modules/tools/
  types.ts      # Tool, ToolExecutor, ToolExecutionResult, ToolInfo
  registry.ts   # registerTool, getTool, listTools, getTools
  service.ts    # echoTool, timeTool, initializeBuiltinTools, executeTool
  routes.ts     # handleListTools, handleGetTool
  index.ts      # Exports
```

**Tipos**:
```typescript
interface ToolExecutionContext {
  tenantId?: string
  userId?: string
  sessionId?: string
}

type ToolExecutor = (input: unknown, context?: ToolExecutionContext) => Promise<unknown>

interface Tool {
  id: string
  name: string
  description: string
  execute: ToolExecutor
}

interface ToolExecutionResult {
  success: boolean
  toolId: string
  result: unknown
  error?: string
}

interface ToolInfo {
  id: string
  name: string
  description: string
}
```

**Registry**:
- `registerTool(tool)` - Registra una tool
- `getTool(id)` - Obtiene una tool por id
- `listTools()` - Lista todas las tools (info pública)
- `hasTool(id)` - Verifica si existe
- `getTools(ids)` - Obtiene múltiples tools

**Tools builtin**:
| Tool | ID | Descripción | Keyword |
|------|----|-------------|---------|
| Echo | echo | Devuelve el input como está | "echo" |
| Time | time | Devuelve timestamp actual | "time", "hora", "fecha" |
| HTTP | http | Ejecuta HTTP requests externos | "http", "fetch", "api" |

**Seguridad httpTool**:
- URLs internas bloqueadas (localhost, 127.0.0.1, 0.0.0.0, ::1)
- Timeout obligatorio: 10 segundos (AbortController)
- Solo GET/POST soportados

**Endpoints**:

| Endpoint | Descripción |
|----------|-------------|
| GET /tools | Lista todas las tools disponibles |
| GET /tools/:id | Obtiene una tool por id |

**Detección de tools**:
- El orchestrator detecta tools por keyword simple en el mensaje
- Si el agent tiene tools asignadas y el mensaje contiene keyword → ejecuta tool
- La ejecución de tool tiene prioridad sobre OpenClaw/mock
- Se devuelve `source: "tool"` en el resultado

**Modo híbrido (internal/openclaw)**:
```typescript
// Agent con toolsConfig para modo híbrido
interface Agent {
  tools: string[]
  toolsConfig?: {
    [toolId]: {
      mode: 'internal' | 'openclaw'
    }
  }
}

// Ejemplo: time interno, http via OpenClaw
{
  tools: ['time', 'http'],
  toolsConfig: {
    time: { mode: 'internal' },
    http: { mode: 'openclaw' }
  }
}
```

**OpenClaw Tools HTTP** (packages/openclaw-adapter/src/tools):
- `OpenClawToolsHttpClient.invokeTool(input)` - Ejecuta via POST `/tools/invoke`
- `executeToolViaOpenClaw(toolName, params)` usa `/tools/invoke` por defecto
- `OpenClawToolsRpc.executeTool(toolName, params)` queda experimental y deshabilitado por defecto
- `tools.execute` RPC: NO CONFIRMADO por documentación oficial. No usar salvo flag experimental.

**Endpoint diagnóstico**: GET /openclaw/tools-status
```json
{
  "configured": true,
  "wsConnected": false,
  "rpcReady": false,
  "toolsMode": "hybrid",
  "methodTentative": "tools.execute",
  "note": "/tools/invoke HTTP documentado. tools.execute RPC no confirmado y deshabilitado por defecto."
}
```

**Ejemplo flujo**:
1. Agent tiene `tools: ["time", "echo"]`
2. Usuario envía "What time is it?"
3. Orchestrator detecta keyword "time" → ejecuta timeTool
4. Se devuelve resultado con `source: "tool"`, `toolId: "time"`

---

## Sistema de Sessions (apps/api/modules/sessions)

**Historial conversacional persistente.**

```typescript
interface SessionMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

interface Session {
  id: string
  messages: SessionMessage[]
  createdAt: number
  updatedAt: number
}
```

| Endpoint | Descripción |
|----------|-------------|
| GET /sessions | Lista todas las sesiones |
| POST /sessions | Crea una nueva sesión |
| GET /sessions/:id | Obtiene una sesión por id |
| POST /sessions/:id/message | Añade un mensaje a la sesión |

**Límite**: 20 mensajes por sesión (se eliminan los más antiguos)

---

## Orchestrator (apps/api/modules/orchestrator)

**Capa de orquestación con configuración dinámica y contexto conversacional.**

| Función | Descripción |
|---------|-------------|
| runSimpleAgentTask(input) | Ejecuta tarea via REST o mock con configuración de agent/preset y contexto de session |
| runStreamingTask(input) | Ejecuta tarea con streaming via WS, fallback a REST/mock |

**Endpoints**:
- POST /orchestrator/run
- POST /orchestrator/run-stream

**Comportamiento**:
- Si sessionId proporcionado → usa historial de mensajes
- Si agentId proporcionado → obtiene agent y preset
- Usa systemPrompt del preset en la ejecución
- Añade mensaje user al inicio, respuesta assistant al final
- Si OPENCLAW_BASE_URL configurado → REST call con contexto
- Si no configurado → respuesta mock
- Si agent tiene tools y se detecta keyword → ejecuta tool con `source: "tool"`
- Siempre devuelve `source: "mock" | "openclaw" | "tool"`

**Input**:
```json
{
  "message": "string",
  "agentId": "string (opcional)",
  "sessionId": "string (opcional)"
}
```

**Output**:
```json
{
  "success": boolean,
  "result": unknown,
  "source": "mock" | "openclaw" | "tool",
  "agentId": "string (si usado)",
  "presetId": "string (si usado)",
  "sessionId": "string (si usado)",
  "systemPrompt": "string (si usado)",
  "toolId": "string (si tool ejecutada)"
}
```

---

## Storage (apps/api/src/storage)

**Capa de persistencia file-based.**

```
apps/api/
  src/storage/
    file-db.ts      # Operaciones de archivo JSON
    storage.ts      # Interfaz de abstracción
    index.ts        # Exports
  data/
    presets.json    # Datos de presets
    agents.json     # Datos de agentes
    sessions.json   # Datos de sesiones
    tasks.json      # Datos de tareas
```

**Métodos**:
- `read<T>(entity)` - Lee todos los items
- `write<T>(entity, data)` - Escribe todos los items
- `append<T>(entity, item)` - Añade un item
- `getById<T>(entity, id)` - Obtiene por id
- `update<T>(entity, id, updates)` - Actualiza por id
- `remove<T>(entity, id)` - Elimina por id

**Interface Storage**:
- `getAll<T>(entity)` - Lista todos
- `getById<T>(entity, id)` - Obtiene uno
- `add<T>(entity, item)` - Añade uno
- `update<T>(entity, id, updates)` - Actualiza
- `remove<T>(entity, id)` - Elimina

---

## Streaming (apps/api/modules/orchestrator)

**Base de streaming de respuestas via WebSocket.**

```typescript
interface StreamTaskInput {
  message: string
  sessionId?: string
}

interface StreamTaskResult {
  success: boolean
  mode: 'stream' | 'fallback' | 'tool'
  result: unknown
  sessionId?: string
  toolId?: string
  error?: string
}
```

**Endpoint**: POST /orchestrator/run-stream

**Comportamiento**:
- Si WS conectado con handshake → usa RPC chat.send
- Si WS no disponible → fallback a REST/mock
- Integrado con sessions (añade user/assistant messages)
- Devuelve `mode: "stream" | "fallback" | "tool"`

**RPC streaming**:
- Usa chat.send method via OpenClawChatRpc
- Params: { message, sessionId }
- TODO: Validar payload exacto contra OpenClaw real

**Notas**:
- NO hace streaming HTTP real todavía
- `chat.send` devuelve ACK, no respuesta final
- La respuesta real queda pendiente de eventos chat/session
- Base para streaming real en frontend cuando se capturen eventos reales

## Streaming actual

- `chat.send` devuelve ACK
- respuesta real pendiente de eventos chat/session
- no llamar streaming real hasta capturar eventos

---

## UI Chat (apps/web/src/components/chat)

**Interfaz de chat tipo conversación.**

```
apps/web/src/
  components/chat/
    types.ts        # ChatMessage, StreamResponse
    Chat.tsx        # Container principal
    MessageList.tsx # Lista de mensajes
    MessageInput.tsx# Input con botón submit
    index.ts        # Exports
  pages/chat/
    index.tsx       # Página /chat
```

**Componentes**:
- `Chat` - Container con estado messages[] y loading
- `MessageList` - Render de mensajes con estilos user/assistant
- `MessageInput` - Input controlado con submit

**Flujo**:
1. Usuario escribe mensaje
2. Se añade mensaje user a la lista
3. Se muestra "typing..." mientras carga
4. Se llama a POST /orchestrator/run-stream
5. Se añade respuesta assistant a la lista

**API client**:
- `api.runStream(message, sessionId?)` - Llama a run-stream

**Estilos**:
- Inline styles (sin CSS externo)
- User messages: azul, alineados derecha
- Assistant messages: gris, alineados izquierda

---

## Auth Module (apps/api/src/modules/auth)

**Autenticación básica con email (sin password todavía).**

```
apps/api/src/
  modules/auth/
    types.ts        # User, Tenant, AuthSession, AuthContext
    service.ts      # login, validateToken, logout, etc.
    routes.ts       # handleLogin, handleGetMe
    index.ts        # Exports
  shared/
    auth-context.ts # Middleware de autenticación
  data/
    users.json      # Usuarios
    tenants.json    # Tenants
    auth-sessions.json # Sesiones activas
```

**Tipos**:
```typescript
interface User {
  id: string
  tenantId: string
  email: string
  role: 'admin' | 'user'
  active: boolean
  createdAt: number
}

interface Tenant {
  id: string
  name: string
  active: boolean
  createdAt: number
}

interface AuthSession {
  token: string
  userId: string
  tenantId: string
  createdAt: number
  expiresAt: number  // 24h
}

interface AuthContext {
  user: User
  tenant: Tenant
  session: AuthSession
}
```

**Endpoints**:

| Endpoint | Descripción |
|----------|-------------|
| POST /auth/login | Login con email, devuelve token |
| GET /auth/me | Info del usuario autenticado |

**Comportamiento login**:
1. Si no hay usuarios → primer usuario se crea como admin
2. Si usuario existe y está activo → crea sesión
3. Si usuario no existe (y hay otros usuarios) → error
4. Devuelve token Bearer para usar en requests

**Endpoints públicos** (no requieren token):
- `/health`
- `/auth/login`
- `/openclaw/status`

**TODO**:
- Añadir password (hash con bcrypt)
- Añadir OAuth support

---

## Multi-tenant

**Todas las entidades tienen tenantId para aislamiento de datos.**

**Entidades con tenantId**:
- User (pertenece a un tenant)
- Preset (aislado por tenant)
- Agent (aislado por tenant)
- Session (aislado por tenant)
- Task (aislado por tenant)

**Servicios actualizados**:
- `getAllPresets(tenantId?)` - filtra por tenant si se proporciona
- `getPresetByIdForTenant(id, tenantId)` - valida pertenencia
- `createPreset(input, tenantId)` - asigna tenantId
- Similar para agents, sessions y tasks
- `GET /tenants` lee tenants persistidos desde storage y devuelve solo el tenant autenticado
- `GET /users` lee users persistidos desde storage y devuelve usuarios públicos del tenant autenticado

**Orchestrator**:
- `runSimpleAgentTask({ ..., tenantId })` - usa tenantId para obtener agent/preset
- `runStreamingTask({ ..., tenantId })` - usa tenantId para contexto

---

## UI API Client (apps/web/src/services/api.ts)

**Cliente con soporte de autenticación.**

```typescript
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001"

// Token storage
const TOKEN_KEY = 'granclaw_token'
function getToken(): string | null
export function setToken(token: string): void
export function clearToken(): void

// Auth headers
function getAuthHeaders(): Record<string, string> {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// API methods
export const api = {
  // Auth
  login: (email) => postRequest('/auth/login', { email }),
  getMe: () => request('/auth/me'),

  // Resources (con auth headers automáticos)
  getHealth: () => request('/health'),
  getAgents: () => request('/agents'),
  // ...
}
```

**Flujo de autenticación UI**:
1. Usuario hace login con email
2. Recibe token, lo guarda con `setToken(token)`
3. Todas las requests incluyen `Authorization: Bearer <token>`
4. Para logout: `clearToken()`

**Página UI**:
- `/login` solicita email, llama `api.login(email)`, guarda token y redirige a `/chat`

---

## WebSocket RPC (packages/openclaw-adapter/src/ws)

**Protocolo RPC compatible con OpenClaw Gateway.**

```
packages/openclaw-adapter/src/ws/
  openclaw-ws.client.ts   # Cliente RPC base
  openclaw-chat.rpc.ts    # Wrapper chat/sessions
  index.ts                # Exports
```

**Tipos RPC**:
```typescript
interface RpcRequest {
  type: 'req'
  id: string
  method: string
  params?: unknown
}

interface RpcResponse {
  type: 'res'
  id: string
  ok: boolean
  payload?: unknown
  error?: unknown
}

interface RpcEvent {
  type: 'event'
  event: string
  payload?: unknown
}

interface ClientInfo {
  id: string
  version: string
  platform?: string
  mode?: string
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
```

**Handshake actual (FIX 025)**:
- role: `operator`
- scopes: `operator.read/operator.write`
- auth: `{ token }` sin `type: bearer`
- minProtocol/maxProtocol: `3`
- client: `{ id: 'granclaw', version: '1.0.0', platform, mode: 'operator' }`
- caps: `[]`
- commands: `[]`
- permissions: `{}`
- locale: `'en'`
- userAgent: `'granclaw-client'`

**Handshake obligatorio**:
1. Abrir conexión WebSocket
2. Enviar primer frame: `{ type: "req", id: "...", method: "connect", params: ConnectParams }`
3. Esperar response del servidor
4. Si OK → handshakeComplete = true
5. Ahora se pueden enviar otros métodos RPC

**Endpoint diagnóstico**: GET /openclaw/ws-rpc-status

```json
{
  "configured": true,
  "connected": false,
  "handshakeComplete": false,
  "protocol": "openclaw-gateway-rpc",
  "handshake": "required",
  "methodsKnown": ["connect", "chat.send", "chat.history", ...]
}
```

**TODO**:
- Payloads exactos pendientes de validar contra OpenClaw real
- Schema de ConnectParams puede variar
- Formato de errores RPC pendiente
- Eventos del servidor no documentados

---

## Reverse Engineering (docs/reverse-engineering)

**Fase de captura y análisis de tráfico WebSocket real de OpenClaw.**

```
docs/reverse-engineering/
  control-ui-capture-plan.md   # Plan paso a paso para capturar frames
  ws-frame-template.md         # Template para documentar frames
  ws-rpc-method-map.md         # Mapa de métodos RPC descubiertos
  ws-rpc-observations.md       # Registro de frames capturados
```

**Objetivo**: Observar tráfico real entre OpenClaw Control UI/WebChat y Gateway para documentar el protocolo RPC exacto.

**Estados de confirmación**:
| Estado | Significado |
|--------|-------------|
| CONFIRMED | Observado en tráfico real |
| ASSUMED | Inferido de código/docs, no confirmado |
| UNKNOWN | Requiere investigación |

**Proceso**:
1. Capturar frames usando DevTools (Network > WS)
2. Documentar en ws-rpc-observations.md usando template
3. Actualizar ws-rpc-method-map.md con métodos confirmados
4. Actualizar PROJECT_MEMORY.md con hallazgos relevantes

**Métodos pendientes de confirmación**:
- connect (handshake) - ASSUMED
- chat.send - ASSUMED
- chat.history - ASSUMED
- tools.execute - UNKNOWN (tentativo)

**Hallazgos pendientes**:
- [ ] Estructura exacta de connect params
- [ ] Confirmar si tools.execute existe
- [ ] Identificar eventos de streaming
- [ ] Documentar códigos de error
- [ ] Verificar heartbeat/ping mechanism

---

## FEATURE 075 - Debug Snapshot & Bottom Status Bar

**Fecha**: 2026-05-03

### Objetivo:
Añadir un sistema de depuración real y útil para entender qué pasa en cada ejecución, y corregir la barra de estado para que esté debajo del contenido (no encima).

### Problema resuelto:
- La UI mostraba "Acción ejecutada correctamente" sin garantías reales
- "No hay trazabilidad disponible" no daba información útil
- La StatusBar tapaba contenido (position: fixed)
- No había forma de saber qué pasó realmente en cada ejecución

### Backend - DebugSnapshot:

**trace.ts**:
```typescript
export interface DebugSnapshot {
  requestId: string
  timestamp: string
  route: string
  tenantId?: string
  userId?: string
  sessionPresent: boolean
  hubEvaluated: boolean
  hubAllowed?: boolean
  hubReason?: string
  orchestratorCalled: boolean
  openclawCalled?: boolean
  toolCalled?: boolean
  source?: 'openclaw' | 'tool' | 'mock' | 'fallback' | 'unknown'
  executionConfirmed: boolean
  tracePresent: boolean
  error?: string
}

export function generateRequestId(): string
```

**ExecutionTraceBuilder** actualizado:
- `requestId` único por ejecución
- Setters: `setRoute()`, `setTenantId()`, `setUserId()`, `setSessionPresent()`
- `getDebugSnapshot()` genera snapshot real con estado actual

### Backend - Logs sanitizados:

**routes.ts**:
```typescript
function logDebug(snapshot: DebugSnapshot): void {
  console.log(`[GranClaw Debug] requestId=${snapshot.requestId}`)
  console.log(`[GranClaw Debug] hubEvaluated=${...} allowed=${...}`)
  console.log(`[GranClaw Debug] orchestratorCalled=${...}`)
  console.log(`[GranClaw Debug] source=${...}`)
  console.log(`[GranClaw Debug] executionConfirmed=${...}`)
}
```

### Backend - Success corregido:

```typescript
// FEATURE 075: No success si no confirmado
const finalSuccess = result.success && debugSnapshot.executionConfirmed

ok(res, {
  ...result,
  success: finalSuccess,
  ...(result.success && !debugSnapshot.executionConfirmed ? {
    message: 'Permitido, pero no se pudo confirmar la ejecucion real'
  } : {}),
  warning,
  meta: {
    requestId,
    debugSnapshot,
    // ... resto de meta
  }
})
```

### Frontend - DebugPanel.tsx:

Nuevo componente colapsable:
- Muestra debugSnapshot en formato humano
- Campos: Request ID, Sesión, Hub evaluado, Decisión Hub, Orquestador, OpenClaw, Tool, Fuente, Ejecución confirmada, Trace presente, Error
- Botón "Ver datos técnicos" para JSON raw

### Frontend - StatusBar (no fixed):

**Cambios**:
- Ya no usa `position: fixed`
- Ubicada dentro del container, después del contenido
- Muestra resumen claro: `GranClaw · Permitido · Orquestador OK · OpenClaw · 1.2s`
- Si no confirmado: `GranClaw · Permitido · Ejecución no confirmada · Trace ausente`
- Expandible con detalles

### Frontend - Layout:

```
[Input]
[Resultado]
[Cómo se ejecutó]
[StatusBar] ← ahora dentro del contenido
[DebugPanel] ← colapsado por defecto
```

### Archivos modificados:

**Backend**:
- `apps/api/src/modules/orchestrator/trace.ts`
- `apps/api/src/modules/orchestrator/routes.ts`

**Frontend**:
- `apps/web/src/components/control/DebugPanel.tsx` (nuevo)
- `apps/web/src/components/control/StatusBar.tsx`
- `apps/web/src/components/control/index.ts`
- `apps/web/src/pages/control/Execute.tsx`

### Garantías implementadas:

1. **requestId único** por ejecución
2. **debugSnapshot** con estado real (no inventado)
3. **No success falso** - solo true si executionConfirmed
4. **Logs sanitizados** sin tokens/passwords
5. **Warning si falta trace**
6. **StatusBar al final** del contenido (no tapando)
7. **DebugPanel** para depuración detallada

---

## FIX 076 - Frontend API Wrapper Unwrap for Execution Meta

**Fecha**: 2026-05-03

### Problema:
El backend envuelve todas las respuestas con `ok(res, data)`:
```json
{
  "success": true,
  "data": { ...payload real... },
  "error": null
}
```

Pero `api.run()` devolvía el wrapper completo, y Execute.tsx intentaba leer:
- `response.meta` → undefined (debía ser `response.data.meta`)
- `response.source` → undefined
- `response.result` → undefined

Resultado:
- executionTrace no llegaba a la UI
- debugSnapshot no llegaba a la UI
- source quedaba "unknown"
- Aparecía "No hay trazabilidad disponible" aunque el backend la enviaba

### Solución:

**api.ts**:
```typescript
// Tipos para el payload real
interface OrchestratorMeta {
  requestId?: string
  hubDecision?: string[]
  executionTrace?: ExecutionTraceStep[]
  executionDurationMs?: number
  source?: string
  adapterStatus?: AdapterStatus
  debugSnapshot?: DebugSnapshot
}

export interface OrchestratorPayload {
  success: boolean
  result?: unknown
  source?: string
  error?: string
  warning?: string
  meta?: OrchestratorMeta
  // ...
}

// api.run() ahora desenvuelve
run: async (message, sessionId?, agentId?): Promise<OrchestratorPayload> => {
  const wrapped = await postRequest<OrchestratorWrappedResponse>(...)
  if (!wrapped.success || wrapped.error) {
    return { success: false, error: wrapped.error }
  }
  if (!wrapped.data) {
    return { success: false, error: 'No se recibio respuesta' }
  }
  return wrapped.data  // ← Payload real, no wrapper
}
```

### Resultado:
- Execute.tsx recibe el payload real directamente
- `response.meta` ahora contiene executionTrace, debugSnapshot, etc.
- `response.source` ahora tiene el valor correcto
- La trazabilidad se muestra correctamente
- No rompe otros endpoints (login, register, getHubConfig)

### Archivos modificados:
- `apps/web/src/services/api.ts`

---

## FIX 077 - Execution Error Classification & Debug Guarantee

**Fecha**: 2026-05-03

### Problema:
La UI mostraba "BLOQUEADO" con "Ha ocurrido un error" incluso en tareas simples, sin diferenciar entre:
- Hub bloqueó la acción (BLOQUEADO)
- Error técnico (ERROR)
- Permitido pero no confirmado (SIN CONFIRMAR)
- Permitido y confirmado (PERMITIDO)

Además:
1. `api.run()` descartaba `wrapped.data` si había error, perdiendo meta/trace/debugSnapshot
2. Backend no tenía try/catch - excepciones no devolvían meta
3. No había logs al inicio del flujo con requestId

### Solución:

**Backend (routes.ts)**:
```typescript
// Try/catch para garantizar meta en todas las respuestas
try {
  // ... flujo normal ...
} catch (err) {
  const errorMessage = err instanceof Error ? err.message : 'Error interno'
  trace.orchestratorError(errorMessage)
  const debugSnapshot = trace.getDebugSnapshot()
  logDebug(debugSnapshot)

  ok(res, {
    success: false,
    error: errorMessage,
    meta: {
      requestId: trace.requestId,
      executionTrace: trace.getSteps(),
      debugSnapshot
      // ... siempre incluye meta
    }
  })
}
```

Log al inicio:
```typescript
console.log(`[GranClaw] Starting request ${trace.requestId} for tenant ${context.tenant.id}`)
```

**Frontend (api.ts)**:
```typescript
// Preservar meta aunque haya error
run: async (...): Promise<OrchestratorPayload> => {
  const wrapped = await postRequest<OrchestratorWrappedResponse>(...)

  // Si data existe, devolverla SIEMPRE (incluso con error)
  if (wrapped.data) {
    if (wrapped.error && !wrapped.data.error) {
      wrapped.data.error = wrapped.error
    }
    if (!wrapped.success && wrapped.data.success !== false) {
      wrapped.data.success = false
    }
    return wrapped.data  // ← Meta preservado
  }

  // Solo si data es null
  return { success: false, error: wrapped.error || 'No respuesta' }
}
```

**Frontend (SecurityResultPanel.tsx)**:
```typescript
// Nuevo tipo de estado
export type ResultStatus = 'allowed' | 'blocked' | 'error' | 'unconfirmed'

// Determina colores y textos según estado
const getTexts = () => {
  switch (effectiveStatus) {
    case 'allowed':
      return { icon: '✓', title: 'PERMITIDO', ... }
    case 'blocked':
      return { icon: '✕', title: 'BLOQUEADO', ... }
    case 'error':
      return { icon: '⚠', title: 'ERROR', ... }
    case 'unconfirmed':
      return { icon: '?', title: 'SIN CONFIRMAR', ... }
  }
}
```

**Frontend (Execute.tsx)**:
```typescript
// Determinar status correcto
let resultStatus: ResultStatus
if (!allowed) {
  const hubBlocked = debugSnapshot?.hubAllowed === false || reason?.includes('Hub')
  resultStatus = hubBlocked ? 'blocked' : 'error'
} else if (!executionConfirmed) {
  resultStatus = 'unconfirmed'
} else {
  resultStatus = 'allowed'
}
```

### Resultado:
- Errores técnicos muestran "ERROR" (gris), no "BLOQUEADO"
- Hub blocked muestra "BLOQUEADO" (rojo) correctamente
- Permitido sin confirmar muestra "SIN CONFIRMAR" (naranja)
- Permitido confirmado muestra "PERMITIDO" (verde)
- Meta/debugSnapshot siempre disponible para depuración
- Logs en consola con requestId al inicio del flujo

### Archivos modificados:
- `apps/api/src/modules/orchestrator/routes.ts` (try/catch, logs)
- `apps/web/src/services/api.ts` (preservar meta en errores)
- `apps/web/src/components/control/SecurityResultPanel.tsx` (4 estados)
- `apps/web/src/components/control/index.ts` (export ResultStatus)
- `apps/web/src/pages/control/Execute.tsx` (pasar status)

---

## FEATURE 080 - Task System v1

**Fecha**: 2026-05-03

### Objetivo:
Implementar sistema de persistencia de tareas para mantener historial real de ejecuciones, eliminando mock y preparando base para futuras funcionalidades (cron, secuencias).

### Backend:

**Modelo de datos (types.ts)**:
```typescript
type TaskStatus = 'pending' | 'running' | 'success' | 'blocked' | 'error' | 'unconfirmed'

interface GranClawTask {
  id: string
  status: TaskStatus
  tenantId: string
  userId?: string
  requestId?: string
  input: string
  result?: unknown
  source?: string
  reason?: string
  error?: string
  executionTrace?: TaskExecutionTraceStep[]
  debugSnapshot?: DebugSnapshot
  executionDurationMs?: number
  createdAt: string
  updatedAt: string
}
```

**Servicio (service.ts)**:
- `listTasks(tenantId?)` - Lista tareas filtradas por tenant
- `getTask(id)` - Obtiene tarea por ID
- `createTask(input)` - Crea tarea con status "running"
- `updateTask(id, updates)` - Actualiza tarea
- `completeTask(id, status, result, ...)` - Completa tarea con resultado

**Persistencia**:
- Archivo: `data/tasks.json`
- Usa file-db existente

**Endpoints**:
- `GET /tasks` - Lista tareas del tenant autenticado
- `GET /tasks/:id` - Obtiene detalle de tarea

**Integración con orchestrator**:
```typescript
// Al inicio de ejecución
const task = createTask({
  tenantId: context.tenant.id,
  userId: context.user.id,
  requestId: trace.requestId,
  input: input.message
})

// Al finalizar
completeTask(task.id, taskStatus, result, source, trace, debugSnapshot, ...)

// En meta de respuesta
meta: { taskId: task.id, ... }
```

### Frontend:

**API (api.ts)**:
```typescript
getTasks: () => requestProtected<GranClawTask[]>('/tasks'),
getTask: (id: string) => requestProtected<GranClawTask>(`/tasks/${id}`)
```

**Historial (Historial.tsx)**:
- Consume backend `/tasks` en lugar de mock local
- Muestra lista con colores según status
- Click en tarea abre modal de detalle
- Muestra: input, resultado, trace, debugSnapshot, source, duración

**DebugPanel**:
- Añadido prop `taskId`
- Muestra Task ID si está disponible

**Execute.tsx**:
- Extrae `taskId` de meta
- Pasa `taskId` a DebugPanel

### Estados de tarea:

| Status | Color | Icono | Significado |
|--------|-------|-------|-------------|
| success | Verde | ✓ | Ejecutado y confirmado |
| blocked | Rojo | ✕ | Bloqueado por Hub |
| error | Gris | ⚠ | Error técnico |
| unconfirmed | Naranja | ? | Permitido pero no confirmado |
| running | Azul | ⟳ | En ejecución |
| pending | Gris | ○ | Pendiente |

### Archivos creados:
- `apps/api/src/modules/tasks/types.ts`
- `apps/api/src/modules/tasks/service.ts`
- `apps/api/src/modules/tasks/routes.ts`
- `apps/api/src/modules/tasks/index.ts`

### Archivos modificados:
- `apps/api/src/index.ts` (rutas tasks)
- `apps/api/src/modules/orchestrator/routes.ts` (crear/actualizar task)
- `apps/web/src/services/api.ts` (tipos y métodos task)
- `apps/web/src/pages/control/Historial.tsx` (consumir backend)
- `apps/web/src/pages/control/Execute.tsx` (extraer taskId)
- `apps/web/src/components/control/DebugPanel.tsx` (mostrar taskId)

### Verificaciones:
- ✅ Ejecutar acción → aparece en historial
- ✅ Bloqueada → aparece como blocked
- ✅ Error → aparece como error
- ✅ No confirmada → aparece como unconfirmed

---

## FEATURE 090 - Tool Proposal System v1

**Fecha**: 2026-05-03

### Descripción:
Sistema seguro de propuestas de tools para detectar y gestionar capacidades faltantes en GranClaw.

### Flujo:
1. Usuario solicita acción (ej: "abre el editor de texto")
2. GranClaw detecta que no tiene capacidad para ejecutarla
3. Crea propuesta de tool con metadatos
4. Muestra estado "CAPACIDAD NO DISPONIBLE"
5. Usuario puede aprobar/rechazar en /control/tools

### Seguridad:
- NO ejecuta tools propuestas
- Aprobar solo cambia status (no activa tool)
- OS access marcado como high risk
- No hay código ejecutable generado

### Backend:

**Modelo ToolProposal**:
```typescript
type ToolProposalStatus = 'pending' | 'approved' | 'rejected'
type RiskLevel = 'low' | 'medium' | 'high'

interface ToolProposal {
  id: string
  tenantId: string
  userId?: string
  requestedAction: string
  detectedCapability: string
  proposedToolName: string
  description: string
  riskLevel: RiskLevel
  requiresOsAccess: boolean
  requiresNetworkAccess: boolean
  suggestedImplementation?: string
  status: ToolProposalStatus
  createdAt: string
  updatedAt: string
}
```

**Persistencia**: `data/tool-proposals.json`

**Endpoints**:
| Endpoint | Método | Descripción |
|----------|--------|-------------|
| /tool-proposals | GET | Lista propuestas del tenant |
| /tool-proposals/:id | GET | Detalle de propuesta |
| /tool-proposals/:id/approve | POST | Aprobar propuesta |
| /tool-proposals/:id/reject | POST | Rechazar propuesta |

**Detector de capacidad faltante**:
Detecta patrones en mensajes:
- "abre editor", "notepad", "vscode" → open_text_editor (high risk)
- "crear archivo", "guardar archivo" → file_write (high risk)
- "leer archivo", "abrir archivo" → file_read (medium risk)
- "ejecutar comando", "terminal" → execute_command (high risk)
- "abrir aplicacion", "lanzar aplicacion" → launch_application (high risk)

### Frontend:

**API (api.ts)**:
```typescript
getToolProposals: () => requestProtected<ToolProposal[]>('/tool-proposals'),
getToolProposal: (id: string) => requestProtected<ToolProposal>(`/tool-proposals/${id}`),
approveToolProposal: (id: string) => postRequestProtected<ToolProposal>(`/tool-proposals/${id}/approve`, {}),
rejectToolProposal: (id: string) => postRequestProtected<ToolProposal>(`/tool-proposals/${id}/reject`, {})
```

**SecurityResultPanel**:
- Nuevo estado `missing_capability`
- Color púrpura (#7c3aed)
- Muestra info de tool propuesta
- Enlace a /control/tools

**Tools.tsx** (/control/tools):
- Lista propuestas con filtro por status
- Modal de detalle con todos los campos
- Botones aprobar/rechazar para pending
- Mensaje al aprobar: "La implementación real se hará en una fase posterior"

### Estados en UI:

| Estado | Icono | Color | Significado |
|--------|-------|-------|-------------|
| missing_capability | 🧩 | Púrpura | Capacidad no disponible, propuesta creada |

### Archivos creados:
- `apps/api/src/modules/tool-proposals/types.ts`
- `apps/api/src/modules/tool-proposals/service.ts`
- `apps/api/src/modules/tool-proposals/routes.ts`
- `apps/api/src/modules/tool-proposals/index.ts`
- `apps/web/src/pages/control/Tools.tsx`

### Archivos modificados:
- `apps/api/src/index.ts` (rutas tool-proposals)
- `apps/api/src/modules/orchestrator/routes.ts` (detectar capacidad faltante)
- `apps/api/src/modules/orchestrator/trace.ts` (source 'granclaw')
- `apps/web/src/services/api.ts` (tipos y métodos)
- `apps/web/src/pages/control/Execute.tsx` (toolProposalInfo)
- `apps/web/src/components/control/SecurityResultPanel.tsx` (missing_capability)
- `apps/web/src/pages/control/index.ts` (export Tools)
- `apps/web/src/App.tsx` (ruta /control/tools + tab)

### Verificaciones:
- ✅ "abre el editor de texto" → crea propuesta, no ejecuta
- ✅ "crear archivo en escritorio" → propuesta high risk
- ✅ acción normal soportada → no crea propuesta
- ✅ approve/reject → cambia status, no activa tool real

---

## FEATURE 100 - Real Capabilities v1 (Sandbox)

**Fecha**: 2026-05-04
**Estado**: Completado

### Objetivo

Implementar capacidades REALES (no mock) pero SEGURAS usando un sandbox filesystem:
- Operaciones de archivos reales dentro de directorio sandbox
- Validaciones de seguridad (path traversal, tamaño, extensiones)
- Mostrar ruta de archivo en frontend

### Sandbox Filesystem

**Ubicación**: `apps/api/data/sandbox/`

**Módulo**: `apps/api/src/storage/sandbox.ts`

**Funciones exportadas**:
- `readFile(path)` - Lee archivo del sandbox
- `writeFile(path, content, overwrite?)` - Escribe archivo al sandbox
- `listFiles(subPath?)` - Lista archivos del sandbox
- `deleteFile(path)` - Elimina archivo del sandbox
- `getFileInfo(path)` - Obtiene info del archivo
- `getSandboxPath()` - Devuelve ruta del sandbox

### Seguridad Implementada

| Validación | Implementación |
|------------|----------------|
| Path traversal | Bloquea `..` y `~` |
| Rutas absolutas | Rechaza paths absolutos |
| Extensiones | Solo `.txt`, `.md`, `.json`, `.csv`, `.log`, `.xml`, `.html`, `.css` |
| Tamaño máximo | 1MB (1024 * 1024 bytes) |
| Nombres únicos | Auto-genera sufijo `_1`, `_2`, etc. si existe |

### Capabilities Reales

| Capability | Comportamiento REAL |
|------------|---------------------|
| `open_text_editor` | Crea archivo .txt/.md en sandbox |
| `write_local_file` | Escribe archivo en sandbox |
| `read_local_file` | Lee archivo del sandbox |

### Cambios en executeCapabilitySafeV1

La función ahora:
1. Genera nombre de archivo desde la acción solicitada
2. Ejecuta operación REAL usando `sandbox.*`
3. Devuelve `filePath` y `sandboxPath` en el resultado
4. Logs de auditoría con `[GranClaw Capability]`

### Frontend - OutputViewer

Tipos actualizados con:
- `filePath?: string` - Ruta relativa en sandbox
- `sandboxPath?: string` - Ruta absoluta del sandbox

UI muestra:
- Badge azul con 📄 y ruta del archivo
- Footer con 📁 y ruta del sandbox

### Archivos Creados

- `apps/api/src/storage/sandbox.ts` - Módulo sandbox
- `apps/api/data/sandbox/` - Directorio de archivos

### Archivos Modificados

- `apps/api/src/storage/index.ts` - Export sandbox
- `apps/api/src/modules/orchestrator/routes.ts` - Import sandbox, actualizar executeCapabilitySafeV1
- `apps/web/src/components/control/OutputViewer.tsx` - Mostrar filePath y sandboxPath

### Verificaciones

- ✅ Build exitoso
- ✅ `open_text_editor` crea archivo real en sandbox
- ✅ `write_local_file` escribe archivo real
- ✅ `read_local_file` lee archivo existente
- ✅ Path traversal bloqueado
- ✅ Extensiones no permitidas rechazadas
- ✅ Archivos >1MB rechazados
- ✅ Frontend muestra rutas de archivos

---

## FIX 101 - Capabilities UX Polish

**Fecha**: 2026-05-04
**Estado**: Completado

### Objetivo

Pulir la UX de capabilities reales para que se sientan como funcionalidad de producto, no como output técnico.

### Cambios en OutputViewer

**Ocultar información técnica**:
- No mostrar `sandboxPath`
- No mostrar rutas absolutas
- Solo mostrar nombre de archivo (ej: `documento_2026-05-04.txt`)

**Nueva cabecera**:
- Banner verde: "✓ Documento creado correctamente"
- Título: "📄 Documento generado"
- Nombre de archivo visible

**Acciones añadidas**:
- 📋 Copiar (copia contenido al clipboard)
- ⬇ Descargar (descarga archivo .txt)
- ✏️ Editar (si editable)

**Editor mejorado**:
- textarea más grande (300px min)
- padding amplio (20px)
- bordes redondeados (12px)
- focus con sombra azul

**Detalles técnicos**:
- Ocultos por defecto
- Toggle "Ver detalles técnicos"
- Muestra formato, capabilityId, filePath

**UX visual**:
- Cards con sombras suaves
- Bordes redondeados (16px)
- Spacing amplio
- Transiciones suaves

### Archivo Modificado

- `apps/web/src/components/control/OutputViewer.tsx`

### Verificaciones

- ✅ Build exitoso
- ✅ Rutas internas ocultas
- ✅ Copiar funciona
- ✅ Descargar funciona
- ✅ Editor usable
- ✅ Detalles técnicos ocultos por defecto

---

## FIX 102 - Missing Capability Detector Before OpenClaw

**Fecha**: 2026-05-04
**Estado**: Completado

### Problema

Al pedir "abre el navegador", "abre la calculadora", etc., OpenClaw respondía "No puedo abrir..." en lugar de que GranClaw interceptara con "CAPACIDAD NO DISPONIBLE" + crear ToolProposal.

### Causa raíz

El detector `detectMissingCapability` no cubría patrones como "navegador", "calculadora", "chrome", "safari", etc.

### Solución

1. **Ampliar patrones del detector**:
   - Editor: bloc de notas, editor de notas, notas
   - Navegador: chrome, safari, firefox, edge, google, web, internet
   - Calculadora: calc, calculadora del sistema
   - Aplicaciones: word, excel, photoshop, finder, explorador, spotify, slack, discord, zoom, teams
   - Terminal: cmd, powershell, script

2. **Evitar duplicados**:
   - Nueva función `findExistingProposal(tenantId, proposedToolName, status)`
   - Si existe proposal pending para el mismo tool, reutilizarla

### Orden del flujo

```
1. Crear requestId / trace / debugSnapshot
2. Evaluar Hub
3. Si Hub bloquea → devolver blocked
4. detectMissingCapability(message)
5. Si capacidad faltante:
   5.1 Buscar ApprovedCapability enabled
   5.2 Si existe → ejecutar capability segura
   5.3 Si NO existe → buscar/crear ToolProposal, devolver Missing capability
6. Solo si no hay falta → llamar OpenClaw
```

### Archivos modificados

- `apps/api/src/modules/tool-proposals/service.ts` - Detector ampliado + findExistingProposal
- `apps/api/src/modules/orchestrator/routes.ts` - Import findExistingProposal, prevenir duplicados

### Patrones añadidos

| Categoría | Patrones | Tool |
|-----------|----------|------|
| Navegador | navegador, chrome, safari, firefox, edge, google, web, internet | open_web_browser |
| Calculadora | calculadora, calc | open_calculator |
| Aplicaciones | word, excel, photoshop, finder, explorador, spotify, slack, discord, zoom, teams | open_local_application |
| Terminal | terminal, cmd, powershell, script | run_system_command |
| Editor | bloc de notas, editor de notas, notas | open_text_editor |

### Verificaciones

- ✅ "abre el navegador" → Missing capability + proposal open_web_browser
- ✅ "abre la calculadora" → Missing capability + proposal open_calculator
- ✅ "abre el editor" (si aprobado) → ejecuta capability segura
- ✅ "dame la hora de Australia" → llama OpenClaw normal
- ✅ Dos veces "abre navegador" → no duplica proposals
- ✅ Build exitoso

---

## FIX 103 - Tool Approval Flow & Return Context

**Fecha**: 2026-05-04
**Estado**: Completado

### Problema

1. Error al aprobar ToolProposal desde /control/tools - el frontend no reconocía la respuesta
2. Después de aprobar, el usuario debía navegar manualmente y repetir el mensaje
3. No había forma de aprobar inline desde la pantalla de Control

### Causa raíz

El backend envuelve respuestas con `ok(res, data)` → `{ success, data, error }` pero:
- `api.approveToolProposal` devolvía el objeto envuelto directamente
- `Tools.tsx` verificaba `'proposal' in response` en lugar de `response.success && response.data?.proposal`

### Solución

1. **Backend idempotente** (`routes.ts`):
   - Si propuesta ya aprobada → devolver éxito con datos existentes
   - Si propuesta rechazada → no permitir aprobar
   - Si no hay capability → crearla

2. **API wrapper corregido** (`api.ts`):
   - `approveToolProposal`, `rejectToolProposal`, `enableCapability`, `disableCapability` devuelven `ApiResponse<T>`
   - Tipado correcto para el wrapper `{ success, data, error }`

3. **Tools.tsx corregido**:
   - Verificar `response.success && response.data?.proposal`
   - Mostrar error legible si falla

4. **Aprobar inline desde Control** (`SecurityResultPanel.tsx`):
   - Botón "✓ Aprobar ahora" cuando missing_capability
   - Estados: aprobando, aprobada, error
   - Tras aprobar muestra botón "🔄 Reintentar acción"

5. **Reintentar sin perder contexto** (`Execute.tsx`):
   - Guardar `lastMessage` al ejecutar
   - Pasar `onRetry` a SecurityResultPanel
   - Al hacer clic en reintentar, ejecutar `lastMessage` de nuevo

### Archivos modificados

| Archivo | Cambios |
|---------|---------|
| apps/api/src/modules/tool-proposals/routes.ts | Idempotente: ya aprobada → éxito, rechazada → error |
| apps/web/src/services/api.ts | approveToolProposal/rejectToolProposal devuelven ApiResponse |
| apps/web/src/pages/control/Tools.tsx | Verificar response.success && response.data |
| apps/web/src/components/control/SecurityResultPanel.tsx | Aprobar inline + callback onRetry |
| apps/web/src/pages/control/Execute.tsx | Guardar lastMessage, pasar onRetry |

### Flujo UX mejorado

```
Usuario: "abre el navegador"
    ↓
GranClaw: "CAPACIDAD NO DISPONIBLE"
    ↓ [Botón: Aprobar ahora]
Usuario: Click "Aprobar ahora"
    ↓
GranClaw: "✓ Aprobada" [Botón: Reintentar acción]
    ↓
Usuario: Click "Reintentar acción"
    ↓
GranClaw: Ejecuta "abre el navegador" con capability habilitada
```

### Verificaciones

- ✅ Aprobar desde Tools.tsx funciona
- ✅ Aprobar inline desde Control funciona
- ✅ Reintentar después de aprobar funciona
- ✅ Backend idempotente (aprobar dos veces no falla)
- ✅ Mostrar error legible si falla aprobación
- ✅ Build exitoso

---

## FIX 104 - Capability Key Normalization & Deduplication

**Fecha**: 2026-05-04
**Estado**: Completado

### Problema

1. Usuario aprueba capacidad (ej: "abre la calculadora")
2. Al reintentar, GranClaw dice "CAPACIDAD NO DISPONIBLE" de nuevo
3. Múltiples duplicados aparecen en /control/tools
4. Cada retry crea nueva propuesta aunque ya existe capacidad

### Causa raíz

Inconsistencia entre campos usados para lookup:
- `detectedCapability` = "system:open_calculator"
- `proposedToolName` = "open_calculator"
- `requestedAction` = "abre la calculadora"
- `toolName` (en capability) = "open_calculator"

El lookup usaba `requestedAction` literal o `proposedToolName` sin normalizar, por lo que:
- "abrir calculadora" ≠ "Abre la Calculadora" → nueva propuesta
- "open_calculator" vs "OPEN_CALCULATOR" → no encontrado

### Solución

Crear `capabilityKey` como clave canónica normalizada para TODOS los lookups.

1. **capability-normalizer.ts** (nuevo):
   - `normalizeCapabilityKey(input)` → lowercase, trim, remove accents
   - Mapa de sinónimos: "calculadora" → "open_calculator", "navegador" → "open_browser"
   - Match parcial para variantes

2. **ToolProposal types**:
   - Añadir `capabilityKey: string` a ToolProposal
   - Añadir `capabilityKey` a CreateToolProposalInput
   - Añadir status `'archived'` para cleanup

3. **ApprovedCapability types**:
   - Añadir `capabilityKey: string`
   - Añadir `deleted?: boolean` para soft delete

4. **tool-proposals/service.ts**:
   - `migrateProposals()` añade capabilityKey a datos existentes
   - `findExistingProposal` usa capabilityKey normalizada
   - `archiveToolProposal` para limpiar duplicados

5. **capabilities/service.ts**:
   - `migrateCapabilities()` añade capabilityKey a datos existentes
   - `getCapabilityByKey(tenantId, capabilityKey)` como lookup principal
   - `getEnabledCapabilityByKey` para verificar si habilitada
   - `deleteCapability` para soft delete y permitir re-proponer
   - `createCapabilityFromProposal` idempotente por capabilityKey

6. **orchestrator/routes.ts**:
   - Usa `getEnabledCapabilityByKey` en lugar de `getCapabilityByToolName`
   - Normaliza capabilityKey antes de cada lookup
   - Incluye capabilityKey en respuesta meta

7. **UI (Tools.tsx + api.ts)**:
   - Botón "Archivar" para propuestas rechazadas
   - Botón "Eliminar" para capabilities (permite re-proponer)
   - Status "ARCHIVADA" en lista

### Archivos modificados

| Archivo | Cambios |
|---------|---------|
| apps/api/src/modules/capabilities/capability-normalizer.ts | NUEVO - normalizeCapabilityKey |
| apps/api/src/modules/tool-proposals/types.ts | capabilityKey, 'archived' status |
| apps/api/src/modules/capabilities/types.ts | capabilityKey, deleted |
| apps/api/src/modules/tool-proposals/service.ts | migrateProposals, lookup by key, archive |
| apps/api/src/modules/capabilities/service.ts | migrateCapabilities, lookup by key, delete |
| apps/api/src/modules/orchestrator/routes.ts | Usa getEnabledCapabilityByKey |
| apps/api/src/modules/tool-proposals/routes.ts | handleArchiveToolProposal |
| apps/api/src/modules/capabilities/routes.ts | handleDeleteCapability |
| apps/api/src/index.ts | Rutas POST /archive y DELETE /capabilities/:id |
| apps/web/src/services/api.ts | archiveToolProposal, deleteCapability |
| apps/web/src/pages/control/Tools.tsx | handleArchive, handleDeleteCapability, UI buttons |

### Flujo corregido

```
Usuario: "abre la calculadora"
    ↓
orchestrator: detectMissingCapability → capabilityKey = "open_calculator"
    ↓
getEnabledCapabilityByKey("tenant_1", "open_calculator") → null
    ↓
findExistingProposal("tenant_1", "open_calculator") → null (primera vez)
    ↓
createToolProposal con capabilityKey = "open_calculator"
    ↓
Usuario aprueba
    ↓
createCapabilityFromProposal con capabilityKey = "open_calculator"

--- Retry ---

Usuario: "Abre la Calculadora" (diferente capitalización)
    ↓
normalizeCapabilityKey("Abre la Calculadora") → "open_calculator" (match sinónimo)
    ↓
getEnabledCapabilityByKey("tenant_1", "open_calculator") → capability encontrada!
    ↓
Ejecuta herramienta sin crear duplicado
```

### Verificaciones

- ✅ Aprobar capability y reintentar encuentra la capacidad
- ✅ Diferentes variantes normalizan a misma key
- ✅ No se crean duplicados
- ✅ Archive oculta propuestas de la lista
- ✅ Delete capability permite re-proponer
- ✅ Migración automática de datos existentes
- ✅ Build exitoso

---

## FIX 105 - Canonical Capability Groups & Cleanup

**Fecha**: 2026-05-04
**Estado**: Completado

### Problema

1. Tras aprobar capability, al reintentar GranClaw no la encontraba
2. /control/tools mostraba duplicados por cada solicitud
3. Acciones solo visibles dentro del modal, no en la tarjeta
4. UI usaba proposalId para relacionar capability, fallaba cuando capability existía por otra proposal
5. Errores 401 no se manejaban limpiamente

### Causa raíz

- El lookup visual y parte del flujo seguía usando proposalId en vez de capabilityKey
- listToolProposals devolvía todos los registros sin agrupar
- Al reintentar, faltaba diagnóstico de tenantId + capabilityKey + capabilityFound
- No había limpieza de duplicados existentes

### Principio implementado

La clave única funcional es: **tenantId + capabilityKey**

proposalId solo sirve para historial/trazabilidad.

### Solución

1. **Backend - capability lookup robusto** (orchestrator/routes.ts):
   - Distingue: enabled, disabled, deleted, inexistente
   - Logs diagnósticos: capabilityKey, capabilityFound, enabled, proposalCount
   - Si disabled: devuelve error "Capability disabled" con info

2. **Backend - approve usa capabilityKey** (tool-proposals/routes.ts):
   - Busca capability por capabilityKey, no proposalId
   - Si existe: reutiliza, no crea duplicado

3. **Backend - deduplicación** (capabilities/service.ts, tool-proposals/service.ts):
   - `deduplicateCapabilities(tenantId)`: marca duplicadas como deleted
   - `deduplicateProposals(tenantId, hasCapabilityForKey)`: archiva duplicadas

4. **Backend - endpoint cleanup** (POST /tool-proposals/cleanup):
   - Ejecuta deduplicación y devuelve resumen

5. **Frontend - Tools.tsx agrupado** por capabilityKey:
   - Una tarjeta por capabilityKey, no por proposal
   - Estado: pending | active | inactive | rejected
   - Muestra count de solicitudes relacionadas

6. **Frontend - acciones visibles** en tarjeta:
   - Aprobar/Rechazar para pending
   - Activar/Desactivar/Eliminar para active/inactive
   - Archivar para rejected

7. **Frontend - botón Limpiar duplicados**:
   - Ejecuta cleanup y refresca

8. **Frontend - sesión expirada**:
   - api.ts detecta 401, limpia token, dispara evento
   - Componentes muestran aviso

### Archivos modificados

| Archivo | Cambios |
|---------|---------|
| apps/api/src/modules/orchestrator/routes.ts | Lookup robusto, logs diagnóstico, caso disabled |
| apps/api/src/modules/tool-proposals/routes.ts | Approve por capabilityKey, handleCleanupToolProposals |
| apps/api/src/modules/capabilities/service.ts | deduplicateCapabilities |
| apps/api/src/modules/tool-proposals/service.ts | deduplicateProposals |
| apps/api/src/index.ts | POST /tool-proposals/cleanup |
| apps/web/src/services/api.ts | 401 handling, cleanupToolProposals |
| apps/web/src/pages/control/Tools.tsx | Agrupado por capabilityKey, acciones visibles |

### Verificaciones

- ✅ Aprobar y reintentar encuentra la capacidad
- ✅ Tools muestra una tarjeta por capabilityKey
- ✅ Acciones visibles en tarjeta sin abrir modal
- ✅ Limpiar duplicados funciona
- ✅ Sesión expirada muestra aviso
- ✅ Build exitoso

---

## FEATURE 110 - Controlled OS Tools v1 + Human Output Mode

**Fecha**: 2026-05-05
**Estado**: Completado

### Objetivo

1. Ejecutar aplicaciones del SO de forma controlada mediante whitelist
2. Diferenciar modo strict (requiere confirmación) vs passthrough (ejecución directa)
3. Integrar con sistema de capabilities existente
4. Crear normalizer para respuestas human-readable

### Implementación

1. **Módulo os-tools** (apps/api/src/modules/os-tools/):
   - types.ts: OSCapabilityKey, Platform, OSToolConfig, OSExecutionResult
   - os-whitelist.ts: Whitelist de apps permitidas por plataforma
   - os-executor.ts: Ejecución via child_process.spawn (no exec)
   - routes.ts: GET /os-tools, POST /os-tools/confirm, POST /os-tools/cleanup
   - index.ts: Exports

2. **Whitelist definida**:
   - open_calculator: calc.exe (Windows), Calculator (macOS), gnome-calculator (Linux)
   - open_web_browser: msedge (Windows), Safari (macOS), xdg-open (Linux)
   - open_text_editor_os: notepad.exe (Windows), TextEdit (macOS), gedit (Linux)
   - open_file_explorer: explorer.exe (Windows), open . (macOS), xdg-open (Linux)
   - open_terminal: cmd (Windows), Terminal (macOS), gnome-terminal (Linux)

3. **OS Executor**:
   - Usa child_process.spawn (más seguro que exec)
   - Procesos GUI se lanzan detached
   - Sistema de confirmaciones pendientes con timeout (5 min)
   - Cleanup de confirmaciones expiradas

4. **Integración con orchestrator** (orchestrator/routes.ts):
   - Nuevo switch case para OS tools en executeCapabilitySafeV1
   - Import de isOSToolCapability, executeOSTool, getOSToolConfig
   - Ejecución fire-and-forget para apps GUI

5. **Output Normalizer** (orchestrator/output-normalizer.ts):
   - normalizeOutput(): Convierte respuestas a formato human-readable
   - Tipos: text, action, document, info, error, approval_needed
   - extractPlainText(): Extrae texto plano de respuesta normalizada
   - needsApproval(): Detecta si requiere acción del usuario

### Endpoints nuevos

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | /os-tools | Lista herramientas OS disponibles |
| POST | /os-tools/confirm | Confirma/rechaza ejecución pendiente |
| POST | /os-tools/cleanup | Limpia confirmaciones expiradas |

### Archivos creados

| Archivo | Propósito |
|---------|-----------|
| apps/api/src/modules/os-tools/types.ts | Tipos OS tools |
| apps/api/src/modules/os-tools/os-whitelist.ts | Whitelist por plataforma |
| apps/api/src/modules/os-tools/os-executor.ts | Executor con spawn |
| apps/api/src/modules/os-tools/routes.ts | Handlers HTTP |
| apps/api/src/modules/os-tools/index.ts | Exports |
| apps/api/src/modules/orchestrator/output-normalizer.ts | Normalizer respuestas |

### Archivos modificados

| Archivo | Cambios |
|---------|---------|
| apps/api/src/index.ts | Rutas OS tools |
| apps/api/src/modules/orchestrator/routes.ts | Casos OS tools en executeCapabilitySafeV1 |
| apps/api/src/modules/orchestrator/index.ts | Export output-normalizer |

### Verificaciones

- ✅ Whitelist definida para Windows/macOS/Linux
- ✅ OS executor usa spawn (no exec)
- ✅ Rutas registradas en index.ts
- ✅ Integración con orchestrator
- ✅ Output normalizer creado
- ✅ Build exitoso

---

## FIX 111 - Complete OS Tools UI Confirmation & Human Output

**Fecha**: 2026-05-05
**Estado**: Completado

### Objetivo

Completar la integración de OS Tools con confirmación en UI y output humano limpio:
1. OutputViewer muestra respuestas humanas, JSON solo en modo avanzado
2. Confirmación OS integrada en UI
3. /os-tools/confirm conectado al flujo real
4. OS tools se ejecutan solo con capability aprobada + whitelist + confirmación
5. Orchestrator delega en capability dispatcher (elimina switch grande)
6. Se mantiene debug/trace

### Implementación

1. **Frontend Output Normalizer** (apps/web/src/lib/output-normalizer.ts):
   - Tipos: text, document, action, confirmation_required, json, empty, unknown
   - normalizeOutput(): Convierte cualquier respuesta a formato humano
   - needsOSConfirmation(): Detecta confirmación pendiente
   - extractOSConfirmation(): Extrae info de confirmación
   - Oculta JSON por defecto, muestra en modo avanzado

2. **OutputViewer actualizado** (apps/web/src/components/control/OutputViewer.tsx):
   - Soporta todos los tipos de output normalizado
   - TextOutput: Card verde con respuesta limpia
   - ActionOutput: Card azul con acción ejecutada
   - ConfirmationOutput: Card amarilla con botones confirmar/cancelar
   - DocumentOutputView: Editor con copiar/descargar
   - JsonOutput: Mensaje técnico con botón "Ver datos avanzados"
   - AdvancedToggle: Muestra raw JSON colapsado

3. **SecurityResultPanel actualizado**:
   - Nuevo estado: confirmation_required
   - Colores amber para confirmación pendiente
   - Sección OS confirmation con botones
   - Integración con OutputViewer para rawResult
   - Callbacks onConfirmOsAction/onCancelOsAction

4. **Execute.tsx actualizado**:
   - Estado pendingOsConfirmation
   - handleConfirmOsAction(): Llama api.confirmOsTool
   - handleCancelOsAction(): Cancela y muestra mensaje
   - Detecta needsOSConfirmation en respuestas
   - Pasa osConfirmationInfo al SecurityResultPanel

5. **API frontend actualizado** (apps/web/src/services/api.ts):
   - confirmOsTool(payload): POST /os-tools/confirm
   - getPendingOsConfirmations(sessionId): GET /os-tools/pending
   - getOsTools(): GET /os-tools
   - Tipos: OSToolConfirmPayload, OSToolConfirmResult, OSToolPendingConfirmation, OSToolInfo

6. **Capability Dispatcher** (apps/api/src/modules/capabilities/capability-dispatcher.ts):
   - dispatchCapabilityExecution(): Decide ejecución
   - Sandbox tools: Ejecución directa en sandbox
   - OS tools: Requiere confirmación según modo/riesgo
   - isValidBrowserUrl(): Valida URLs (bloquea javascript:, data:, file:)
   - extractUrlFromAction(): Extrae URL del mensaje
   - Retorna DispatchResult con meta completa

7. **Orchestrator actualizado** (apps/api/src/modules/orchestrator/routes.ts):
   - Elimina executeCapabilitySafeV1 (switch grande)
   - Usa dispatchCapabilityExecution del dispatcher
   - Maneja confirmationRequired en respuesta
   - Meta incluye pendingConfirmation, confirmationId, source

### Flujo de confirmación

1. Usuario pide "abre calculadora"
2. Orchestrator detecta capability open_calculator
3. Dispatcher verifica si es OS tool
4. Si modo strict o riesgo medio/alto → crea confirmación pendiente
5. Respuesta incluye type: confirmation_required
6. UI muestra card amarilla con botones
7. Usuario confirma → api.confirmOsTool → executor.confirmOSToolExecution
8. Respuesta actualizada con type: action
9. UI muestra card azul "Calculadora abierta"

### Archivos creados

| Archivo | Propósito |
|---------|-----------|
| apps/web/src/lib/output-normalizer.ts | Normalizer frontend |
| apps/api/src/modules/capabilities/capability-dispatcher.ts | Dispatcher centralizado |

### Archivos modificados

| Archivo | Cambios |
|---------|---------|
| apps/web/src/components/control/OutputViewer.tsx | Componentes por tipo, callbacks |
| apps/web/src/components/control/SecurityResultPanel.tsx | Estado confirmation_required, OS section |
| apps/web/src/pages/control/Execute.tsx | Handlers confirmar/cancelar |
| apps/web/src/services/api.ts | confirmOsTool, tipos OS |
| apps/api/src/modules/capabilities/index.ts | Export dispatcher |
| apps/api/src/modules/orchestrator/routes.ts | Usa dispatcher |

### Verificaciones

- ✅ Frontend normalizer creado
- ✅ OutputViewer muestra output humano
- ✅ SecurityResultPanel soporta confirmation_required
- ✅ Execute.tsx maneja confirmación OS
- ✅ api.ts tiene confirmOsTool
- ✅ Capability dispatcher creado
- ✅ Orchestrator usa dispatcher
- ✅ URL validation para navegador
- ✅ Debug/trace preservado

---

## FEATURE 120 - Hybrid Execution Policy v1

**Fecha**: 2026-05-05
**Estado**: Completado

### Objetivo

Crear sistema de políticas de ejecución híbrida que:
1. Decide cuándo ejecutar localmente vs delegar a OpenClaw
2. Evita consumo innecesario de tokens IA para acciones aprendidas/determinísticas
3. Permite fallback local cuando OpenClaw falla
4. Prepara base para futuras tareas complejas

**Principio clave**: GranClaw no sustituye a OpenClaw. GranClaw = seguridad + cache + router. OpenClaw = motor agente.

### Implementación

1. **Módulo execution-policy** (apps/api/src/modules/execution-policy/):
   - types.ts: ExecutionProvider, ExecutionRoute, ExecutionPolicyConfig, ExecutionRouteDecision
   - service.ts: CRUD para políticas por tenant (file-db)
   - execution-router.ts: Lógica de decisión decideExecutionRoute()
   - routes.ts: GET/POST /execution-policy
   - index.ts: Exports

2. **Tipos definidos**:
   - ExecutionProvider: 'auto' | 'openclaw' | 'local'
   - ExecutionRoute: 'local' | 'openclaw' | 'proposal'
   - ExecutionPolicyConfig: provider, preferOpenClawForNewActions, allowLocalFallback, avoidAiForLearnedActions, requireConfirmationForOsToolsInStrict, requireConfirmationForHighRiskInFree

3. **Execution Router** (execution-router.ts):
   - decideExecutionRoute(): Decisión principal
   - containsAiRequiredKeywords(): Detecta "analiza", "investiga", "decide", etc.
   - isDeterministicCapability(): open_calculator, open_web_browser, etc.
   - requestsOpenClaw(): Detecta "usando openclaw", "con ia", etc.
   - createExecutionPlanPreview(): Preparación para tareas multi-step (futuro)

4. **Lógica de decisión**:
   - Si usuario pide explícitamente OpenClaw → openclaw
   - Si proveedor = 'local' → local
   - Si proveedor = 'openclaw' → openclaw
   - Si modo auto:
     - Si capability determinística + avoidAiForLearnedActions → local
     - Si mensaje tiene keywords IA → openclaw
     - Si preferOpenClawForNewActions + no tiene capability → openclaw
     - Default → local (ahorro de tokens)

5. **Integración orchestrator** (apps/api/src/modules/orchestrator/routes.ts):
   - Import de getExecutionPolicy, decideExecutionRoute
   - Decisión después de lookup de capability
   - Log: `[Execution Router] provider=X reason="Y"`
   - Detalle en respuesta incluye proveedor usado

6. **UI Settings** (apps/web/src/pages/control/Settings.tsx):
   - Selector de proveedor (auto/openclaw/local)
   - Checkboxes para opciones avanzadas
   - Sección seguridad (confirmaciones)
   - Explicación de política híbrida
   - Persistencia via api.setExecutionPolicy

7. **API Frontend** (apps/web/src/services/api.ts):
   - ExecutionPolicyConfig, ExecutionProvider types
   - api.getExecutionPolicy(): GET /execution-policy
   - api.setExecutionPolicy(): POST /execution-policy

### Endpoints nuevos

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | /execution-policy | Obtiene política del tenant actual |
| POST | /execution-policy | Guarda política del tenant |

### Archivos creados

| Archivo | Propósito |
|---------|-----------|
| apps/api/src/modules/execution-policy/types.ts | Tipos y constantes |
| apps/api/src/modules/execution-policy/service.ts | CRUD file-db |
| apps/api/src/modules/execution-policy/execution-router.ts | Lógica decisión |
| apps/api/src/modules/execution-policy/routes.ts | Handlers HTTP |
| apps/api/src/modules/execution-policy/index.ts | Exports |
| apps/web/src/pages/control/Settings.tsx | UI configuración |

### Archivos modificados

| Archivo | Cambios |
|---------|---------|
| apps/api/src/index.ts | Rutas execution-policy |
| apps/api/src/modules/orchestrator/routes.ts | Integración router |
| apps/web/src/services/api.ts | Métodos execution-policy |
| apps/web/src/pages/control/index.ts | Export Settings |
| apps/web/src/App.tsx | Ruta /control/settings, nav item |

### Casos de uso

| Input | Provider | Capability | Resultado |
|-------|----------|------------|-----------|
| "abre la calculadora" | auto | open_calculator | local (determinístico) |
| "analiza este código" | auto | - | openclaw (keyword IA) |
| "abre la calc con IA" | auto | open_calculator | openclaw (usuario pidió) |
| "busca X" | local | - | local (política forzada) |
| "abre chrome" | openclaw | open_web_browser | openclaw (política forzada) |

### Verificaciones

- ✅ Módulo execution-policy creado
- ✅ Execution router con lógica completa
- ✅ Rutas registradas en index.ts
- ✅ Integración en orchestrator
- ✅ UI Settings creada
- ✅ API frontend completa
- ✅ Ruta /control/settings registrada
- ✅ npm run check sin errores
- ✅ npm run build exitoso

---

## FIX 121 - Authoritative Hybrid Router & Intent Classification

**Fecha**: 2026-05-05
**Estado**: Completado

### Problema

- El execution-router existía pero era decorativo
- El detector de missing capabilities dominaba el flujo prematuramente
- Frases como "descarga X e instala" se clasificaban mal como editor/nota
- Acciones complejas no se delegaban correctamente a OpenClaw

### Solución

1. **Intent Classifier** (apps/api/src/modules/execution-policy/intent-classifier.ts):
   - Se ejecuta PRIMERO, antes de capability detection
   - Clasifica intención: install_download_action, complex_agent_task, analysis_task, deterministic_action, etc.
   - Previene falsos positivos de editor cuando hay señales de install/download
   - Funciones: classifyIntent(), shouldBlockLocalProposal(), requiresOpenClaw()

2. **Execution Router Autoritativo** (execution-router.ts):
   - Recibe intent classification como input
   - Decisión jerárquica con prioridades claras
   - Install/download/complex → siempre OpenClaw (nunca editor)
   - Deterministic + avoidAi → siempre local (ahorro tokens)
   - La decisión del router es FINAL

3. **Detector como señal** (tool-proposals/service.ts):
   - detectMissingCapability() ahora verifica install/download patterns
   - Si hay señales de install/download, retorna null para evitar falsos positivos
   - Solo proporciona información, no decide

4. **Orchestrator reordenado** (orchestrator/routes.ts):
   - Orden nuevo: Hub → classifyIntent → detectMissingCapability → decideExecutionRoute → Ejecutar
   - El router decide provider: 'openclaw' | 'local' | 'proposal'
   - Se ejecuta exactamente la ruta elegida por el router
   - routerDecision incluido en meta de respuestas

### Intent Types

| IntentKind | needsAi | needsAgent | isMultiStep | Provider |
|------------|---------|------------|-------------|----------|
| install_download_action | true | true | true | openclaw |
| complex_agent_task | true | true | true | openclaw |
| analysis_task | true | true/false | false | openclaw |
| deterministic_action | false | false | false | local |
| os_action | false | false | false | local/proposal |
| simple_question | true | false | false | openclaw |

### Archivos creados

| Archivo | Propósito |
|---------|-----------|
| apps/api/src/modules/execution-policy/intent-classifier.ts | Clasificador de intención |

### Archivos modificados

| Archivo | Cambios |
|---------|---------|
| apps/api/src/modules/execution-policy/types.ts | IntentClassification en types |
| apps/api/src/modules/execution-policy/execution-router.ts | Router autoritativo con intent |
| apps/api/src/modules/execution-policy/index.ts | Exports intent-classifier |
| apps/api/src/modules/tool-proposals/service.ts | Guard install/download en detector |
| apps/api/src/modules/orchestrator/routes.ts | Flujo reordenado FIX 121 |

### Casos de prueba

| Input | Intent | Provider | Resultado |
|-------|--------|----------|-----------|
| "abre la calculadora" | deterministic_action | local | Ejecuta localmente, ahorra tokens |
| "descarga Chrome e instala" | install_download_action | openclaw | NO es editor, va a OpenClaw |
| "descarga X e instala" | install_download_action | openclaw | Agent multistep |
| "crea una nota con hola" | file_action | local/proposal | Editor solo si no hay install |
| "analiza qué necesito instalar" | analysis_task | openclaw | IA necesaria |
| "abre photoshop" | os_action | proposal | Capability no aprobada |

### Verificaciones

- ✅ Intent classifier creado
- ✅ Execution router autoritativo
- ✅ Guard install/download en detector
- ✅ Orchestrator reordenado
- ✅ routerDecision en meta
- ✅ npm run check sin errores
- ✅ npm run build exitoso

---

## FIX 122 - OpenClaw Reauthorization Handling

**Fecha**: 2026-05-05
**Estado**: Completado

### Problema

- OpenClaw devuelve errores de permisos como éxito falso
- Mensajes como "pairing required" o "authorization required" no se detectaban
- El frontend mostraba "PERMITIDO" cuando realmente se requería reautorización
- No había estado visual específico para indicar problemas de permisos

### Solución

1. **Reauth Detector** (apps/api/src/modules/orchestrator/reauth-detector.ts):
   - Patrones detectados: pairing required, authorization required, more scopes, permission denied, etc.
   - Búsqueda recursiva en: error, message, result, executionTrace, debugSnapshot
   - Función: detectReauthRequired() → { requiresReauth, matchedPattern, matchSource, matchedText }
   - Función: createReauthRequiredResponse() → respuesta estandarizada

2. **Output Type** (orchestrator/output-normalizer.ts + web/lib/output-normalizer.ts):
   - Nuevo tipo: 'reauthorization_required'
   - Campo executionStatus en respuesta
   - reauthInfo con detalles del match
   - Helpers: needsReauthorization(), getReauthInfo()

3. **Orchestrator** (orchestrator/routes.ts):
   - Detecta reauth después de cada llamada a OpenClaw
   - Si detecta reauth → crea respuesta con executionStatus: 'reauthorization_required'
   - Completa task como 'error' con source 'openclaw-reauth'
   - Incluye reauthInfo en meta

4. **UI** (SecurityResultPanel.tsx + OutputViewer.tsx):
   - Nuevo estado visual: REAUTORIZACIÓN REQUERIDA (color rose)
   - Icono: 🔐
   - Mensaje claro indicando necesidad de permisos
   - Botón para ir a reautorizar en OpenClaw
   - Detalles técnicos del match detectado

### Patrones detectados

```typescript
const REAUTH_PATTERNS = [
  /pairing required/i,
  /authorization required/i,
  /more scopes/i,
  /device is asking for more scopes/i,
  /reauthorize/i,
  /permission denied/i,
  /not authorized/i,
  /requires authorization/i,
  /access denied/i,
  /insufficient permissions/i,
  /token expired/i,
  /session expired/i,
  /auth.*required/i,
  /need.*permission/i,
  /grant.*access/i,
  /oauth.*error/i,
  /scope.*required/i,
  /unauthorized/i,
]
```

### Archivos creados

| Archivo | Propósito |
|---------|-----------|
| apps/api/src/modules/orchestrator/reauth-detector.ts | Detector de errores de reautorización |

### Archivos modificados

| Archivo | Cambios |
|---------|---------|
| apps/api/src/modules/orchestrator/output-normalizer.ts | Tipo reauthorization_required |
| apps/api/src/modules/orchestrator/index.ts | Export reauth-detector |
| apps/api/src/modules/orchestrator/routes.ts | Detección reauth en OpenClaw responses |
| apps/web/src/lib/output-normalizer.ts | Tipo y detección reauth |
| apps/web/src/components/control/SecurityResultPanel.tsx | Estado visual reauth |
| apps/web/src/components/control/OutputViewer.tsx | ReauthorizationOutput component |

### Flujo de detección

```
1. OpenClaw devuelve respuesta
2. detectReauthRequired() analiza response
3. Si match encontrado:
   - Log: "[Reauth Detector] Found in {source}: {matchedText}"
   - Return { requiresReauth: true, matchedPattern, matchSource, matchedText }
4. Orchestrator crea respuesta con executionStatus: 'reauthorization_required'
5. Frontend detecta executionStatus y muestra UI de reautorización
```

### Verificaciones

- ✅ Reauth detector creado
- ✅ Output type reauthorization_required añadido
- ✅ Orchestrator detecta reauth en todas las rutas OpenClaw
- ✅ Frontend normalizer actualizado
- ✅ SecurityResultPanel con estado visual
- ✅ OutputViewer con ReauthorizationOutput
- ✅ npm run check sin errores
- ✅ npm run build exitoso

---

## FIX 123 - OpenClaw Persistent Setup & Pairing Flow

**Fecha**: 2026-05-05
**Estado**: Completado

### Problema

- El pairing NO es un error transitorio, es un estado PERSISTENTE del sistema
- Si OpenClaw requiere pairing, TODAS las solicitudes deben bloquearse hasta resolver
- Las acciones ejecutadas durante setup_required se perdían
- No había visibilidad global del estado de configuración de OpenClaw
- El estado de setup no sobrevivía a reinicios del servidor

### Principio clave

El pairing es un **estado del sistema**, no un error de una solicitud específica:
- Debe sobrevivir reinicios
- No depende de sesiones
- Es visible en todo el sistema
- Bloquea ejecución OpenClaw hasta resolverse
- Almacena acciones pendientes para reintentar después del setup

### Solución

1. **System State Module** (apps/api/src/modules/system-state/):
   - types.ts: SystemState, PendingAction, OpenClawSetupStatus
   - service.ts: Persistencia en data/system-state.json
   - routes.ts: API endpoints para gestión de estado
   - Funciones: getSystemState, markOpenClawReady, markOpenClawRequiresSetup, storePendingAction, consumePendingAction

2. **Reauth Detector Updates** (orchestrator/reauth-detector.ts):
   - detectAndMarkReauthRequired(): Detecta reauth Y actualiza system state
   - shouldBlockForSetup(): Verifica si OpenClaw requiere setup
   - recordOpenClawSuccess(): Registra ejecución exitosa (limpia setup_required)
   - createSetupRequiredResponse(): Respuesta estandarizada para setup_required

3. **Orchestrator Blocking** (orchestrator/routes.ts):
   - Verifica shouldBlockForSetup() antes de cada llamada a OpenClaw
   - Si requiere setup: almacena pending action y retorna setup_required
   - Si éxito: llama recordOpenClawSuccess() para limpiar estado
   - Aplica a: provider=openclaw, fallback, y streaming

4. **Check Auth Endpoint** (openclaw/routes.ts → handleCheckAuth):
   - GET /openclaw/check-auth
   - Verifica estado de todas las superficies (WS, REST, Tools)
   - Detecta errores de pairing/authorization
   - Actualiza system state automáticamente

5. **Setup Page** (pages/control/Setup.tsx):
   - Muestra estado actual de OpenClaw
   - Botón "Verificar conexión" (llama check-auth)
   - Botón "Marcar como listo" (manual override)
   - Muestra acciones pendientes
   - Botón "Reintentar acción"
   - Instrucciones de configuración

6. **API Client Updates** (services/api.ts):
   - getSystemState(): Obtiene estado del sistema
   - getPendingAction(): Obtiene acción pendiente
   - markOpenClawReady(): Marca OpenClaw como listo
   - checkOpenClawAuth(): Verifica autenticación
   - consumePendingAction(): Obtiene y limpia acción pendiente

### Archivos creados

| Archivo | Propósito |
|---------|-----------|
| apps/api/src/modules/system-state/types.ts | Tipos del sistema |
| apps/api/src/modules/system-state/service.ts | Persistencia de estado |
| apps/api/src/modules/system-state/routes.ts | API endpoints |
| apps/api/src/modules/system-state/index.ts | Exports del módulo |
| apps/web/src/pages/control/Setup.tsx | Página de configuración |

### Archivos modificados

| Archivo | Cambios |
|---------|---------|
| apps/api/src/modules/orchestrator/reauth-detector.ts | detectAndMarkReauthRequired, shouldBlockForSetup, recordOpenClawSuccess |
| apps/api/src/modules/orchestrator/routes.ts | Blocking antes de OpenClaw execution |
| apps/api/src/modules/orchestrator/trace.ts | Source type 'setup-required' |
| apps/api/src/modules/openclaw/routes.ts | handleCheckAuth endpoint |
| apps/api/src/index.ts | Rutas system-state y check-auth |
| apps/web/src/services/api.ts | Métodos y tipos system state |
| apps/web/src/pages/control/index.ts | Export Setup |
| apps/web/src/App.tsx | Route /control/setup |

### API Endpoints

| Endpoint | Método | Propósito |
|----------|--------|-----------|
| /system/state | GET | Estado actual del sistema |
| /system/pending-action | GET | Acción pendiente |
| /system/clear-pending-action | POST | Limpiar acción pendiente |
| /system/consume-pending-action | POST | Obtener y limpiar acción |
| /system/mark-openclaw-ready | POST | Marcar OpenClaw como listo |
| /openclaw/check-auth | GET | Verificar auth y actualizar estado |

### Flujo de bloqueo

```
1. Usuario envía acción a orchestrator
2. shouldBlockForSetup() verifica system state
3. Si openclawRequiresSetup === true:
   a. storePendingAction() guarda la acción
   b. Retorna executionStatus: 'setup_required'
   c. Frontend detecta y muestra banner/mensaje
4. Si no requiere setup:
   a. Ejecuta acción normalmente
   b. Si éxito: recordOpenClawSuccess() limpia estado
   c. Si reauth error: detectAndMarkReauthRequired() marca setup_required
```

### Verificaciones

- ✅ System state module creado
- ✅ Persistencia en JSON funcional
- ✅ Reauth detector integrado con system state
- ✅ Orchestrator bloquea antes de OpenClaw
- ✅ Check-auth endpoint funcional
- ✅ Setup page creada
- ✅ API routes registradas
- ✅ Source type 'setup-required' añadido
- ✅ npm run check sin errores
- ✅ npm run build exitoso

---

## FIX 123.1 - OpenClaw Setup Hardening & Scoped Reauthorization

**Fecha**: 2026-05-05
**Estado**: Completado

### Problema

FIX 123 tenía problemas de diseño:

1. `openclawRequiresSetup === true` bloqueaba TODO OpenClaw, incluso queries simples
2. Endpoint `/system/mark-openclaw-ready` permitía marcar listo sin verificación real
3. No había auto-clear cuando OpenClaw funcionaba para scopes específicos
4. Estado de setup genérico sin distinguir scopes/capabilities
5. UI necesitaba mostrar requisitos específicos, no solo flag genérico

### Reglas de diseño

- NO bloquear todo OpenClaw por un problema de scope específico
- NO permitir marcar OpenClaw como listo sin verificación real
- El sistema debe auto-limpiar cuando OpenClaw funciona
- Requisitos granulares por scope/capability

### Solución

1. **Tipos granulares** (system-state/types.ts):
   - `OpenClawScopeKey`: 'os:open_app' | 'os:install' | 'os:filesystem' | 'os:browser' | 'os:system' | 'openclaw:unknown_scope'
   - `OpenClawSetupRequirement`: id, scopeKey, capabilityKey, reason, status, timestamps
   - SystemState con `setupRequirements[]` para tracking granular

2. **Detección granular** (reauth-detector.ts):
   - `CAPABILITY_SCOPE_MAP`: Mapea capabilityKey a scopeKey
   - `detectScopeFromError()`: Detecta scope desde texto de error
   - `getScopeFromCapability()`: Obtiene scope de capability
   - `shouldBlockForSetup()` ahora acepta contexto con `isSimpleQuery`
   - `getBlockingRequirement()`: Obtiene requirement que bloquea

3. **Blocking inteligente** (orchestrator/routes.ts):
   - Queries simples (`simple_question`, `analysis_task`) no bloquean
   - Blocking solo cuando hay requirement activo para el scope
   - Auto-clear en `recordOpenClawSuccess()` por scope específico

4. **Check-auth mejorado** (openclaw/routes.ts):
   - Resuelve TODOS los requirements cuando auth OK
   - Retorna `activeRequirements[]` y `resolvedRequirements[]`
   - Retorna `resolvedCount` al resolver

5. **Mark-ready verificado** (system-state/routes.ts):
   - Ya no permite marcar listo manualmente
   - Llama internamente a `checkOpenClawAuth()`
   - Solo resuelve requirements si verificación pasa
   - Retorna `verified: true/false` y `resolvedCount`

6. **UI granular** (Setup.tsx):
   - Muestra lista de requirements activos por scope
   - Función `formatScopeKey()` para labels legibles
   - Muestra scope en pending action
   - Botón "Verificar y marcar como listo" (no manual)

7. **Tipos frontend** (api.ts):
   - `OpenClawScopeKey` type
   - `OpenClawSetupRequirement` interface
   - `SystemStateData.activeRequirements[]`
   - `PendingActionData.scopeKey`

### Archivos modificados

| Archivo | Cambios |
|---------|---------|
| apps/api/src/modules/system-state/types.ts | OpenClawScopeKey, OpenClawSetupRequirement, setupRequirements[] |
| apps/api/src/modules/system-state/service.ts | addSetupRequirement, getActiveRequirements, resolveSetupRequirement, resolveAllRequirements, shouldBlockExecution |
| apps/api/src/modules/system-state/routes.ts | handleMarkOpenClawReady async con verificación |
| apps/api/src/modules/orchestrator/reauth-detector.ts | CAPABILITY_SCOPE_MAP, detectScopeFromError, getScopeFromCapability, getBlockingRequirement |
| apps/api/src/modules/orchestrator/routes.ts | Contexto granular en shouldBlockForSetup y recordOpenClawSuccess |
| apps/api/src/modules/openclaw/routes.ts | handleCheckAuth con granular requirements |
| apps/web/src/services/api.ts | Tipos granulares |
| apps/web/src/pages/control/Setup.tsx | UI granular requirements |

### API Changes

| Endpoint | Cambio |
|----------|--------|
| GET /system/state | Ahora incluye `activeRequirements[]` y `activeRequirementCount` |
| POST /system/mark-openclaw-ready | Ahora verifica antes de marcar, retorna `verified`, `resolvedCount` |
| GET /openclaw/check-auth | Retorna `activeRequirements[]`, `resolvedRequirements[]`, `resolvedCount` |

### Verificaciones

- ✅ Tipos granulares implementados
- ✅ Detección por scope funcional
- ✅ Blocking inteligente (no bloquea queries simples)
- ✅ Auto-clear por scope específico
- ✅ Check-auth resuelve requirements
- ✅ Mark-ready requiere verificación
- ✅ UI muestra requirements granulares
- ✅ npm run check sin errores
- ✅ npm run build exitoso

---

## FIX 124 - Final Execution Status Resolution

**Fecha**: 2026-05-05
**Estado**: Completado

### Problema

La UI mostraba "PERMITIDO" aunque realmente:
- OpenClaw no ejecutó la acción
- executionConfirmed = false
- requiresReauth = true
- resultado fue setup_required / reauthorization_required / incomplete

Problema clave: **Permitido ≠ Ejecutado**

### Principio

Separar siempre:
1. **HubDecision**: allowed | blocked (decisión de política)
2. **ExecutionStatus**: executed | setup_required | reauthorization_required | failed | partial | pending_confirmation | skipped | not_started
3. **FinalUiStatus**: lo que se muestra al usuario (prioridad definida)

### Prioridad de resolución

1. Hub blocked → blocked
2. Pending confirmation → pending_confirmation
3. Requires setup → setup_required
4. Requires reauth → reauthorization_required
5. Execution failed → failed
6. Execution confirmed → executed
7. Hub allowed (no execution needed) → allowed
8. Partial → partial

### Solución

1. **Módulo execution-status** (apps/api/src/modules/execution-status/):
   - types.ts: HubDecisionStatus, ExecutionStatus, FinalUiStatus, ResolvedExecutionStatus
   - status-resolver.ts: resolveFinalExecutionStatus()
   - index.ts: exports

2. **Orchestrator integration** (routes.ts):
   - Todas las respuestas incluyen `statusResolution`
   - El resolver determina finalUiStatus según prioridad
   - Setup/reauth tiene prioridad visual sobre allowed

3. **SecurityResultPanel actualizado**:
   - Usa `statusResolution.finalUiStatus` como fuente principal
   - Nuevos estados: executed, setup_required, failed, partial, pending_confirmation
   - Texto y colores personalizados según statusResolution.title/message
   - Sección visual para setup_required con link a /control/setup

4. **Execute.tsx actualizado**:
   - Extrae statusResolution de la respuesta
   - Lo pasa a SecurityResultPanel

### Archivos creados

| Archivo | Propósito |
|---------|-----------|
| apps/api/src/modules/execution-status/types.ts | Tipos de status |
| apps/api/src/modules/execution-status/status-resolver.ts | Resolver de status |
| apps/api/src/modules/execution-status/index.ts | Exports |

### Archivos modificados

| Archivo | Cambios |
|---------|---------|
| apps/api/src/modules/orchestrator/routes.ts | Import resolver, añade statusResolution a respuestas |
| apps/web/src/components/control/SecurityResultPanel.tsx | Usa statusResolution, nuevos estados |
| apps/web/src/components/control/index.ts | Export StatusResolution |
| apps/web/src/pages/control/Execute.tsx | Extrae y pasa statusResolution |

### Verificaciones

- ✅ Módulo execution-status creado
- ✅ resolveFinalExecutionStatus implementado
- ✅ Respuestas incluyen statusResolution
- ✅ SecurityResultPanel usa finalUiStatus
- ✅ Nuevos estados visuales funcionan
- ✅ setup_required muestra link a configuración
- ✅ npm run check sin errores
- ✅ npm run build exitoso

---

## FIX 124.1 - UI Status Binding to statusResolution

**Fecha**: 2026-05-05
**Estado**: Completado

### Problema

Aunque FIX 124 añadió statusResolution en backend, la pantalla /control seguía mostrando:
- "PERMITIDO" cuando debería mostrar "CONFIGURACIÓN REQUERIDA"
- "PERMITIDO" cuando debería mostrar "REAUTORIZACIÓN REQUERIDA"

Causa: resultStatus se calculaba con lógica legacy antes de usar statusResolution.

### Principio

**statusResolution.finalUiStatus manda sobre decision.allowed**

No debe mostrarse "PERMITIDO" si statusResolution indica:
- setup_required
- reauthorization_required
- failed
- pending_confirmation
- partial

### Solución

1. **Helper getStatusResolution** (Execute.tsx):
   - Busca statusResolution en múltiples ubicaciones: response.statusResolution, response.data?.statusResolution, response.meta?.statusResolution
   - Seguro para tipos: valida que sea objeto antes de usarlo

2. **resultStatus prioritiza statusResolution** (Execute.tsx):
   - Si statusResolution?.finalUiStatus existe, se usa directamente
   - Lógica legacy solo se usa como fallback

3. **StatusBar actualizado**:
   - Nueva prop: statusResolution
   - Usa statusResolution.title en lugar de inferir de allowed/blocked
   - Colores basados en statusResolution.severity

4. **DebugPanel actualizado**:
   - Nueva prop: statusResolution
   - Sección "Status Resolution (FIX 124)" con:
     - Hub Decision
     - Execution Status
     - Final UI Status
     - Mensaje

### Archivos modificados

| Archivo | Cambios |
|---------|---------|
| apps/web/src/pages/control/Execute.tsx | getStatusResolution helper, resultStatus usa finalUiStatus primero |
| apps/web/src/components/control/StatusBar.tsx | Nueva prop statusResolution, usa title/severity |
| apps/web/src/components/control/DebugPanel.tsx | Nueva prop statusResolution, sección visual |

### Verificaciones

- ✅ getStatusResolution helper creado
- ✅ resultStatus prioriza statusResolution.finalUiStatus
- ✅ StatusBar usa statusResolution
- ✅ DebugPanel muestra statusResolution
- ✅ npm run check sin errores
- ✅ npm run build exitoso

---

## FIX 124.2 - Consistent Setup Blocking & Requirement Synchronization

**Fecha**: 2026-05-05
**Estado**: Completado

### Problema

Para inputs como "abre la aplicación vscode" se observaba:
1. Una ejecución abre VS Code correctamente
2. La siguiente aparece BLOQUEADA / setup-required
3. Otra aparece ERROR / openclaw-reauth

El comportamiento era no determinístico porque había dos caminos no sincronizados:
- Bloqueo preventivo por systemState
- Fallo posterior de OpenClaw que registra requirement

### Principio

Antes de cualquier llamada a OpenClaw:
1. Resolver intent/capability/scope de forma **consistente**
2. Consultar systemState **fresco** (reload desde disco)
3. Si existe requirement activo aplicable → NO llamar OpenClaw
4. Si no existe → llamar OpenClaw, si falla registrar requirement **inmediatamente**
5. La siguiente llamada equivalente debe bloquear preventivamente

### Solución

1. **resolveExecutionScope** (reauth-detector.ts):
   - Normaliza scope desde múltiples fuentes: capabilityKey, intent, message patterns
   - "abre vscode", "abre la aplicación vscode", "abre Visual Studio Code" → mismo scope: `os:open_app`
   - Prioridad: capability > intent > message > error > default

2. **checkSetupBlockBeforeExecution** (reauth-detector.ts):
   - Recarga systemState desde disco (evita caché viejo)
   - Llama resolveExecutionScope para scope consistente
   - Busca requirement activo que aplique al scope resuelto
   - Devuelve blocked/requirement/scopeKey/reason/source

3. **Orchestrator actualizado** (routes.ts):
   - Antes de OpenClaw: checkSetupBlockBeforeExecution()
   - Si blocked: devuelve setup_required con statusResolution
   - Si no blocked: continúa con OpenClaw
   - Si OpenClaw falla con reauth: detectAndMarkReauthRequired registra requirement inmediatamente

4. **Deduplicación mejorada** (system-state/service.ts):
   - addSetupRequirement busca primero por scopeKey (no solo capabilityKey)
   - Evita crear múltiples requirements para mismo scope

5. **Success scoped** (system-state/service.ts):
   - recordSuccessfulExecution solo resuelve requirements del scope ejecutado
   - No limpia requirements no relacionados

6. **statusResolution en todas las respuestas**:
   - setup_required incluye statusResolution
   - reauthorization_required incluye statusResolution
   - success normal incluye statusResolution

### Archivos modificados

| Archivo | Cambios |
|---------|---------|
| apps/api/src/modules/orchestrator/reauth-detector.ts | resolveExecutionScope, checkSetupBlockBeforeExecution, MESSAGE_SCOPE_PATTERNS |
| apps/api/src/modules/orchestrator/routes.ts | Usa checkSetupBlockBeforeExecution, statusResolution en todas las respuestas OpenClaw |
| apps/api/src/modules/system-state/service.ts | Deduplicación por scope, success scoped |

### Verificaciones

- ✅ Mismo input repetido → mismo comportamiento (determinístico)
- ✅ "abre vscode" y "abre la aplicación vscode" → mismo scope
- ✅ Bloqueo preventivo tras primer fallo de reauth
- ✅ Requirements no se duplican
- ✅ Success limpia solo scope compatible
- ✅ npm run check sin errores
- ✅ npm run build exitoso

---

## FIX 124.3 - OpenClaw Negative Response Overrides Execution Success

**Fecha**: 2026-05-05
**Estado**: Completado

### Problema

Escenario observado:
1. Usuario pide "abre vscode"
2. OpenClaw responde con `executionConfirmed: true`
3. Pero el texto de la respuesta dice: "No puedo abrirla ahora mismo porque el nodo pide reemparejar/permisos adicionales"
4. UI muestra "EJECUTADO" (verde) cuando en realidad NO se ejecutó

El sistema confiaba en el flag `executionConfirmed` sin analizar el contenido semántico de la respuesta.

### Principio

El contenido textual de la respuesta de OpenClaw tiene **prioridad** sobre los flags de éxito del wrapper:
- Si `executionConfirmed: true` pero el texto dice "no puedo", "requiere permisos", etc. → NO es éxito
- Si hay patrones de fallo semántico en el texto → override del status
- Los patrones de fallo tienen prioridad sobre patrones de éxito

### Solución

1. **OpenClaw Result Classifier** (execution-status/openclaw-result-classifier.ts):
   - FAILURE_PATTERNS: Array de patrones regex que indican fallo semántico
     - Español: "no puedo abrir", "no he podido abrir", "requiere permisos", "pide reemparejar"
     - Inglés: "could not open", "pairing required", "authorization required", "permission denied"
   - SUCCESS_PATTERNS: Array de patrones que indican éxito
     - "abierto", "completado", "ejecutado", "opened", "launched", "completed"
   - `extractTextContent()`: Extrae texto recursivamente de cualquier estructura de respuesta
   - `classifyOpenClawExecutionResult()`: Clasifica respuesta y devuelve:
     - executionActuallySucceeded: boolean
     - requiresReauth: boolean
     - requiresSetup: boolean
     - failed: boolean
     - reason: string
     - evidence: string[]

2. **Status Resolver Integration** (execution-status/status-resolver.ts):
   - Nueva prioridad 5: OpenClaw content classification (antes de Priority 6: Execution confirmed)
   - `classifyOpenClawResponse()`: Wrapper que solo clasifica responses de provider=openclaw
   - Si classifier detecta fallo → override con status apropiado (reauthorization_required, setup_required, failed)
   - Nuevos campos en ResolvedExecutionStatus:
     - classifierOverride: boolean
     - classifierEvidence: string[]

3. **Orchestrator Integration** (orchestrator/routes.ts):
   - statusResolution se calcula ANTES de completeTask()
   - Si classifierOverride=true → ajusta taskStatus a 'error'
   - Si classifierOverride + requiresReauth/Setup → registra requirement inmediatamente
   - Response incluye statusResolution con evidencia del classifier

4. **Task History Consistency**:
   - completeTask() recibe el status correcto basado en classifier
   - Historial muestra 'error' cuando classifier detecta fallo semántico
   - No se marca 'success' si el contenido indica que no se pudo ejecutar

5. **Types Updated** (execution-status/types.ts):
   - ResolvedExecutionStatus: +classifierOverride, +classifierEvidence
   - StatusResolverInput: +raw, +provider, +executionTrace

### Archivos creados

| Archivo | Descripción |
|---------|-------------|
| apps/api/src/modules/execution-status/openclaw-result-classifier.ts | Clasificador semántico de respuestas OpenClaw |

### Archivos modificados

| Archivo | Cambios |
|---------|---------|
| apps/api/src/modules/execution-status/types.ts | +classifierOverride, +classifierEvidence en ResolvedExecutionStatus; +raw, +provider, +executionTrace en StatusResolverInput |
| apps/api/src/modules/execution-status/status-resolver.ts | Import classifier, nueva priority 5 para clasificación, classifyOpenClawResponse helper |
| apps/api/src/modules/execution-status/index.ts | Export classifier |
| apps/api/src/modules/orchestrator/routes.ts | statusResolution antes de completeTask, classifierOverride handling, addSetupRequirement import |

### Patrones de fallo detectados

| Categoría | Ejemplos |
|-----------|----------|
| No pudo abrir (ES) | "no puedo abrir", "no he podido abrir", "no pude abrir" |
| No pudo ejecutar (ES) | "no se pudo", "no es posible", "no fue posible" |
| Permisos (ES) | "requiere permisos", "permisos adicionales", "sin autorización" |
| Emparejamiento (ES) | "pide reemparejar", "emparejar", "bloqueado por emparejamiento" |
| No pudo abrir (EN) | "could not open", "failed to open", "unable to open" |
| Auth requerida (EN) | "pairing required", "authorization required", "permission denied" |

### Verificaciones

- ✅ Classifier creado con FAILURE_PATTERNS y SUCCESS_PATTERNS
- ✅ Status resolver integra classifier en priority 5
- ✅ Orchestrator registra requirement cuando classifier detecta fallo
- ✅ Task history usa status correcto del classifier
- ✅ UI muestra warning (rosa) en lugar de success (verde) para fallos semánticos
- ✅ npm run check sin errores
- ✅ npm run build exitoso

---

## FIX 125 - Pairing Auto-Repair Action Button

**Fecha**: 2026-05-05
**Estado**: Completado

### Problema

Después de FIX 124.3, el sistema detecta respuestas negativas de OpenClaw y evita falso "EJECUTADO".
Pero faltaba UX/flujo resolutivo cuando aparece:
- setup_required
- reauthorization_required
- pairing required / more scopes

El usuario no tenía una forma clara de resolver el problema y reintentar la acción.

### Solución

1. **Módulo openclaw-repair** (nuevo):
   - `types.ts`: RepairSession, RepairSessionStatus, StartRepairInput, CheckRepairResult
   - `service.ts`: CRUD de sesiones, verificación de auth, instrucciones de pairing
   - `routes.ts`: Endpoints POST/GET para repair flow
   - Persistencia en `data/openclaw-repair-sessions.json`
   - Historial de eventos en `data/openclaw-repair-history.json`

2. **Endpoints API**:
   - `POST /openclaw/repair/start` - Inicia sesión de reparación
   - `GET /openclaw/repair/:id` - Obtiene sesión por ID
   - `POST /openclaw/repair/:id/check` - Verifica autorización
   - `POST /openclaw/repair/:id/cancel` - Cancela sesión
   - `POST /openclaw/repair/:id/retry` - Marca como reintentada
   - `GET /openclaw/repair/active` - Sesiones activas
   - `GET /openclaw/repair/history` - Historial de eventos

3. **PendingAction actualizada** (system-state/types.ts):
   - Campo `repairSessionId` para tracking
   - Campo `createdAt` para display

4. **SecurityResultPanel mejorado**:
   - Botón "Resolver permisos de OpenClaw" en setup_required/reauthorization_required
   - Botón "Ejecutar localmente" si hay fallback disponible
   - Inicia repair session y navega a /control/setup?repairSessionId=...

5. **Setup Page mejorada**:
   - Lee `repairSessionId` de URL
   - Muestra detalles de la sesión de reparación
   - Instrucciones específicas por scope (os:open_app, os:filesystem, etc.)
   - Botón "Ya autoricé, comprobar" para verificar
   - Botón "Reintentar acción" cuando está listo
   - Botón "Cancelar" para abortar

6. **Instrucciones de pairing por scope**:
   - `os:open_app`: Control de aplicaciones
   - `os:filesystem`: Acceso a archivos
   - `os:browser`: Control de navegador
   - `os:install`: Instalación de software
   - `os:system`: Control del sistema

7. **Historial de eventos repair**:
   - `repair_started`, `repair_checked`, `repair_ready`
   - `repair_failed`, `repair_cancelled`, `retry_after_repair`

### Archivos creados

| Archivo | Descripción |
|---------|-------------|
| apps/api/src/modules/openclaw-repair/types.ts | Tipos para repair sessions |
| apps/api/src/modules/openclaw-repair/service.ts | Lógica de repair sessions |
| apps/api/src/modules/openclaw-repair/routes.ts | Endpoints HTTP |
| apps/api/src/modules/openclaw-repair/index.ts | Exports del módulo |

### Archivos modificados

| Archivo | Cambios |
|---------|---------|
| apps/api/src/index.ts | Nuevas rutas /openclaw/repair/* |
| apps/api/src/modules/system-state/types.ts | +repairSessionId, +createdAt en PendingAction |
| apps/web/src/services/api.ts | Endpoints y tipos repair |
| apps/web/src/components/control/SecurityResultPanel.tsx | Botón "Resolver permisos", "Ejecutar localmente" |
| apps/web/src/pages/control/Setup.tsx | UI de repair session con instrucciones |

### Verificaciones

- ✅ Módulo openclaw-repair creado con tipos, service, routes
- ✅ Endpoints funcionando (start, check, cancel, retry)
- ✅ Botón "Resolver permisos" visible en setup_required/reauth
- ✅ Setup page muestra sesión de reparación con instrucciones
- ✅ Verificación real de autorización (checkRepair)
- ✅ Retry después de verificación exitosa
- ✅ npm run check sin errores
- ✅ npm run build exitoso

---

## FIX 126 - Timeout Recovery & Multistep Task Execution

**Fecha**: 2026-05-05
**Estado**: Completado

### Problema

Cuando una tarea excedía el tiempo límite (timeout), el usuario no tenía forma de:
1. Saber que fue un timeout (no un error genérico)
2. Dividir tareas complejas en pasos más pequeños
3. Reintentar de forma inteligente

Ejemplos: "descarga vlc y instálalo" podría fallar por timeout en la descarga.

### Solución

1. **Detección de timeout** (execution-status/status-resolver.ts):
   - Patrones detectados: "timeout", "Request timeout", "timed out", "ETIMEDOUT", "connection timeout", "socket timeout", "operation timed out", "deadline exceeded"
   - Nueva función `checkTimeout()` que analiza error messages
   - Nuevo estado `timeout` en ExecutionStatus y FinalUiStatus

2. **Módulo task-planner** (nuevo):
   - `types.ts`: TaskStep, SplitTaskResult, TimeoutRecoveryInfo
   - `task-splitter.ts`: Divide tareas complejas en pasos ejecutables
   - Detecta conectores: "y", "e", "luego", "después", "then", "and then"
   - Estimación de duración por verbo (quick/medium/long)

3. **Timeout recovery** (orchestrator/timeout-recovery.ts):
   - `isTimeoutError()`: Detecta si error es timeout
   - `generateTimeoutRecovery()`: Genera estrategia de recuperación
   - Si es divisible → pasos sugeridos
   - Si no → simple retry

4. **Endpoint /tasks/execute-steps** (POST):
   - Ejecuta pasos secuencialmente
   - Respeta dependencias entre pasos
   - Reporta progreso por paso (completed/failed/skipped)

5. **UI para timeout** (SecurityResultPanel):
   - Estado `timeout` con colores azules
   - Muestra pasos sugeridos con duración estimada
   - Botón "Ejecutar paso a paso" si divisible
   - Botón "Reintentar completo"

6. **Types actualizados**:
   - ExecutionStatus: +timeout
   - FinalUiStatus: +timeout
   - RecoveryType: timeout_recovery | retry | skip | none
   - TimeoutRecoveryResult con pasos e info de recovery

### Archivos creados

| Archivo | Descripción |
|---------|-------------|
| apps/api/src/modules/task-planner/types.ts | Tipos para task splitting |
| apps/api/src/modules/task-planner/task-splitter.ts | Lógica de división de tareas |
| apps/api/src/modules/task-planner/index.ts | Exports del módulo |
| apps/api/src/modules/orchestrator/timeout-recovery.ts | Generación de estrategia de recovery |

### Archivos modificados

| Archivo | Cambios |
|---------|---------|
| apps/api/src/modules/execution-status/types.ts | +timeout en ExecutionStatus y FinalUiStatus |
| apps/api/src/modules/execution-status/status-resolver.ts | +checkTimeout(), +STATUS_LABELS.timeout, +STATUS_SEVERITY.timeout |
| apps/api/src/modules/orchestrator/types.ts | +RecoveryType, +TaskStepInfo, +TimeoutRecoveryResult, +ExecuteStepsInput, +ExecuteStepsResult |
| apps/api/src/modules/orchestrator/index.ts | +export timeout-recovery |
| apps/api/src/modules/tasks/routes.ts | +handleExecuteSteps para paso a paso |
| apps/api/src/modules/tasks/index.ts | +export handleExecuteSteps |
| apps/api/src/index.ts | +ruta POST /tasks/execute-steps |
| apps/web/src/components/control/SecurityResultPanel.tsx | +timeout status, +TimeoutRecoveryInfo, +UI para pasos |

### Patrones de timeout detectados

| Patrón | Ejemplo |
|--------|---------|
| timeout | "Operation timeout" |
| request timeout | "Request timeout after 30s" |
| timed out | "Connection timed out" |
| etimedout | "Error: ETIMEDOUT" |
| connection timeout | "Connection timeout" |
| socket timeout | "Socket timeout" |
| operation timed out | "The operation timed out" |
| deadline exceeded | "Deadline exceeded" |

### Conectores de multistep detectados

| Conector | Ejemplo |
|----------|---------|
| y | "descarga vlc y instálalo" |
| e | "abre chrome e inicia sesión" |
| luego | "descarga archivo luego ábrelo" |
| después | "instala app después configúrala" |
| then | "download file then open it" |
| and then | "install app and then run it" |

### Verificaciones

- ✅ Timeout detectado correctamente en status-resolver
- ✅ Nuevo estado timeout en types
- ✅ Task-planner divide tareas complejas en pasos
- ✅ Timeout-recovery genera estrategia con pasos
- ✅ UI muestra estado timeout con colores azules
- ✅ Botones "Ejecutar paso a paso" y "Reintentar completo"
- ✅ Endpoint /tasks/execute-steps ejecuta secuencialmente
- ✅ npm run check sin errores
- ✅ npm run build exitoso

---

## FIX 125.1 - Setup Page Robustness & Repair Data Normalization

**Fecha**: 2026-05-05
**Estado**: Completado

### Problema

Al pulsar "Ir a Configuración" desde CONFIGURACIÓN REQUERIDA, la ruta `/control/setup` quedaba en blanco con error:

```
Uncaught TypeError: Cannot read properties of undefined (reading 'substring')
at Setup.tsx:576
```

Causas:
- Llamadas a `.substring()` sobre valores undefined (pendingAction.input, repairSession.originalInput, etc.)
- Requirements legacy sin id/scopeKey/createdAt
- Repair sessions con datos incompletos
- No había manejo de error para sesiones inválidas

### Solución

1. **Helpers seguros** (Setup.tsx):
   - `safeText(value, fallback)`: Devuelve valor o fallback
   - `shortId(value, fallback)`: Acorta IDs de forma segura
   - `safeSubstring(value, maxLen, fallback)`: Substring seguro
   - `safeDate(value)`: Parsea fechas sin crash

2. **Normalización frontend** (Setup.tsx):
   - `normalizeRequirement(raw, index)`: Completa campos faltantes
   - `normalizeRepairSession(session)`: Completa campos faltantes
   - Se aplica a todos los datos antes de render

3. **Normalización backend**:
   - `system-state/service.ts`: Normaliza requirements al cargar JSON
   - `openclaw-repair/service.ts`: Normaliza sessions al cargar JSON
   - Migración automática de datos legacy

4. **UI mejorada**:
   - Error visible cuando repair session no existe
   - Mensaje claro para os:install ("Aunque otra instalación haya funcionado...")
   - Nunca queda en blanco

### Archivos modificados

| Archivo | Cambios |
|---------|---------|
| apps/web/src/pages/control/Setup.tsx | +helpers seguros, +normalización, +os:install message, +error handling |
| apps/api/src/modules/system-state/service.ts | +safeSubstring, +normalizeRequirement, +migración datos |
| apps/api/src/modules/openclaw-repair/service.ts | +normalizeRepairSession, +migración datos |

### Helpers añadidos

```typescript
// Frontend (Setup.tsx)
safeText(value, fallback = 'N/D')
shortId(value, fallback = 'sin-id')
safeSubstring(value, maxLen, fallback = '')
safeDate(value)
normalizeRequirement(raw, index)
normalizeRepairSession(session)
getInstallExplanation(scopeKey)

// Backend
safeSubstring(value, maxLen)  // system-state
normalizeRequirement(req, index)  // system-state
normalizeRepairSession(session, index)  // openclaw-repair
```

### Verificaciones

- ✅ /control/setup sin repairSessionId: muestra requirements o "sin setup pendiente"
- ✅ /control/setup?repairSessionId=invalid: muestra "sesión no encontrada"
- ✅ Requirement sin scopeKey: muestra "Permiso desconocido"
- ✅ Requirement os:install: muestra mensaje explicativo
- ✅ Pulsar "Ir a Configuración" desde CONFIGURACIÓN REQUERIDA: navega correctamente
- ✅ npm run check sin errores
- ✅ npm run build exitoso

---

## FEATURE 130 - Advanced Tasks (Persistent, Reusable, Optimized Execution)

**Fecha**: 2026-05-06

### Objetivo

Implementar "memoria de tareas" que permite reutilizar patrones de ejecución aprendidos sin llamar a OpenClaw/AI, ahorrando tokens y mejorando tiempos de respuesta.

### Problema

- Cada petición idéntica o similar llamaba a OpenClaw
- No había aprendizaje de tareas exitosas
- Desperdicio de tokens en tareas repetidas
- Sin optimización de ejecuciones frecuentes

### Solución

1. **Módulo task-memory**: Almacena patrones aprendidos de ejecuciones exitosas
2. **Normalización de input**: Permite que "abre Chrome" y "abre chrome" coincidan
3. **Reutilización antes de OpenClaw**: Si hay patrón válido, ejecuta sin AI
4. **Learning después de ejecución**: Aprende de cada ejecución exitosa

### Arquitectura

```
Input del usuario
       ↓
  Normalizar input
       ↓
  Buscar patrón
       ↓
  ¿Encontrado y confiable?
     /          \
   SÍ            NO
    ↓             ↓
 Ejecutar     OpenClaw
 desde         ejecuta
 patrón          ↓
    ↓          Aprender
 Registrar     patrón
 reutilización
```

### TaskPattern (tipo principal)

```typescript
interface TaskPattern {
  id: string
  inputSignature: string      // Hash normalizado para matching
  normalizedInput: string     // Input canónico
  originalInputs: string[]    // Variantes que mapearon a este patrón
  steps: TaskStep[]           // Pasos aprendidos
  successRate: number         // 0-1, tasa de éxito
  lastUsedAt: string          // Última vez usado
  createdAt: string           // Cuando se creó
  executionCount: number      // Veces ejecutado
  avgDuration: number         // Duración promedio (ms)
  metadata?: {
    category?: string         // install, open, search, etc.
    requiredScopes?: string[]
    isMultiStep?: boolean
    language?: 'es' | 'en'
  }
}
```

### Normalización de input

```typescript
normalizeTaskInput("Abre Chrome, por favor!!")
// → "abre chrome favor por"

// Proceso:
// 1. Lowercase
// 2. Eliminar puntuación
// 3. Normalizar espacios
// 4. Ordenar palabras (independiente del orden)
```

### Condiciones para reutilización

- `successRate >= 0.7` (70% de éxito mínimo)
- `confidence >= 0.8` (80% de similitud)
- `executionCount >= 1` (al menos una ejecución previa)

### API Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | /task-memory/patterns | Lista patrones (sort: recent, top) |
| GET | /task-memory/stats | Estadísticas globales |
| POST | /task-memory/find | Buscar patrón para input |
| POST | /task-memory/normalize | Normalizar input (debug) |
| POST | /task-memory/clear | Limpiar todos los patrones |
| DELETE | /task-memory/patterns/:id | Eliminar patrón específico |

### Archivos creados

| Archivo | Descripción |
|---------|-------------|
| apps/api/src/modules/task-memory/types.ts | Tipos (TaskPattern, etc.) |
| apps/api/src/modules/task-memory/service.ts | Persistencia y lógica |
| apps/api/src/modules/task-memory/routes.ts | API handlers |
| apps/api/src/modules/task-memory/index.ts | Exports |
| apps/api/src/modules/orchestrator/task-memory-integration.ts | Integración con orchestrator |

### Archivos modificados

| Archivo | Cambios |
|---------|---------|
| apps/api/src/modules/orchestrator/routes.ts | +checkTaskMemory antes de OpenClaw, +learnFromExecution después |
| apps/api/src/modules/orchestrator/trace.ts | +'task-memory' en stage y source types |
| apps/api/src/modules/orchestrator/index.ts | +export task-memory-integration |
| apps/api/src/modules/execution-status/types.ts | +fromTaskMemory en meta |
| apps/api/src/index.ts | +rutas task-memory |

### Funciones principales

```typescript
// Buscar patrón reutilizable (ANTES de OpenClaw)
checkTaskMemory({ input, tenantId, userId }): CheckTaskMemoryResult

// Obtener plan de ejecución desde patrón
getExecutionPlanFromPattern({ pattern, tenantId, userId }): ExecuteFromPatternResult

// Aprender de ejecución exitosa (DESPUÉS de OpenClaw)
learnFromExecution({ originalInput, steps, success, duration, ... }): LearnFromExecutionResult

// Registrar reutilización de patrón
recordPatternExecution(patternId, success, duration): void
```

### Flujo en orchestrator/routes.ts

```typescript
// 1. Check task memory ANTES de OpenClaw
const taskMemoryCheck = checkTaskMemory({ input, tenantId, userId })

if (taskMemoryCheck.canReuse && taskMemoryCheck.pattern) {
  // Usar patrón sin llamar a AI
  const executionPlan = getExecutionPlanFromPattern({ pattern })
  recordPatternExecution(patternId, true, duration)
  // ... responder con result
  return
}

// 2. Ejecutar via OpenClaw normalmente
const result = await runSimpleAgentTask(taskInput)

// 3. Aprender DESPUÉS de ejecución exitosa
if (taskStatus === 'success') {
  learnFromExecution({
    originalInput,
    steps: trace.getSteps(),
    success: true,
    duration: executionDuration,
    scopeKey,
    capabilityKey
  })
}
```

### Persistencia

Archivo: `data/task-memory.json`

```json
{
  "version": 1,
  "patterns": [...],
  "lastUpdated": "2026-05-06T...",
  "stats": {
    "totalPatterns": 10,
    "totalExecutions": 50,
    "tokensEstimatedSaved": 25000,
    "avgSuccessRate": 0.92
  }
}
```

### Verificaciones

- ✅ npm run check sin errores
- ✅ npm run build exitoso
- ✅ Tipos añadidos correctamente (task-memory stage/source)
- ✅ Rutas API registradas
- ✅ Integración con orchestrator completa

---

## FIX 130.1 - Safe Task Memory Matching & Validation

**Fecha:** 2026-05-06
**Estado:** ✅ Completado

### Problema
FEATURE 130 (Task Memory) aprendía de cualquier ejecución "success" sin validar:
1. Matching inseguro - sin verificar tenant, actionType, targetEntity
2. Aprendía de ejecuciones parciales, timeouts, setup_required
3. No había invalidación de patrones que fallaran
4. Sin precondiciones antes de reutilizar patrones

### Solución implementada

#### A. TaskPattern extendido con campos seguros

```typescript
export interface TaskPattern {
  id: string
  tenantId: string                    // Required: tenant isolation
  userId?: string
  actionType: TaskActionType          // Classified action type
  targetEntity?: string               // Target of action (chrome, vscode, etc.)
  environmentFingerprint: EnvironmentFingerprint  // Platform, hostname, provider
  signature: string                   // "actionType:targetEntity"
  successRate: number                 // 0.0 - 1.0
  confidence: number                  // Match confidence
  useCount: number                    // Total uses
  failureCount: number                // Consecutive failures
  version: number                     // Pattern version for migration
  invalidated: boolean                // Manually or auto-invalidated
  invalidationReason?: string
  // ... other fields
}

export const CURRENT_TASK_PATTERN_VERSION = 1
```

#### B. Normalización intent-aware

```typescript
export type TaskActionType =
  | 'open_app' | 'close_app' | 'install_app' | 'uninstall_app'
  | 'download_file' | 'navigate_url' | 'search_web'
  | 'file_operation' | 'folder_operation' | 'system_command'
  | 'play_media' | 'control_media' | 'script_execution'
  | 'clipboard_action' | 'keyboard_action' | 'mouse_action'
  | 'general_task'

export interface NormalizedIntent {
  signature: string           // "actionType:targetEntity"
  actionType: TaskActionType
  targetEntity?: string
  normalizedIntent: string
  confidence: number
  language: 'es' | 'en'
}
```

Normalización de nombres de apps:
- "google chrome", "chrome browser" → "chrome"
- "visual studio code", "vs code" → "vscode"
- "vlc media player" → "vlc"

#### C. Safe Matching con criterios estrictos

```typescript
const MIN_SUCCESS_RATE = 0.75    // 75% mínimo
const MIN_CONFIDENCE = 0.75      // 75% similitud mínima
const MAX_FAILURE_COUNT = 3      // Auto-invalidar después de 3 fallos

// Filtros en findPatternByInput:
// 1. !invalidated
// 2. version === CURRENT_VERSION
// 3. tenantId matches
// 4. successRate >= MIN_SUCCESS_RATE
// 5. confidence >= MIN_CONFIDENCE
// 6. failureCount < MAX_FAILURE_COUNT
// 7. actionType matches exactly
// 8. targetEntity matches exactly (if present)
// 9. environment compatible (same platform, provider)
```

#### D. Precondition Checks

```typescript
export interface PreconditionCheckResult {
  ok: boolean
  reason?: string
  warnings: string[]
}

// Checks antes de reutilizar:
// - Ambiente compatible (platform, OS)
// - Provider igual
// - No tiene failureCount > 0 reciente
```

#### E. Learning seguro (solo executed confirmado)

```typescript
// learnFromExecution() ahora bloquea learning si:
if (!success) return { learned: false, reason: 'Execution failed' }
if (!executionConfirmed) return { learned: false, reason: 'Execution not confirmed' }
if (finalUiStatus !== 'executed') return { learned: false, reason: `Status not executed: ${finalUiStatus}` }
if (requiresSetup) return { learned: false, reason: 'Requires setup - not learning' }
if (requiresReauth) return { learned: false, reason: 'Requires reauth - not learning' }
if (timeout) return { learned: false, reason: 'Timeout - not learning' }
if (partial) return { learned: false, reason: 'Partial execution - not learning' }
if (classifierOverride) return { learned: false, reason: 'Classifier override detected - not learning' }
```

#### F. Failure Feedback & Auto-invalidación

```typescript
export function recordPatternReuse(
  patternId: string,
  success: boolean,
  duration: number
): void {
  if (success) {
    pattern.failureCount = 0
    pattern.useCount++
    // Recalculate successRate
  } else {
    pattern.failureCount++
    pattern.successRate = calculateNewRate(...)

    // Auto-invalidate after 3 consecutive failures or <50% success
    if (pattern.failureCount >= MAX_FAILURE_COUNT || pattern.successRate < 0.5) {
      invalidatePattern(patternId, 'Auto-invalidated: too many failures')
    }
  }
}
```

#### G. Pattern Versioning

```typescript
export const CURRENT_TASK_PATTERN_VERSION = 1

// En findPatternByInput:
if (pattern.version !== CURRENT_TASK_PATTERN_VERSION) {
  // Skip incompatible patterns
  continue
}
```

### API Endpoints nuevos

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | /task-memory/patterns/:id/invalidate | Invalidar patrón manualmente |
| POST | /task-memory/patterns/:id/validate | Revalidar patrón invalidado |

### Archivos modificados

| Archivo | Cambios |
|---------|---------|
| apps/api/src/modules/task-memory/types.ts | +TaskActionType, +EnvironmentFingerprint, +NormalizedIntent, +PreconditionCheckResult, +TaskMemoryDebugInfo, campos seguros en TaskPattern |
| apps/api/src/modules/task-memory/service.ts | +classifyActionType, +extractTargetEntity, +normalizeAppName, +safe findPatternByInput, +runPreconditionChecks, +invalidatePattern, +validatePattern |
| apps/api/src/modules/task-memory/routes.ts | +handleInvalidatePattern, +handleValidatePattern, updated handleFindPattern (requires tenantId) |
| apps/api/src/modules/task-memory/index.ts | +exports nuevas funciones y tipos |
| apps/api/src/modules/orchestrator/task-memory-integration.ts | +checkTaskMemory safe, +learnFromExecution safe con nuevos params |
| apps/api/src/modules/orchestrator/routes.ts | +params seguros a learnFromExecution (tenantId, userId, executionConfirmed, finalUiStatus, requiresSetup, requiresReauth, timeout, partial, classifierOverride) |
| apps/api/src/index.ts | +rutas /task-memory/patterns/:id/invalidate y /validate |

### Flujo actualizado en orchestrator

```typescript
// 1. Check task memory ANTES de OpenClaw (SAFE)
const taskMemoryCheck = checkTaskMemory({
  input: input.message,
  tenantId: context.tenant.id,
  userId: context.user.id
})

// checkTaskMemory ahora verifica:
// - actionType exact match
// - targetEntity exact match
// - tenantId match
// - environment compatible
// - successRate >= 0.75
// - confidence >= 0.75
// - failureCount < 3
// - !invalidated
// - version match

// 2. Si taskStatus === 'success', learn SAFE
const learnResult = learnFromExecution({
  originalInput: input.message,
  tenantId: context.tenant.id,
  userId: context.user.id,
  steps: trace.getSteps().map(...),
  success: true,
  executionConfirmed: debugSnapshot.executionConfirmed,  // FIX 130.1
  duration: executionDuration,
  scopeKey,
  capabilityKey,
  finalUiStatus: statusResolution.finalUiStatus,        // FIX 130.1
  requiresSetup: false,
  requiresReauth: false,
  timeout: false,
  partial: false,
  classifierOverride: statusResolution.classifierOverride  // FIX 130.1
})
// Ahora solo aprende si TODO está correcto
```

### Verificaciones

- ✅ npm run check sin errores
- ✅ npm run build:api exitoso
- ✅ Matching requiere actionType + targetEntity exactos
- ✅ Learning solo de status=executed + executionConfirmed=true
- ✅ Bloquea learning de setup_required, reauth, timeout, partial
- ✅ Auto-invalidación después de 3 fallos consecutivos
- ✅ API para invalidar/validar patrones manualmente
- ✅ Pattern versioning para migraciones futuras

---

## FEATURE 130.2 - Composite Tasks & Intelligent Task Chaining

**Fecha:** 2026-05-06
**Estado:** ✅ Completado

### Problema
El sistema recordaba tareas simples pero NO:
- Componía tareas aprendidas
- Reutilizaba subflujos
- Encadenaba capacidades
- Optimizaba workflows complejos

Ejemplo: "descargar VLC, instalarlo y abrirlo" no reutilizaba los patrones individuales de download, install y open.

### Solución implementada

#### Arquitectura Composite Tasks

```
apps/api/src/modules/composite-tasks/
├── types.ts       # CompositeTask, CompositeTaskStep, CompositeExecutionPlan
├── service.ts     # Persistencia y CRUD
├── planner.ts     # buildCompositeExecutionPlan, splitInputIntoSteps
├── executor.ts    # executeCompositePlan, retryFailedStep
├── routes.ts      # API handlers
└── index.ts       # Exports
```

#### CompositeTask Model

```typescript
export interface CompositeTask {
  id: string
  tenantId: string
  name: string
  normalizedIntent: string
  signature: string                    // "download_file:vlc|install_app:vlc|open_app:vlc"
  triggerPatterns: string[]
  steps: CompositeTaskStep[]
  successRate: number
  executionCount: number
  failureCount: number
  version: number
  invalidated: boolean
}

export interface CompositeTaskStep {
  stepId: string
  order: number
  type: 'task_memory' | 'capability' | 'openclaw' | 'manual'
  actionType: TaskActionType
  targetEntity?: string
  taskPatternId?: string
  capabilityKey?: string
  requiresAi: boolean
  requiresConfirmation: boolean
  dependsOnPrevious: boolean
}
```

#### Planner: buildCompositeExecutionPlan

```typescript
// 1. Detectar si es composite candidate
isCompositeCandidate(input)  // busca "y", "e", ",", "entonces"

// 2. Dividir en substeps
splitInputIntoSteps("descargar VLC e instalarlo")
// → ["descargar VLC", "instalarlo"]

// 3. Detectar action chains predefinidas
detectActionChain("instalar vlc")
// → ['download_file', 'install_app']

// 4. Buscar patterns/capabilities para cada step
buildStepFromInput(substep, order, tenantId)
// → { type: 'task_memory', taskPatternId: '...' }
// → { type: 'capability', capabilityKey: '...' }
// → { type: 'openclaw', requiresAi: true }
```

#### Executor: executeCompositePlan

```typescript
// Ejecuta steps secuencialmente
for (const step of plan.steps) {
  // Check preconditions (skip if already done)
  const precondition = checkStepPreconditions(step, tenantId)
  if (precondition.shouldSkip) {
    step.status = 'skipped'
    continue
  }

  // Execute based on type
  switch (step.type) {
    case 'task_memory':
      // Reuse learned pattern
      const pattern = checkTaskMemory({ input: step.description, tenantId })
      if (pattern.canReuse) { ... }
      break

    case 'capability':
      // Execute local capability
      const result = await dispatchCapabilityExecution(capability, { ... })
      break

    case 'openclaw':
      // Delegate to OpenClaw
      const result = await runSimpleAgentTask({ message: step.description, tenantId })
      break
  }
}
```

#### Recovery & Learning

```typescript
// Partial completion allowed
if (failedStep && completedSteps.length > 0) {
  executionStatus = 'partial'
}

// Learn new composite if >80% success
if (success && successRate >= 0.8 && !existingComposite) {
  saveCompositeTask({ tenantId, name, steps: successfulSteps })
}

// Retry failed step
retryFailedStep(plan, stepId, input)

// Continue from step
continueFromStep(plan, fromStepId, input)
```

### API Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | /composite-tasks | Lista composite tasks del tenant |
| GET | /composite-tasks/stats | Estadísticas |
| GET | /composite-tasks/:id | Obtener por ID |
| POST | /composite-tasks/find | Buscar/crear plan |
| POST | /composite-tasks/execute | Ejecutar plan |
| POST | /composite-tasks/:id/invalidate | Invalidar |
| POST | /composite-tasks/:id/validate | Revalidar |
| DELETE | /composite-tasks/:id | Eliminar |
| POST | /composite-tasks/clear | Limpiar todos |

### Trace Stages

Añadidos a ExecutionTraceStep:
- `composite-plan` - Plan creado
- `composite-step` - Step ejecutándose
- `composite-complete` - Workflow completado

Añadido a DebugSnapshot.source:
- `composite`

### Archivos creados

| Archivo | Descripción |
|---------|-------------|
| apps/api/src/modules/composite-tasks/types.ts | Tipos: CompositeTask, CompositeExecutionPlan, etc. |
| apps/api/src/modules/composite-tasks/service.ts | Persistencia en data/composite-tasks.json |
| apps/api/src/modules/composite-tasks/planner.ts | buildCompositeExecutionPlan, splitInputIntoSteps |
| apps/api/src/modules/composite-tasks/executor.ts | executeCompositePlan, retryFailedStep |
| apps/api/src/modules/composite-tasks/routes.ts | API handlers |
| apps/api/src/modules/composite-tasks/index.ts | Exports |

### Archivos modificados

| Archivo | Cambios |
|---------|---------|
| apps/api/src/modules/orchestrator/trace.ts | +composite stages y source |
| apps/api/src/index.ts | +rutas composite-tasks |

### Flujo ejemplo

```
Input: "descargar VLC, instalarlo y abrirlo"

1. isCompositeCandidate() → true (detecta ",")

2. detectActionChain() → ['download_file', 'install_app', 'open_app']

3. buildCompositeExecutionPlan():
   Step 1: download_file:vlc → task_memory (si existe pattern)
   Step 2: install_app:vlc → openclaw (no hay pattern)
   Step 3: open_app:vlc → capability (si existe)

4. executeCompositePlan():
   Step 1: Reuse pattern → success
   Step 2: Call OpenClaw → success
   Step 3: Execute capability → success

5. Learn as composite (>80% success rate)

6. Next time: Reuse composite sin AI
```

### Verificaciones

- ✅ npm run check sin errores
- ✅ npm run build:api exitoso
- ✅ Composite planner detecta workflows
- ✅ Reutiliza task-memory patterns
- ✅ Ejecuta secuencial con recovery parcial
- ✅ Aprende nuevos composites

---

## FEATURE 130.3: Validated Workflows & Artifact Verification

**Fecha:** 2026-05-06
**Dependencia:** FEATURE 130.2 (Composite Tasks)

### Problema

El sistema aprendía workflows sin verificar que cada paso realmente se ejecutó correctamente:
- Asumía éxito basado solo en la respuesta de OpenClaw
- No verificaba artefactos generados (archivos descargados, apps instaladas, procesos activos)
- Podía aprender workflows parcialmente exitosos
- No distinguía entre "ejecutado" y "verificado"

### Solución implementada

#### Arquitectura Workflow Validation

```
apps/api/src/modules/workflow-validation/
├── types.ts           # ValidationType, ValidationResult, StepValidation, ValidationPolicy
├── validators.ts      # Funciones de validación por plataforma
├── artifact-checks.ts # runValidation, runValidationWithRetry, canLearnWorkflow
├── service.ts         # validateWorkflowStep, shouldLearnWorkflow, getRecoveryOptions
└── index.ts           # Exports
```

#### Tipos de validación

```typescript
export type ValidationType =
  | 'file_exists'        // Archivo existe
  | 'file_downloaded'    // Archivo descargado (con verificación de tamaño)
  | 'app_installed'      // App instalada en sistema
  | 'app_opened'         // App ejecutándose (proceso activo)
  | 'process_running'    // Proceso activo
  | 'url_reachable'      // URL accesible
  | 'directory_exists'   // Directorio existe
  | 'custom'             // Validación personalizada
```

#### Mapeo ActionType → ValidationType

```typescript
export const ACTION_VALIDATION_MAP: Record<TaskActionType, ValidationType | undefined> = {
  'download_file': 'file_downloaded',
  'install_app': 'app_installed',
  'uninstall_app': 'app_installed',    // inverted check
  'open_app': 'app_opened',
  'close_app': 'process_running',      // inverted check
  'open_file': 'file_exists',
  'open_url': 'url_reachable',
  'create_file': 'file_exists',
  'create_folder': 'directory_exists',
  // ... más acciones
}
```

#### Validadores por plataforma

```typescript
// validators.ts
export async function validateDownloadedFile(target: string, options?): Promise<ValidationResult>
export async function validateInstalledApplication(target: string, options?): Promise<ValidationResult>
export async function validateOpenedApplication(target: string, options?): Promise<ValidationResult>
export async function validateUrlReachable(url: string, options?): Promise<ValidationResult>
export function validateFileExists(filePath: string): ValidationResult
export function validateDirectoryExists(dirPath: string): ValidationResult
```

Cada validador detecta la plataforma (win32/darwin/linux) y usa comandos apropiados:
- **Windows**: `wmic`, `tasklist`, `where`, `reg query`
- **macOS**: `mdfind`, `pgrep`, `ls`
- **Linux**: `which`, `dpkg`, `pgrep`

#### Política de validación

```typescript
export const DEFAULT_VALIDATION_POLICY: ValidationPolicy = {
  strictMode: true,               // Requiere validación exitosa
  allowContinueWithWarnings: true,// Continuar con advertencias
  learnOnlyFullyValidated: true,  // Solo aprender si todo validado
  maxRetries: 2,                  // Intentos por validación
  retryDelayMs: 1000,             // Delay entre reintentos
  validationTimeout: 10000        // Timeout por validación
}
```

#### Extensión de CompositeTaskStep

```typescript
export interface CompositeTaskStep {
  // ... campos existentes
  // FEATURE 130.3: Validation
  validationRequired?: boolean
  validationType?: string
  validationTarget?: string
  validationCritical?: boolean
  validationResult?: {
    ok: boolean
    reason?: string
    warnings: string[]
    evidence: string[]
    attempts: number
  }
}

export type CompositeStepStatus =
  | 'pending' | 'running' | 'success' | 'failed' | 'skipped' | 'blocked'
  | 'validation_failed'    // NUEVO: ejecutado pero validación falló
```

#### Ejecución con validación

```typescript
// executor.ts - executeCompositePlan()
for (const step of plan.steps) {
  // 1. Ejecutar step
  const result = await executeStep(step, input)

  if (result.success) {
    // 2. Validar si requerido
    if (step.validationRequired) {
      const validationResult = await validateWorkflowStep(
        step.stepId, step.order, step.actionType, step.targetEntity, tenantId
      )

      step.validationResult = {
        ok: validationResult.ok,
        reason: validationResult.reason,
        warnings: validationResult.warnings,
        evidence: validationResult.evidence,
        attempts: validationResult.validationAttempts
      }

      // 3. Si critical y falló, detener workflow
      if (step.validationCritical && !validationResult.ok) {
        step.status = 'validation_failed'
        validationStoppedWorkflow = true
        break
      }
    }
  }
}
```

#### Learning con validación

```typescript
// Solo aprender si todas las validaciones pasaron
const learnDecision = shouldLearnWorkflow(stepValidationResults, tenantId)

if (!learnDecision.shouldLearn) {
  learnRejectedReason = learnDecision.reason
  // Ej: "Validaciones fallidas: install_app:vlc"
}
```

#### CompositeExecutionResult extendido

```typescript
export interface CompositeExecutionResult {
  // ... campos existentes
  validatedSteps: string[]           // Steps que pasaron validación
  validationFailedSteps: string[]    // Steps que fallaron validación
  executionStatus: 'completed' | 'partial' | 'failed' | 'blocked' | 'validation_failed'
  learnRejectedReason?: string       // Razón si no se aprendió
}
```

#### Trace stages para validación

```typescript
// trace.ts
stage: '...' | 'artifact-validation' | 'validation-failed' | 'validation-success'
status: '...' | 'validation_failed'
source: '...' | 'validation'
```

```typescript
// Nuevos métodos en ExecutionTraceBuilder
validationStart(stepId: string, validationType: string): void
validationPassed(stepId: string, evidence?: string): void
validationFailed(stepId: string, reason: string): void
```

### Archivos creados

| Archivo | Descripción |
|---------|-------------|
| apps/api/src/modules/workflow-validation/types.ts | Tipos: ValidationType, ValidationResult, etc. |
| apps/api/src/modules/workflow-validation/validators.ts | Funciones de validación por plataforma |
| apps/api/src/modules/workflow-validation/artifact-checks.ts | runValidation, canLearnWorkflow |
| apps/api/src/modules/workflow-validation/service.ts | validateWorkflowStep, shouldLearnWorkflow |
| apps/api/src/modules/workflow-validation/index.ts | Exports |

### Archivos modificados

| Archivo | Cambios |
|---------|---------|
| apps/api/src/modules/composite-tasks/types.ts | +validation fields en CompositeTaskStep, +validation_failed status |
| apps/api/src/modules/composite-tasks/executor.ts | +validación después de cada step, +learning con validación |
| apps/api/src/modules/orchestrator/trace.ts | +validation stages y status |

### Flujo ejemplo con validación

```
Input: "descargar VLC e instalarlo"

1. executeCompositePlan()

2. Step 1: download_file:vlc
   - Ejecutar: success
   - Validar (validationType: 'file_downloaded')
   - validateDownloadedFile('VLC-*.exe', { downloadPath: Downloads })
   - ✅ ok=true, evidence=['VLC-3.0.20-win64.exe (42MB)']

3. Step 2: install_app:vlc
   - Ejecutar: success
   - Validar (validationType: 'app_installed')
   - validateInstalledApplication('VLC', { platform: 'win32' })
   - ✅ ok=true, evidence=['C:\\Program Files\\VideoLAN\\VLC\\vlc.exe']

4. Learning check:
   - validatedSteps: 2
   - validationFailedSteps: 0
   - shouldLearnWorkflow() → true
   - ✅ saveCompositeTask()

5. Result:
   - success: true
   - executionStatus: 'completed'
   - validatedSteps: ['step-1', 'step-2']
   - learnedAsComposite: true
```

### Ejemplo de validación fallida

```
Input: "instalar notepad++"

1. Step 1: download_file:notepad++
   - Ejecutar: success (OpenClaw dice que sí)
   - Validar: validateDownloadedFile('notepad++*.exe')
   - ❌ ok=false, reason='No se encontró archivo'

2. Si validationCritical=true:
   - step.status = 'validation_failed'
   - executionStatus = 'validation_failed'
   - learnedAsComposite: false
   - learnRejectedReason: 'Validaciones fallidas: download_file:notepad++'
```

### Verificaciones

- ✅ npm run check sin errores
- ✅ npm run build exitoso
- ✅ Validators detectan plataforma y ejecutan comandos apropiados
- ✅ Executor valida después de cada step
- ✅ Learning rechazado si validación falla
- ✅ Trace incluye stages de validación
- ✅ API completa para gestión

---

## FEATURE 131: DAG Execution Engine & Parallel Tasks

**Fecha:** 2026-05-06
**Dependencia:** FEATURE 130.2 (Composite Tasks), FEATURE 130.3 (Validated Workflows)

### Problema

El sistema ejecutaba workflows secuencialmente:
- No entendía dependencias reales entre pasos
- No paralelizaba pasos independientes
- No optimizaba recursos
- No tenía scheduler inteligente
- No modelaba grafos de ejecución

Ejemplo: "descargar VLC y CCleaner" podían ejecutarse en paralelo pero se hacían secuencialmente.

### Solución implementada

#### Arquitectura DAG Execution

```
apps/api/src/modules/dag-execution/
├── types.ts              # WorkflowNode, ExecutionGraph, SchedulerConfig
├── dependency-resolver.ts # Análisis de dependencias, ciclos, critical path
├── graph-builder.ts      # Construir DAG desde composite plan
├── artifact-locks.ts     # Gestión de locks para artefactos
├── resource-manager.ts   # Control de slots de recursos
├── scheduler.ts          # DAGScheduler con prioridades
├── executor.ts           # Ejecución paralela del DAG
└── index.ts              # Exports
```

#### Modelo de nodo (WorkflowNode)

```typescript
interface WorkflowNode {
  id: string
  actionType: TaskActionType
  targetEntity?: string
  provider: 'local' | 'openclaw' | 'task_memory' | 'capability'
  dependencies: string[]
  dependencyType: 'hard' | 'soft'
  parallelizable: boolean
  priority: number
  estimatedDurationMs: number
  estimatedTokenCost: number
  validationRequired: boolean
  retryPolicy: RetryPolicy
  resourceRequirements: ResourceRequirements
  status: NodeStatus
}
```

#### Modelo de grafo (ExecutionGraph)

```typescript
interface ExecutionGraph {
  id: string
  nodes: Map<string, WorkflowNode>
  edges: WorkflowEdge[]
  rootNodes: string[]
  leafNodes: string[]
  metadata: GraphMetadata
  status: GraphStatus
}

interface GraphMetadata {
  totalNodes: number
  maxDepth: number
  estimatedDurationMs: number           // Sequential
  estimatedDurationParallelMs: number   // Parallel
  parallelizableGroups: ParallelGroup[]
  criticalPath: string[]
}
```

#### Dependency Resolver

```typescript
// Reglas de dependencias automáticas
const ACTION_DEPENDENCIES = {
  'install_app': ['download_file'],
  'open_app': ['install_app'],
  'configure_setting': ['install_app'],
  'edit_file': ['download_file', 'create_file']
}

// Funciones principales
analyzeDependencies(nodeId, graph)
computeCriticalPath(graph)
detectCycles(graph)
topologicalSort(graph)
getReadyNodes(graph, completed, running, failed)
findParallelGroups(graph)
canRunInParallel(nodeA, nodeB, graph)
```

#### Resource Manager

```typescript
const DEFAULT_RESOURCE_LIMITS = {
  maxParallelLocal: 3,
  maxParallelOpenClaw: 2,
  maxConcurrentDownloads: 2,
  maxConcurrentInstalls: 1,
  maxConcurrentProcesses: 5,
  globalConcurrencyLimit: 6
}

class ResourceManager {
  hasAvailableSlots(node): boolean
  tryAcquire(node): boolean
  release(node): void
  getUtilization(): { byType, overall }
}
```

#### Artifact Locks

```typescript
class ArtifactLockManager {
  tryAcquire(artifactId, nodeId, lockType): boolean
  acquire(artifactId, nodeId, lockType): Promise<void>
  release(artifactId, nodeId): void
  getAllLocks(): ArtifactLock[]
}

// Tipos de lock
type LockType = 'read' | 'write' | 'exclusive'

// Conflictos detectados automáticamente
analyzeConflicts(graph): ConflictAnalysis
```

#### Scheduler

```typescript
class DAGScheduler {
  getNextNodes(maxCount): string[]
  calculateScore(nodeId): number  // Prioridad
  markRunning(nodeId): void
  markCompleted(nodeId, validated): void
  markFailed(nodeId, error): void
  isComplete(): boolean
  getStats(): { total, completed, failed, running, queued, progress }
}
```

#### Executor

```typescript
async function executeGraph(input): Promise<ExecuteGraphResult> {
  // 1. Crear scheduler y resource manager
  const { scheduler, resourceManager, lockManager } = createScheduler(graph)

  // 2. Loop principal
  while (!scheduler.isComplete()) {
    const nextNodes = scheduler.getNextNodes()

    // 3. Ejecutar nodos en paralelo
    await Promise.all(nextNodes.map(async nodeId => {
      // Acquire resources
      // Acquire locks
      // Execute with retry
      // Validate if required
      // Release locks
      // Mark complete/failed
    }))
  }

  // 4. Calcular métricas
  return {
    completedNodes, failedNodes, blockedNodes,
    timeSavedMs,  // Tiempo ahorrado por paralelismo
    tokensSaved   // Tokens ahorrados
  }
}
```

#### Trace stages para DAG

```typescript
// Nuevos stages
stage: '...'
  | 'dag-build'        // DAG construido
  | 'dag-schedule'     // Nodo programado
  | 'dag-node-start'   // Nodo iniciado
  | 'dag-node-complete'// Nodo completado
  | 'dag-node-failed'  // Nodo fallido
  | 'dag-complete'     // DAG completado

// Nuevos métodos en ExecutionTraceBuilder
dagBuild(graphId, totalNodes, parallelGroups)
dagSchedule(nodeId, queueSize)
dagNodeStart(nodeId, description)
dagNodeComplete(nodeId, description)
dagNodeFailed(nodeId, error)
dagComplete(graphId, completed, total, timeSavedMs)
```

### Archivos creados

| Archivo | Descripción |
|---------|-------------|
| dag-execution/types.ts | WorkflowNode, ExecutionGraph, SchedulerConfig, etc. |
| dag-execution/dependency-resolver.ts | Análisis de dependencias y ciclos |
| dag-execution/graph-builder.ts | buildExecutionGraph, rebuildGraph |
| dag-execution/artifact-locks.ts | ArtifactLockManager |
| dag-execution/resource-manager.ts | ResourceManager |
| dag-execution/scheduler.ts | DAGScheduler, createScheduler |
| dag-execution/executor.ts | executeGraph, retryNode, continueExecution |
| dag-execution/index.ts | Exports públicos |

### Archivos modificados

| Archivo | Cambios |
|---------|---------|
| orchestrator/trace.ts | +DAG stages, +DAG tracking en DebugSnapshot |

### Flujo ejemplo

```
Input: "descargar VLC y CCleaner e instalarlos"

1. buildExecutionGraph():
   Node A: download_file:vlc (root, parallelizable)
   Node B: download_file:ccleaner (root, parallelizable)
   Node C: install_app:vlc (depends on A)
   Node D: install_app:ccleaner (depends on B)

2. Grafo resultante:
   download VLC ─┐
                 ├→ install VLC
   download CC ──┘
                 └→ install CC

3. executeGraph():
   Tick 1: Start A + B (parallel downloads)
   Tick 2: A completes → Start C
   Tick 3: B completes → Start D (but install limit=1, D queued)
   Tick 4: C completes → Start D
   Tick 5: D completes → Done

4. Resultado:
   - timeSavedMs: ~30000 (downloads en paralelo)
   - parallelDurationMs: 150000
   - sequentialDurationMs: 180000
```

### Verificaciones

- ✅ npm run check sin errores
- ✅ npm run build exitoso
- ✅ Graph builder detecta dependencias automáticamente
- ✅ Scheduler respeta límites de recursos
- ✅ Artifact locks previenen conflictos
- ✅ Retry granular por nodo
- ✅ Integración con validation (130.3)
- ✅ Trace incluye stages de DAG

---

## FIX 131.1 — Wire DAG Engine into Composite Execution + Minimal DAG UI

**Fecha:** 2026-05-06

### Descripción

Conecta el DAG Execution Engine (FEATURE 131) al flujo real de producto:
- `/composite-tasks/execute` ahora usa DAG cuando aplica
- Endpoints `/dag/*` para gestión directa
- UI WorkflowGraphViewer para visualización
- Persistencia de ejecuciones DAG
- Legacy executeCompositePlan como fallback

### Archivos creados

| Archivo | Descripción |
|---------|-------------|
| dag-execution/dag-helper.ts | shouldUseDagExecution, dagResultToResponse, config |
| dag-execution/persistence.ts | GraphExecutionState, saveGraphExecution |
| dag-execution/routes.ts | Endpoints /dag/* |
| web/components/control/WorkflowGraphViewer.tsx | UI de visualización DAG |

### Archivos modificados

| Archivo | Cambios |
|---------|---------|
| composite-tasks/routes.ts | Integración con DAG (buildExecutionGraph, executeGraph) |
| api/src/index.ts | Registro de rutas /dag/* |
| dag-execution/index.ts | Exports de dag-helper y persistence |

### Criterio para usar DAG

```typescript
function shouldUseDagExecution(plan): boolean {
  // Retorna true si:
  // - plan.steps.length > 1
  // - hay steps independientes (parallelizable)
  // - hay validationRequired
  // - hay dependencies complejas
  // - config.enableDagExecution === true
}
```

### Endpoints DAG registrados

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /dag/executions | Lista ejecuciones recientes |
| GET | /dag/executions/:id | Detalle de ejecución |
| GET | /dag/config | Configuración DAG actual |
| POST | /dag/config | Actualizar configuración |
| POST | /dag/execute | Ejecutar DAG directo |
| POST | /dag/executions/:id/retry-node | Reintentar nodo fallido |
| POST | /dag/executions/:id/cancel | Cancelar ejecución |
| DELETE | /dag/executions/:id | Eliminar registro |
| POST | /dag/clear | Limpiar historial |

### Respuesta compatible

```typescript
interface DAGExecutionResponse {
  // Campos legacy (compatibilidad)
  planId, success, completedSteps, failedStep, ...

  // Campos DAG nuevos
  executionMode: 'dag' | 'legacy'
  graphId?: string
  graphExecution?: ExecuteGraphResult
  graphSummary?: {
    totalNodes, completedNodes, failedNodes,
    parallelGroups, timeSavedMs, tokenSavingEstimate
  }
}
```

### WorkflowGraphViewer

- Vista de nodos con estado visual (colores, iconos)
- Dependencias como texto
- Progress bar global
- Resumen: completados, fallidos, tiempo ahorrado
- Acciones: reintentar, saltar (si aplica)
- Toggle JSON para datos avanzados

### Persistencia DAG

```typescript
interface GraphExecutionState {
  id: string
  graphId: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'partial' | 'cancelled'
  nodes: Record<string, { status, startedAt, error, retries }>
  events: GraphExecutionEvent[]
  summary?: GraphSummary
}

// Persistido en data/dag-executions.json
// Máximo 100 ejecuciones
```

### Verificaciones

- ✅ /composite-tasks/execute usa DAG cuando aplica
- ✅ Fallback a legacy si DAG build falla
- ✅ Endpoints /dag/* registrados
- ✅ WorkflowGraphViewer creado
- ✅ npm run check sin errores
- ✅ npm run build exitoso

---

## PHASE H1 — Runtime Hardening & Platform Stabilization

**Fecha:** 2026-05-06

### Descripción

Fase de endurecimiento del runtime para garantizar estabilidad y resiliencia en producción. Incluye cola durable, reintentos inteligentes, observabilidad, y recuperación de crashes.

### Módulos Creados

#### 1. Runtime Queue (`modules/runtime-queue/`)

Cola de ejecución durable con prioridades y gestión de ciclo de vida.

| Archivo | Descripción |
|---------|-------------|
| `types.ts` | Tipos: QueuedJob, JobStatus, JobPriority, RetryPolicy, etc. |
| `queue.ts` | Cola en memoria con eventos, filtros, estadísticas |
| `retry-engine.ts` | Clasificación de errores, backoff exponencial, políticas |
| `scheduler.ts` | Polling, ejecución paralela, manejo de timeout |
| `persistence.ts` | Persistencia atómica, dead letter, recuperación |
| `dead-letter.ts` | Gestión de DLQ, requeue, análisis |
| `startup-recovery.ts` | Recuperación de jobs huérfanos al iniciar |
| `routes.ts` | Endpoints REST para gestión de cola |
| `index.ts` | Exports del módulo |

#### 2. Observability (`modules/observability/`)

Bus de eventos y logging estructurado.

| Archivo | Descripción |
|---------|-------------|
| `events.ts` | EventBus, tipos de eventos, suscripciones, historial |
| `logger.ts` | Logger estructurado con contexto, niveles, timers |
| `index.ts` | Exports del módulo |

#### 3. Shared Utilities (`shared/`)

| Archivo | Descripción |
|---------|-------------|
| `atomic-persistence.ts` | Escritura atómica, backups, recuperación |
| `hard-limits.ts` | Límites de seguridad globales |

### Mejoras a Módulos Existentes

#### Resource Manager (`dag-execution/resource-manager.ts`)

- Slots con timeout/expiración
- Heartbeat para detectar stale
- Escalado adaptativo (auto-scale up/down)
- Eventos de recurso
- Health monitoring

#### Artifact Locks (`dag-execution/artifact-locks.ts`)

- Locks con expiración automática
- Detección de deadlocks
- Heartbeat para prevenir stale
- Eventos de lock
- Cleanup automático

### Componentes UI

#### QueueDashboard (`web/components/control/QueueDashboard.tsx`)

- Vista general con estadísticas
- Lista de jobs con filtros
- Tab de salud con issues/recomendaciones
- Controles pause/resume
- Dead letter viewer

### Endpoints Queue API

| Método | Ruta | Handler |
|--------|------|---------|
| GET | /queue/stats | Estadísticas de cola |
| GET | /queue/jobs | Listar jobs con filtros |
| GET | /queue/jobs/:id | Detalle de job |
| POST | /queue/jobs/:id/cancel | Cancelar job |
| POST | /queue/pause | Pausar scheduler |
| POST | /queue/resume | Reanudar scheduler |
| GET | /queue/dead-letter | Listar DLQ |
| POST | /queue/dead-letter/:id/requeue | Reencolar de DLQ |
| DELETE | /queue/dead-letter/:id | Eliminar de DLQ |
| POST | /queue/dead-letter/clear | Limpiar DLQ |
| GET | /queue/events | Historial de eventos |
| GET | /queue/events/:correlationId | Timeline por correlación |
| GET | /queue/health | Health check |

### Tipos Principales

```typescript
// Job en cola
interface QueuedJob<T = unknown> {
  id: string
  type: string
  payload: T
  context: JobContext
  status: JobStatus
  priority: JobPriority
  retryPolicy?: Partial<RetryPolicy>
  retryCount: number
  nextRetryAt?: string
  lastError?: JobError
  errorHistory: JobError[]
  createdAt: string
  deadlineAt?: string
  progress?: number
}

// Categorías de error para retry
type ErrorCategory =
  | 'transient'    // Reintentar
  | 'resource'     // Backoff y reintentar
  | 'validation'   // No reintentar
  | 'auth'         // No reintentar
  | 'dependency'   // Puede reintentar
  | 'internal'     // Puede reintentar
  | 'unknown'      // Conservador

// Evento runtime
interface RuntimeEvent {
  id: string
  category: EventCategory
  type: string
  severity: EventSeverity
  timestamp: string
  source: string
  message: string
  correlationId?: string
  entityId?: string
  data?: Record<string, unknown>
}

// Hard limits
interface HardLimits {
  maxQueuedJobs: number
  maxConcurrentJobs: number
  maxRetryAttempts: number
  maxDagNodes: number
  maxLockHoldTimeMs: number
  // ... más límites
}
```

### Flujo de Recuperación al Iniciar

```
Startup
  │
  ├─ loadQueueState() → Cargar jobs persistidos
  │
  ├─ findOrphanedJobs() → Jobs running/scheduled sin proceso
  │
  ├─ performStartupRecovery()
  │   │
  │   ├─ Jobs running → reset a pending
  │   ├─ Jobs scheduled → reset a pending
  │   ├─ Jobs con deadline expirado → dead letter
  │   └─ Jobs retrying stale → reset a pending
  │
  ├─ startScheduler() → Comenzar polling
  │
  └─ startPeriodicPersistence() → Guardar cada 5s
```

### Verificaciones

- ✅ Runtime queue module completo
- ✅ Retry engine con clasificación de errores
- ✅ Resource manager con adaptación y health
- ✅ Artifact locks con expiración y deadlock detection
- ✅ Observability module (events + logger)
- ✅ Atomic persistence helper
- ✅ Startup recovery
- ✅ Hard limits config
- ✅ Queue dashboard UI
- ✅ npm run check sin errores
- ✅ npm run build exitoso

---

## P1.1 — Foundation Audit

**Fecha**: 2026-05-07
**Estado**: FASE 0 COMPLETADA

### 0.1 Verificación Técnica

- ✅ `npm run check` - Sin errores TypeScript
- ✅ `npm run build:web` - Build exitoso

### 0.2 Auditoría de Rutas Críticas

**Hallazgo y corrección**: Las rutas `/queue/*` del módulo `runtime-queue/routes.ts` NO estaban registradas en `index.ts`.

**Correcciones aplicadas**:
1. Añadidos imports de handlers de queue en `index.ts`
2. Registradas rutas GET: `/queue/stats`, `/queue/jobs`, `/queue/dead-letter`, `/queue/events`, `/queue/health`
3. Registradas rutas POST: `/queue/pause`, `/queue/resume`, `/queue/dead-letter/clear`
4. Añadidas rutas dinámicas GET: `/queue/jobs/:id`, `/queue/events/:correlationId`
5. Añadidas rutas dinámicas POST: `/queue/jobs/:id/cancel`, `/queue/dead-letter/:id/requeue`
6. Añadidas rutas dinámicas DELETE: `/queue/dead-letter/:id`

**Rutas verificadas**:
| Ruta | Estado |
|------|--------|
| `/health` | ✅ Registrada |
| `/auth/*` | ✅ Registradas |
| `/control/*` | ✅ Registradas (via orchestrator, tasks, capabilities) |
| `/queue/*` | ✅ CORREGIDAS - ahora registradas |
| `/repair/*` | ✅ Registradas |
| `/dag/*` | ✅ Registradas |
| `/composite/*` | ✅ Registradas |

### 0.3 Verificación de Flujo de Módulos

**Conexiones verificadas**:
- ✅ `orchestrator` → `task-memory-integration` (checkTaskMemory, learnFromExecution)
- ✅ `composite-tasks` → `dag-execution` (imports y usa executor)
- ✅ `dag-execution` → `orchestrator/service` (runSimpleAgentTask)
- ✅ `tasks` → `orchestrator/service` (runSimpleAgentTask)

**Hallazgo**: `runtime-queue` NO está integrado en el flujo de `orchestrator`.
- El módulo está completo (queue, scheduler, persistence, recovery)
- Las rutas ahora están registradas
- PERO el orchestrator no encola jobs - ejecución sigue siendo síncrona
- **Estado**: Infraestructura lista para integración futura

### 0.4 Auditoría de UI Crítica

| Página | Estado | Notas |
|--------|--------|-------|
| `/control/setup` | ✅ Robusto | FIX 125.1: normalizeRequirement, normalizeRepairSession, safe helpers |
| `/control/settings` | ✅ Robusto | Manejo de policy null/undefined |
| `/control` (Dashboard) | ✅ Robusto | Loading state, null checks para hubResponse y lastAction |
| `/tasks` | ✅ Robusto | Error handling, empty state |

### 0.5 Auditoría de Persistencia Atómica

**Hallazgo**: Existe `shared/atomic-persistence.ts` pero no está universalmente adoptada.

| Módulo | Usa Atomic | Archivo |
|--------|-----------|---------|
| `runtime-queue/persistence.ts` | ✅ Sí | atomicWrite local |
| `composite-tasks/service.ts` | ❌ No | writeFileSync directo |
| `dag-execution/persistence.ts` | ❌ No | writeFileSync directo |
| `system-state/service.ts` | ❌ No | writeFileSync directo |
| `task-memory/service.ts` | ❌ No | writeFileSync directo |
| `openclaw-repair/service.ts` | ❌ No | writeFileSync directo |
| `storage/file-db.ts` | ❌ No | writeFileSync directo |

**Estado**: Infraestructura lista, adopción pendiente (riesgo bajo - datos no críticos para corrupción)

### 0.6 Resumen Foundation Audit

| Check | Estado | Acción |
|-------|--------|--------|
| Build/Check | ✅ PASS | - |
| Rutas críticas | ✅ CORREGIDO | /queue/* registradas |
| Flujo módulos | ⚠️ INFO | runtime-queue no integrado (intencional - fase futura) |
| UI crítica | ✅ PASS | Sin crashes potenciales |
| Persistencia atómica | ⚠️ INFO | Helper existe, adopción parcial |

**FASE 0 RESULTADO**: ✅ APTO PARA CONTINUAR A FASES 1-8

### Próximos pasos (FASES 1-8 Product Shell)

1. **FASE 1**: Dashboard Shell - Vista general unificada
2. **FASE 2**: Task Admin Shell - Gestión de tareas/capabilities
3. **FASE 3**: Notifications Shell - Sistema de alertas
4. **FASE 4**: Channels Shell - Configuración de canales
5. **FASE 5**: Credentials Shell - Gestión de credenciales
6. **FASE 6**: Settings Shell - Configuración global
7. **FASE 7**: UX Shell - Navegación y layout
8. **FASE 8**: Verification - Verificación final

---

## H1.1 — Runtime Integration Finalization

**Fecha**: 2026-05-07
**Estado**: COMPLETADO

### Objetivo

Consolidar el runtime antes de Product Shell:
- Queue-first execution para workflows largos
- Persistencia atómica completa
- Endpoint unificado /runtime/state

### Cambios Principales

#### 1. Execution Integration (`execution-integration.ts`)

```typescript
// Decide si encolar o ejecutar directo
shouldEnqueueExecution(criteria: ExecutionCriteria)

// Helpers para encolar
enqueueDagExecution(payload, context, options)
enqueueCompositeTask(payload, context, options)
enqueueSimpleTask(payload, options)

// Handlers registrados
initializeExecutionHandlers() // dag-execution, composite-task, simple-task
```

#### 2. Atomic Persistence

Migrados a `atomicWriteJson()`:
- system-state/service.ts
- task-memory/service.ts
- composite-tasks/service.ts
- dag-execution/persistence.ts
- openclaw-repair/service.ts

#### 3. Runtime State Endpoint

```
GET /runtime/state
GET /runtime/health
```

Devuelve:
- queueStats (jobs, wait time, success rate)
- scheduler (running, paused, handlers)
- activeWorkflows (DAG executions)
- deadLetters (count, by type)
- queuePressure (pending%, running%, status)
- resourceHealth (limits, issues)
- openclawHealth

#### 4. DAG Execute con Queue

`POST /dag/execute` ahora soporta:
- `async: true` → encola y retorna jobId
- `forceQueue: true` → fuerza encolado

### Verificaciones

- ✅ npm run check sin errores
- ✅ npm run build exitoso
- ✅ Rutas /queue/* registradas
- ✅ Rutas /runtime/* registradas
- ✅ Persistencia atómica migrada
- ✅ Event emission (32 puntos)
- ✅ Resource manager (28 puntos de uso)

### Reporte Completo

Ver: `docs/reports/claude/H1_1_runtime_integration_finalization_report.md`

---

## H1.2 — Enforce Queue-First Runtime & Handler Initialization

**Fecha**: 2026-05-07
**Estado**: COMPLETADO

### Objetivo

Hacer que queue-first sea realmente la autoridad para ejecuciones largas:
- Inicializar handlers en startup
- Queue-first por defecto (no opcional)
- Estado 'queued' para UI
- Atomic persistence en file-db
- handlersReady en runtime state

### Cambios Principales

#### 1. Handler Initialization en Startup

```typescript
// index.ts
const queueInit = initializeRuntimeQueue({ initExecutionHandlers: true })
console.log(`[RuntimeQueue] Registered handlers: ${getRegisteredHandlers().join(', ')}`)
```

#### 2. Queue-First por Defecto

DAG y Composite ahora encolan por defecto:
- `forceDirect: false` → encola (por defecto)
- `forceDirect: true` → ejecución directa (bypass explícito)

```typescript
// POST /dag/execute y /composite-tasks/execute
if (queueDecision.shouldQueue && !forceDirect) {
  // Enqueue - default path
}
```

#### 3. Estado 'queued' para UI

```typescript
export type ExecutionStatus = 'queued' | ...
export type FinalUiStatus = 'queued' | ...

// status-resolver.ts
queued: { title: 'EN COLA', defaultMessage: '...' }
```

#### 4. handlersReady en Runtime State

```typescript
// GET /runtime/state
scheduler: {
  handlersReady: handlers.includes('dag-execution') && handlers.includes('composite-task'),
  registeredHandlers: ['dag-execution', 'composite-task', 'simple-task']
}
```

#### 5. Atomic Persistence en file-db

```typescript
// storage/file-db.ts
import { atomicWriteJson, atomicReadJsonOrDefault } from '../shared/atomic-persistence'
```

### Auditoría de Verificación

| Check | Resultado |
|-------|-----------|
| initializeRuntimeQueue en startup | ✅ index.ts:576 |
| executeGraph/executeCompositePlan directos | ✅ Solo fallbacks o forceDirect |
| writeFileSync fuera de atomic | ✅ Solo sandbox (user content) |

### Archivos Modificados

- `apps/api/src/index.ts` - Inicialización runtime queue
- `apps/api/src/modules/dag-execution/routes.ts` - Queue-first por defecto
- `apps/api/src/modules/composite-tasks/routes.ts` - Queue-first composite
- `apps/api/src/modules/execution-status/types.ts` - Estado 'queued'
- `apps/api/src/modules/execution-status/status-resolver.ts` - Label/severity
- `apps/api/src/modules/runtime-queue/runtime-routes.ts` - handlersReady
- `apps/api/src/storage/file-db.ts` - Atomic persistence

### Reporte Completo

Ver: `docs/reports/claude/H1_2_queue_first_enforcement_report.md`

---

## P1.2 — Realtime Product Shell & WS Runtime

**Fecha**: 2026-05-07

### Objetivo

Implementar WebSocket como canal principal para runtime/events/progress, con REST como fallback/snapshot.

### Reglas Implementadas

1. ✅ WebSocket es canal principal para runtime/events/progreso
2. ✅ REST queda como fallback/snapshot
3. ✅ NO polling agresivo como fuente principal
4. ✅ NO romper endpoints REST existentes
5. ✅ NO modificar OpenClaw core

### Componentes Implementados

#### Backend (apps/api/src/modules/runtime-ws/)

| Archivo | Descripción |
|---------|-------------|
| `types.ts` | Tipos WS: WsChannel, RuntimeEventType, WsFrame, WsClientInfo |
| `gateway.ts` | RuntimeWsGateway con heartbeat, stats, tenant isolation |
| `subscriptions.ts` | SubscriptionManager con rate limiting y health tracking |
| `auth.ts` | Autenticación WS (token query/header/cookie) |
| `serializer.ts` | Serialización de frames WS |
| `event-bridge.ts` | Bridge EventBus → WS Gateway |

#### Frontend (apps/web/src/)

| Archivo | Descripción |
|---------|-------------|
| `services/runtime-ws.ts` | RuntimeWsClient con reconnection y heartbeat |
| `hooks/useRuntimeWs.ts` | Hooks React para WS (useRuntimeWs, useWorkflowEvents, etc.) |
| `components/control/WorkflowGraphViewer.tsx` | LiveWorkflowGraphViewer con updates live |
| `components/control/NotificationPanel.tsx` | Notificaciones y aprobaciones live |
| `pages/control/Dashboard.tsx` | Dashboard con queue stats live |
| `pages/control/Historial.tsx` | Historial con auto-refresh live |

### Canales WebSocket

| Canal | Propósito |
|-------|-----------|
| `/ws/runtime` | Eventos de sistema general |
| `/ws/queue` | Estado de cola y jobs |
| `/ws/workflow` | Eventos específicos de workflow |
| `/ws/notifications` | Notificaciones y aprobaciones |
| `/ws/debug` | Debug trace (deshabilitado por defecto) |

### Eventos Soportados

```typescript
type RuntimeEventType =
  // Workflow
  | 'workflow:created' | 'workflow:start' | 'workflow:progress'
  | 'workflow:complete' | 'workflow:failed' | 'workflow:cancelled'
  // Node
  | 'node:start' | 'node:progress' | 'node:complete'
  | 'node:failed' | 'node:retry' | 'node:skipped'
  // Queue
  | 'queue:job-enqueued' | 'queue:job-started' | 'queue:job-progress'
  | 'queue:job-completed' | 'queue:job-failed' | 'queue:pressure-change'
  // Approvals & Notifications
  | 'approval:required' | 'approval:granted' | 'approval:denied'
  | 'notification:created' | 'notification:updated'
  // System
  | 'system:health-change'
```

### Seguridad y Resiliencia

- ✅ Autenticación por token (query param, header, cookie)
- ✅ Tenant isolation estricta
- ✅ Rate limiting por cliente (30 subscriptions/min)
- ✅ Heartbeat con timeout (60s)
- ✅ Reconnection con exponential backoff
- ✅ Connection health tracking (healthy/degraded/stale)
- ✅ Stats por minuto (mensajes enviados/recibidos, errores)

### Integración con Runtime State

WebSocket stats incluidos en `/runtime/state`:
- activeConnections
- connectionsByTenant
- totalSubscriptions
- subscriptionsByChannel
- messagesSentLastMinute
- messagesReceivedLastMinute
- errorsLastMinute
- connectionHealth

### Verificación

```bash
npm run check   # ✅ Sin errores TS
npm run build   # ✅ Build exitoso
```

### Archivos Modificados

- `apps/api/src/index.ts` - Inicialización WS Gateway + Event Bridge
- `apps/api/src/modules/runtime-queue/runtime-routes.ts` - WS stats en /runtime/state
- `apps/web/src/components/control/GlobalHeader.tsx` - NotificationBell integrado

---

## P2 — Product Experience Layer & Task Operating System

**Fecha:** 2026-05-07

### Objetivo

Transformar GranClaw de panel técnico a "sistema operativo agente" usable por humanos y empresas. Crear una experiencia de producto completa con navegación, dashboard, tareas, automatizaciones, canales y configuración.

### Reglas Implementadas

1. ✅ NO romper runtime existente
2. ✅ NO duplicar estados ya existentes
3. ✅ Runtime queue/DAG siguen siendo autoridad
4. ✅ WebSocket sigue siendo canal principal
5. ✅ REST solo fallback/snapshot
6. ✅ UX simple para usuario final
7. ✅ Mantener compatibilidad con /control técnico

### Componentes Implementados

#### App Shell (apps/web/src/layouts/)

| Archivo | Descripción |
|---------|-------------|
| `AppShell.tsx` | Layout principal con sidebar y content area |
| `Sidebar.tsx` | Navegación lateral con items dinámicos |
| `Topbar.tsx` | Barra superior con notificaciones y usuario |
| `index.ts` | Exports del módulo |

#### Product Pages (apps/web/src/pages/product/)

| Archivo | Ruta | Descripción |
|---------|------|-------------|
| `ProductDashboard.tsx` | `/dashboard` | Dashboard principal con runtime health, tareas activas, quick actions |
| `TasksPage.tsx` | `/tasks` | Task Operating System con vistas list/timeline/grouped |
| `AutomationsPage.tsx` | `/automations` | Gestión de automatizaciones periódicas/event/conditional |
| `ChannelsPage.tsx` | `/channels` | Canales de comunicación (email, ftp, browser, filesystem) |
| `CredentialsPage.tsx` | `/credentials` | Vault de credenciales sin mostrar secrets |
| `ApprovalsPage.tsx` | `/approvals` | Centro de aprobaciones con eventos live |
| `NotificationsPage.tsx` | `/notifications` | Centro de notificaciones live |
| `RuntimePage.tsx` | `/runtime` | Monitor avanzado de runtime (queue, workers, DAG, WS) |
| `SettingsPage.tsx` | `/settings` | Configuración de usuario y sistema |
| `index.ts` | - | Exports de todas las páginas |

### Rutas Producto (P2)

| Ruta | Página | Descripción |
|------|--------|-------------|
| `/dashboard` | ProductDashboard | Vista general del agente |
| `/tasks` | TasksPage | Tareas del usuario |
| `/automations` | AutomationsPage | Automatizaciones |
| `/channels` | ChannelsPage | Canales conectados |
| `/credentials` | CredentialsPage | Credenciales seguras |
| `/approvals` | ApprovalsPage | Aprobaciones pendientes |
| `/notifications` | NotificationsPage | Centro de notificaciones |
| `/runtime` | RuntimePage | Monitor runtime (devops) |
| `/settings` | SettingsPage | Configuración |
| `/control/*` | Control pages | Panel técnico (preservado) |

### Características UX

- **AppShell:** Sidebar colapsable, navegación visual, indicador de conexión WS
- **Dashboard:** Runtime health, tareas activas, quick actions, live updates
- **Tasks:** Vistas múltiples (list, timeline, grouped), filtros por estado, retry actions
- **Automations:** Tipos periodic/event/conditional, toggle enable/disable
- **Channels:** Estado de conexión, acciones test/configure
- **Credentials:** Vault seguro sin revelar secrets, scopes, expiración
- **Approvals:** Eventos live via WebSocket, approve/deny actions
- **Notifications:** Filtro read/unread, mark all as read
- **Runtime:** Métricas avanzadas (queue pressure, workers, DAG, WS health)
- **Settings:** Notificaciones, ejecución, visualización

### Integración WebSocket

Todas las páginas de producto utilizan los hooks de P1.2:
- `useRuntimeWs()` - Estado de conexión
- `useQueueEvents()` - Eventos de cola
- `useApprovalEvents()` - Eventos de aprobación
- `useNotificationEvents()` - Notificaciones

### App.tsx Actualizado

- Agregadas rutas de producto (`/dashboard`, `/tasks`, etc.)
- Función `isAppShellRoute()` para detectar rutas P2
- AppShell wrapper para páginas de producto
- ProductHeader preservado para `/control/*`
- DevHeader preservado para `/dev/*`

### Verificación

```bash
npm run check   # ✅ Sin errores TS
npm run build   # ✅ Build exitoso
```

### Archivos Creados/Modificados

**Nuevos:**
- `apps/web/src/layouts/AppShell.tsx`
- `apps/web/src/layouts/Sidebar.tsx`
- `apps/web/src/layouts/Topbar.tsx`
- `apps/web/src/layouts/index.ts`
- `apps/web/src/pages/product/ProductDashboard.tsx`
- `apps/web/src/pages/product/TasksPage.tsx`
- `apps/web/src/pages/product/AutomationsPage.tsx`
- `apps/web/src/pages/product/ChannelsPage.tsx`
- `apps/web/src/pages/product/CredentialsPage.tsx`
- `apps/web/src/pages/product/ApprovalsPage.tsx`
- `apps/web/src/pages/product/NotificationsPage.tsx`
- `apps/web/src/pages/product/RuntimePage.tsx`
- `apps/web/src/pages/product/SettingsPage.tsx`
- `apps/web/src/pages/product/index.ts`

**Modificados:**
- `apps/web/src/App.tsx` - Integración AppShell y rutas P2


---

## P3 — Real Integrations & Operational Channels

**Fecha:** 2026-05-07
**Estado:** Completado
**Objetivo:** Conectar GranClaw al mundo real con canales operacionales

### Resumen

P3 implementa la infraestructura de canales operacionales que permite al agente interactuar con sistemas externos (email, FTP, WhatsApp, browser automation, calendar). Incluye arquitectura de runtime para canales, sistema de permisos/scopes, integración con credenciales vault, eventos WebSocket, y UI de gestión.

### Reglas Aplicadas

1. ✅ NO modificar OpenClaw core
2. ✅ NO romper runtime queue/DAG
3. ✅ Canales integran con runtime y workflows
4. ✅ WebSocket como realtime principal
5. ✅ REST como fallback
6. ✅ No hardcoded credentials
7. ✅ Todo a través de vault/permissions/scopes
8. ✅ npm run check + build exitosos

### Arquitectura de Canales

#### Módulo channels-runtime (apps/api/src/modules/channels-runtime/)

| Archivo | Descripción |
|---------|-------------|
| `types.ts` | Tipos base: ChannelType, ChannelStatus, ChannelConfig, ChannelEvent, ApprovalMode |
| `registry.ts` | Registro de providers con metadata (stability, scopes, capabilities) |
| `permissions.ts` | Sistema de scopes y validación de permisos por canal |
| `event-adapter.ts` | Puente eventos de canal -> runtime queue -> WebSocket |
| `runtime-integration.ts` | Integración con cola de runtime (enqueue, triggers) |
| `channel-manager.ts` | Gestión de instancias de canal (lifecycle, health checks) |
| `index.ts` | Exports e inicialización |

#### Tipos de Canal

| Tipo | Stability | Descripción |
|------|-----------|-------------|
| `email` | stable | IMAP/SMTP con clasificación automática |
| `ftp` | stable | FTP/SFTP para transferencia de archivos |
| `browser` | beta | Automatización web con Playwright |
| `whatsapp` | experimental | WhatsApp Business API |
| `calendar` | beta | Google/Outlook Calendar |
| `api` | stable | APIs REST/GraphQL |
| `filesystem` | stable | Acceso local a archivos |
| `webhook` | stable | Webhooks entrantes |

### Implementaciones de Canal (apps/api/src/modules/channels/)

| Módulo | Características |
|--------|-----------------|
| `email/index.ts` | Connect, send, fetch inbox, classify, reply |
| `ftp/index.ts` | Upload, download, list, sync directories |
| `browser/index.ts` | Navigate, click, fill, screenshot, execute script |
| `whatsapp/index.ts` | Send message, auto-reply modes (safe/approval/autonomous) |
| `calendar/index.ts` | List events, create, update, delete, search |
| `routes.ts` | HTTP handlers para API de canales |

### Sistema de Permisos

Scopes por canal definidos en `permissions.ts`:
- Email: `email.read`, `email.send`, `email.reply`, `email.classify`
- FTP: `ftp.read`, `ftp.write`, `ftp.delete`, `ftp.sync`
- Browser: `browser.navigate`, `browser.click`, `browser.fill`, `browser.script`
- WhatsApp: `whatsapp.read`, `whatsapp.send`, `whatsapp.reply`
- Calendar: `calendar.read`, `calendar.write`, `calendar.delete`

### Modos de Aprobación

| Modo | Descripción |
|------|-------------|
| `auto` | Sin aprobación, límites automáticos |
| `approval_required` | Requiere aprobación humana |
| `always_ask` | Siempre preguntar al usuario |
| `always_allow` | Permitir todo (usar con cuidado) |

### Seguridad WhatsApp

- **Auto-reply tracker:** Límite por hora (default 20)
- **Modos:** off, safe (solo templates), approval (requiere OK), autonomous
- **Rate limiting:** Prevención de spam por canal
- **Human escalation:** Cuando se detectan temas sensibles

### UI de Canales

| Página | Ruta | Descripción |
|--------|------|-------------|
| `WhatsAppPage.tsx` | `/channels/whatsapp` | Gestión WhatsApp: chats, reglas, settings |
| `EmailPage.tsx` | `/channels/email` | Inbox con clasificación, reglas, IMAP/SMTP config |
| `ChannelsPage.tsx` (actualizado) | `/channels` | Lista todos los canales con stability badges |

### Event Bus (apps/api/src/modules/event-bus/)

Sistema de eventos interno para comunicación entre módulos:
- Eventos soportados: `channel:event`, `credential:expired`, `workflow:trigger`, etc.
- Métodos: `on`, `once`, `off`, `emit`, `emitAsync`

### Integración Runtime

El `runtime-integration.ts` conecta eventos de canal con la cola:
- `createJobFromChannelEvent()` - Crea job de canal
- `enqueueChannelAction()` - Encola acción de canal
- Escucha eventos `workflow:trigger` para ejecutar workflows

### API Endpoints

| Método | Ruta | Handler |
|--------|------|---------|
| GET | `/api/channels/providers` | `handleGetProviders` |
| GET | `/api/channels` | `handleGetChannels` |
| GET | `/api/channels/stats` | `handleGetStats` |
| POST | `/api/channels` | `handleCreateChannel` |
| GET | `/api/channels/:id` | `handleGetChannelById` |
| POST | `/api/channels/:id/connect` | `handleConnectChannel` |
| POST | `/api/channels/:id/disconnect` | `handleDisconnectChannel` |
| GET | `/api/channels/:id/events` | `handleGetChannelEvents` |

### Verificación

```bash
npm run check   # ✅ Sin errores TS
npm run build   # ✅ Build exitoso
```

### Archivos Creados

**Nuevos:**
- `apps/api/src/modules/event-bus/index.ts`
- `apps/api/src/modules/channels-runtime/types.ts`
- `apps/api/src/modules/channels-runtime/registry.ts`
- `apps/api/src/modules/channels-runtime/permissions.ts`
- `apps/api/src/modules/channels-runtime/event-adapter.ts`
- `apps/api/src/modules/channels-runtime/runtime-integration.ts`
- `apps/api/src/modules/channels-runtime/channel-manager.ts`
- `apps/api/src/modules/channels-runtime/index.ts`
- `apps/api/src/modules/channels/email/index.ts`
- `apps/api/src/modules/channels/ftp/index.ts`
- `apps/api/src/modules/channels/browser/index.ts`
- `apps/api/src/modules/channels/whatsapp/index.ts`
- `apps/api/src/modules/channels/calendar/index.ts`
- `apps/api/src/modules/channels/index.ts`
- `apps/api/src/modules/channels/routes.ts`
- `apps/web/src/pages/product/WhatsAppPage.tsx`
- `apps/web/src/pages/product/EmailPage.tsx`

**Modificados:**
- `apps/api/src/shared/response.ts` - Agregado `created()`
- `apps/web/src/pages/product/ChannelsPage.tsx` - WhatsApp type, stability badges
- `apps/web/src/pages/product/index.ts` - Exports nuevas páginas
- `apps/web/src/App.tsx` - Rutas `/channels/whatsapp`, `/channels/email`

### Próximos Pasos (P4+)

- Implementar conexión real con APIs externas (Gmail, Outlook, WhatsApp Business)
- Agregar más canales (Slack, Teams, Telegram)
- Dashboard de métricas de canal
- Configuración avanzada de rate limiting
- Integración con sistema de auditoría

---

## P4.1R — OpenClaw-First Integrations & Productionization

**Fecha:** 2026-05-07
**Estrategia:** OpenClaw-first + GranClaw adapters/fallbacks

### Objetivo

Establecer estrategia correcta de integración:
1. OpenClaw capabilities son preferidas
2. GranClaw adapta/extiende donde OpenClaw existe
3. GranClaw provee donde OpenClaw no tiene soporte
4. Fallback strategy cuando OpenClaw falla

### Auditoría OpenClaw

**Tools Nativos:**
| Tool | Tipo | Estado |
|------|------|--------|
| http | tool | Implementado |
| echo | tool | Implementado |
| time | tool | Implementado |

**OS Tools (Capabilities):**
| Capability | Riesgo | Modo |
|------------|--------|------|
| open_calculator | Low | passthrough |
| open_web_browser | Low | passthrough |
| open_text_editor_os | Low | passthrough |
| open_file_explorer | Low | passthrough |
| open_terminal | Medium | strict |

**Hallazgo:** OpenClaw NO tiene MCPs nativos. Usa sistema propio de Capabilities + Approval.

### Channel Classification

**Channel Sources:**
```typescript
type ChannelSource =
  | 'openclaw_native'     // OpenClaw tool/MCP/capability
  | 'granclaw_adapter'    // GranClaw wraps OpenClaw
  | 'granclaw_provider'   // GranClaw implementa completo
  | 'fallback'            // Fallback cuando primario falla
  | 'experimental'        // Inestable/experimental
```

**Clasificación Final:**

| Canal | Source | OpenClaw Ref | Razón |
|-------|--------|--------------|-------|
| email | granclaw_provider | - | OpenClaw no tiene email tool |
| ftp | granclaw_provider | - | OpenClaw no tiene FTP tool |
| sftp | granclaw_provider | - | OpenClaw no tiene SFTP tool |
| browser | granclaw_provider | open_web_browser | OpenClaw solo lanza, GranClaw automatiza |
| whatsapp | granclaw_provider | - | OpenClaw no tiene WhatsApp tool |
| calendar | granclaw_provider | - | OpenClaw no tiene Calendar tool |
| api | granclaw_adapter | http | GranClaw adapta http con queue/validation |
| filesystem | granclaw_provider | open_file_explorer | OpenClaw solo lanza explorer |
| webhook | granclaw_adapter | http | GranClaw adapta http + incoming handling |

### Channel Discovery Layer

Nueva capa para resolver "¿Quién ejecuta esto?":

```
apps/api/src/modules/channel-discovery/
├── types.ts       # ChannelSource, DiscoveryResult, AdapterConfig
├── registry.ts    # OpenClaw capabilities, source mappings
├── discovery.ts   # discoverChannel, getRecommendedSource
├── adapters.ts    # API/Webhook adapters config
├── fallback.ts    # Fallback strategies per channel
└── index.ts       # Exports
```

### GranClaw Enhancements

Cuando GranClaw adapta o provee, añade:
- Queue (runtime-queue integration)
- Validation (workflow-validation)
- Retries (exponential backoff)
- Runtime Events (event-bus)
- WebSocket (real-time updates)
- Approvals (capability system)
- Metrics (messagesPerHour, errors, latency)
- Audit (audit module)
- Rate Limiting (per channel)
- Fallback (when primary fails)

### Fallback Strategy

| Canal | Fallback Action | Max Retries |
|-------|-----------------|-------------|
| api | queue_for_retry | 3 |
| webhook | queue_for_retry | 5 |
| email | queue_for_retry | 3 |
| whatsapp | escalate_human | 0 |
| browser | escalate_human | 1 |
| ftp/sftp | queue_for_retry | 3 |
| calendar | queue_for_retry | 3 |
| filesystem | require_setup | 0 |

### Archivos Creados

| Archivo | Descripción |
|---------|-------------|
| `channel-discovery/types.ts` | ChannelSource, DiscoveryResult, AdapterConfig |
| `channel-discovery/registry.ts` | OpenClaw capabilities, source mappings |
| `channel-discovery/discovery.ts` | discoverChannel, getRecommendedSource |
| `channel-discovery/adapters.ts` | API/Webhook adapter configs |
| `channel-discovery/fallback.ts` | Fallback strategies, executeFallback |
| `channel-discovery/index.ts` | Module exports |

### Verificaciones

- ✅ npm run check sin errores
- ✅ npm run build exitoso
- ✅ OpenClaw-first strategy aplicada
- ✅ No duplicación de canales/conectores
- ✅ Channel classification completa
- ✅ Fallback strategy definida

---

## P4.2 — OpenClaw Capability Mapping & Adapter Consolidation

**Fecha:** 2026-05-07
**Objetivo:** Corregir deriva arquitectónica, confirmar clasificación

### Auditoría de Código Real

**OpenClaw Tools Nativos (REAL):**
| Tool | Estado | Limitaciones |
|------|--------|--------------|
| `echo` | Implementado | Ninguna |
| `time` | Implementado | Ninguna |
| `http` | Implementado | GET/POST only, 10s timeout, no internal URLs |

**OpenClaw OS Tools:**
| Capability | Funcionalidad |
|------------|---------------|
| open_calculator | Solo lanza app |
| open_web_browser | Solo lanza browser |
| open_file_explorer | Solo lanza explorer |
| open_terminal | Solo lanza terminal |

**Conclusión:** OpenClaw es MUY limitado. Solo 3 tools básicos.

### GranClaw Channels - Estado Real

Los channels de GranClaw son **abstracciones/stubs**:
- Funciones WRITE → encolan acciones (`enqueueChannelAction`)
- Funciones READ → stubs que retornan `[]` o `null`
- Event handlers → implementados para workflow triggers

**NO hay implementación real de:**
- IMAP/SMTP
- FTP/SFTP
- Playwright browser automation
- WhatsApp API
- Calendar APIs

### Clasificación Confirmada

**No hay duplicación** porque OpenClaw no tiene estas capabilities.

| Tipo | Canales | Razón |
|------|---------|-------|
| `granclaw_adapter` | api, webhook | Usan OpenClaw `http` tool |
| `granclaw_provider` | email, ftp, sftp, browser, whatsapp, calendar, filesystem | OpenClaw no soporta |

### Provider Justifications (Obligatorias)

Cada provider documenta por qué es necesario:

```typescript
interface ProviderJustification {
  reason: string
  whyOpenClawNotEnough: string
  fallbackStrategy: FallbackAction
  stability: 'stable' | 'beta' | 'experimental'
  futureMigrationPossible: boolean
}
```

### Runtime Responsibility Split

**OpenClaw:**
- reasoning
- tool_execution
- native_capabilities
- chat_sessions
- rpc_gateway

**GranClaw:**
- workflows
- queue
- dag_execution
- validation
- recovery
- approvals
- websocket_realtime
- memory_patterns
- metrics
- audit
- ux_product
- channel_abstraction

### Módulo openclaw-adapters

Nueva capa que conecta adapters con OpenClaw tools:

```
apps/api/src/modules/openclaw-adapters/
├── types.ts                  # AdapterContext, AdapterResult, ProviderJustification
├── api-adapter.ts            # Usa OpenClaw http tool (GET/POST)
├── webhook-adapter.ts        # Usa OpenClaw http tool + incoming handling
├── provider-justifications.ts # Justificaciones obligatorias
└── index.ts                  # Exports
```

### Archivos Creados

| Archivo | Descripción |
|---------|-------------|
| `openclaw-adapters/types.ts` | Types para adapters y justificaciones |
| `openclaw-adapters/api-adapter.ts` | API adapter usando http tool |
| `openclaw-adapters/webhook-adapter.ts` | Webhook adapter |
| `openclaw-adapters/provider-justifications.ts` | Justificaciones |
| `openclaw-adapters/index.ts` | Exports |

### Reportes Creados

| Reporte | Contenido |
|---------|-----------|
| `P4_2_openclaw_capability_inventory.md` | Inventario completo de OpenClaw |
| `P4_2_adapter_consolidation_report.md` | Consolidación de adapters |

### Verificaciones

- ✅ npm run check sin errores
- ✅ npm run build exitoso
- ✅ Auditoría de código real completada
- ✅ Clasificación P4.1R confirmada correcta
- ✅ Provider justifications documentadas
- ✅ Runtime responsibility split definida
- ✅ NO hay duplicación con OpenClaw

---

## P5 — Durable Operational Workers & Real Connectors

**Fecha:** 2026-05-07
**Objetivo:** Convertir stubs de channels en workers persistentes con lifecycle management real.

### Problema Identificado

Los channels de GranClaw eran **stubs/frameworks**:
- Solo encolaban acciones vía `enqueueChannelAction()`
- No había workers persistentes
- No había heartbeat/health monitoring
- No había recovery/reconnection logic
- No había persistencia de estado entre reinicios

### Solución Implementada

Nuevo módulo `channel-workers` con:
- **Worker Registry**: Registro central de workers activos
- **Lifecycle Management**: start/stop/restart con graceful shutdown
- **Heartbeat Monitoring**: Health checks periódicos
- **Recovery Service**: Reconnect con exponential backoff
- **Persistence**: Estado guardado a JSON para sobrevivir reinicios
- **Safety Controls**: Límites y protección contra runaway workers

### Arquitectura channel-workers

```
apps/api/src/modules/channel-workers/
├── types.ts              # Worker types, status, health, config
├── worker-registry.ts    # Registry de workers activos
├── lifecycle.ts          # Start/stop/restart workers
├── heartbeat.ts          # Health monitoring
├── recovery.ts           # Reconnect/restore logic
├── persistence.ts        # Save/load state to disk
├── health.ts             # System health aggregation
├── worker-manager.ts     # Central manager
├── routes.ts             # HTTP endpoints
├── safety.ts             # Safety controls
├── index.ts              # Module exports
└── workers/
    ├── base-worker.ts    # Abstract base class
    ├── email-worker.ts   # Email (IMAP/SMTP)
    ├── whatsapp-worker.ts # WhatsApp Business API
    ├── browser-worker.ts  # Browser automation
    ├── ftp-worker.ts      # FTP/SFTP
    ├── calendar-worker.ts # Calendar (Google/Outlook)
    ├── filesystem-worker.ts # Local filesystem
    └── index.ts           # Worker exports
```

### Worker Types

```typescript
type WorkerStatus = 
  | 'starting' 
  | 'running' 
  | 'reconnecting' 
  | 'degraded' 
  | 'failed' 
  | 'stopped'

interface ChannelWorker {
  id: string
  channelType: ChannelType
  channelId: string
  tenantId: string
  status: WorkerStatus
  health: WorkerHealth
  reconnectCount: number
  queuePressure: number
  runtimeState: WorkerRuntimeState
}

interface WorkerHandler {
  connect(): Promise<void>
  disconnect(): Promise<void>
  isConnected(): boolean
  heartbeat(): Promise<boolean>
  reconnect(): Promise<void>
  saveState(): WorkerPersistedState
  restoreState(state: WorkerPersistedState): Promise<void>
}
```

### Workers Implementados

| Worker | Channel | Status | Justification |
|--------|---------|--------|---------------|
| EmailWorker | email | Scaffold | OpenClaw no tiene IMAP/SMTP |
| WhatsAppWorker | whatsapp | Scaffold | OpenClaw no tiene WhatsApp API |
| BrowserWorker | browser | Scaffold | open_web_browser solo lanza browser |
| FTPWorker | ftp | Scaffold | OpenClaw no tiene FTP protocol |
| SFTPWorker | sftp | Scaffold | OpenClaw no tiene SSH/SFTP |
| CalendarWorker | calendar | Scaffold | OpenClaw no tiene Calendar API |
| FilesystemWorker | filesystem | Scaffold | open_file_explorer solo abre explorer |

### Lifecycle Flow

```
                    ┌─────────────┐
                    │   starting  │
                    └──────┬──────┘
                           │ connect()
                           ▼
         ┌─────────┐   ┌─────────────┐   ┌────────────┐
         │ stopped │◄──│   running   │──►│  degraded  │
         └─────────┘   └──────┬──────┘   └─────┬──────┘
              ▲               │                │
              │               │                │
              │               ▼                ▼
              │        ┌─────────────┐   ┌──────────┐
              └────────│   failed    │◄──│reconnect │
                       └─────────────┘   └──────────┘
```

### Safety Controls

```typescript
interface SafetyConfig {
  maxWorkersPerTenant: number      // 10
  maxWorkersTotal: number          // 100
  maxFailedWorkers: number         // 20
  maxQueuePressure: number         // 0.9
  maxReconnectRate: number         // 30/min
  emergencyShutdownThreshold: number // 0.5 (50% failed)
}
```

### Health Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/workers/health` | System-wide health |
| `GET /api/workers/health/all` | All workers health |
| `GET /api/workers/health/:id` | Single worker health |
| `GET /api/workers/operational` | Is system operational |
| `GET /api/workers/metrics` | Prometheus-style metrics |
| `GET /api/workers` | List workers |
| `POST /api/workers` | Create worker |
| `DELETE /api/workers/:id` | Stop/remove worker |
| `POST /api/workers/:id/restart` | Restart worker |

### Persistence

Workers guardan estado a `data/worker-states.json`:
- Session data
- Cursor positions  
- Auth tokens
- Last processed IDs

Debounced save (1 segundo de inactividad antes de flush).

### Verificaciones

- ✅ npm run check sin errores
- ✅ npm run build exitoso
- ✅ 7 workers implementados (scaffold)
- ✅ Lifecycle management completo
- ✅ Heartbeat monitoring
- ✅ Recovery con backoff
- ✅ Persistence a disco
- ✅ Safety controls
- ✅ Health endpoints

---

## P5.1 — Controlled Real Testing & Connector Hardening

**Fecha:** 2026-05-07
**Objetivo:** Pruebas reales controladas y endurecimiento de conectores.

### Módulo testing Creado

```
apps/api/src/modules/channel-workers/testing/
├── environments.ts       # RuntimeEnvironment: simulation, sandbox, controlled_real, production
├── worker-modes.ts       # supportedModes y currentMode por worker
├── email-sandbox.ts      # IMAP/SMTP sandbox, dedupe, test threads
├── whatsapp-controls.ts  # Dry-run, approval, anti-loop, cooldown, max replies
├── browser-health.ts     # Crash recovery, memory leak detection, context reuse
├── ftp-hardening.ts      # Reconnect, retry, checksum, partial upload, rollback
├── soak-tests.ts         # Tests de 1h, 6h, 24h duración
├── failure-simulation.ts # Simulación de websocket_lost, auth_expired, crashes
├── observability.ts      # Métricas Prometheus para workers
├── safety-gates.ts       # Gates para autonomous_whatsapp, mass_send, etc
└── index.ts              # Module exports
```

### RuntimeEnvironment

| Mode | Real Connections | Autonomous | Approval |
|------|-----------------|------------|----------|
| simulation | No | Yes | No |
| sandbox | Yes | No | Yes |
| controlled_real | Yes | No | Yes |
| production | Yes | No | Yes |

Default: **sandbox**

### Safety Gates

| Gate | Blocked by Default |
|------|-------------------|
| autonomous_whatsapp | ✅ |
| unrestricted_browser | ✅ |
| mass_send | ✅ |
| production_without_approvals | ✅ |
| uncontrolled_filesystem | ✅ |

### Métricas Observability

- `granclaw_worker_reconnect_total`
- `granclaw_workflow_success_rate`
- `granclaw_queue_lag_seconds`
- `granclaw_ws_reconnect_total`
- `granclaw_validation_failure_rate`
- `granclaw_browser_crash_total`
- `granclaw_workers_healthy/degraded/failed`

### Failure Simulation

Tipos simulables:
- websocket_lost
- auth_expired
- browser_crash
- imap_disconnect
- ftp_timeout
- openclaw_unavailable

### Verificaciones

- ✅ npm run check sin errores
- ✅ npm run build exitoso
- ✅ Environment configuration
- ✅ Worker mode support
- ✅ Channel-specific hardening
- ✅ Soak test infrastructure
- ✅ Failure simulation
- ✅ Observability metrics
- ✅ Safety gates

---

## P2.1 — Product Entry Redirect & Shell Visibility

**Fecha:** 2026-05-07
**Objetivo:** Redireccionar entrada principal a experiencia producto.

### Cambios Realizados

#### Router (App.tsx)

```typescript
// ANTES: / mostraba control panel
if (path === '/' || path === '/control') return <Execute />

// DESPUÉS: / muestra producto dashboard
if (path === '/') return <ProductDashboard />
if (path === '/control') return <Execute />  // Separado
```

#### AppShell Route

```typescript
// ANTES: AppShell solo para product routes
function isAppShellRoute(path: string): boolean {
  return productRoutes.some(r => path === r || path.startsWith(r + '/'))
}

// DESPUÉS: / también usa AppShell
function isAppShellRoute(path: string): boolean {
  // P2.1: / ahora es producto con AppShell (redirige a /dashboard)
  return path === '/' || productRoutes.some(r => path === r || path.startsWith(r + '/'))
}
```

#### Sidebar (layouts/Sidebar.tsx)

```typescript
// ANTES
{ id: 'control', label: 'Control', icon: '🛠️', path: '/control', advanced: true }

// DESPUÉS: Etiquetado como avanzado
{ id: 'control', label: 'Control avanzado', icon: '🛠️', path: '/control', advanced: true }
```

### Flujo de Navegación

```
/                 → AppShell + ProductDashboard (experiencia producto)
/dashboard        → AppShell + ProductDashboard
/tasks            → AppShell + TasksPage
/automations      → AppShell + AutomationsPage
/channels         → AppShell + ChannelsPage
/control          → ProductHeader + Execute (panel técnico)
/control/*        → ProductHeader + Control pages
/dev/*            → DevHeader + Dev pages
```

### Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `apps/web/src/App.tsx:58-65` | isProductRoute/isAppShellRoute |
| `apps/web/src/App.tsx:81-85` | Router / handling |
| `apps/web/src/layouts/Sidebar.tsx:29` | Control → Control avanzado |

### Verificaciones

- ✅ npm run check sin errores
- ✅ npm run build exitoso
- ✅ / renderiza ProductDashboard con AppShell
- ✅ /control sigue accesible como panel técnico
- ✅ Sidebar muestra "Control avanzado"
- ✅ Rutas producto funcionan correctamente

---

## P2.2 — API Base URL & Runtime State Fetch Fix

**Fecha:** 2026-05-07
**Objetivo:** Corregir error de parseo HTML como JSON en ProductDashboard.

### Problema

```
SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
```

ProductDashboard usaba `fetch('/api/runtime/state')` directo, sin API_BASE_URL.
Vite servia HTML en lugar del backend.

### Solucion

#### API Client Centralizado (api.ts)

```typescript
// Nuevas funciones
export function isApiConnectionError(error: unknown): boolean
export class ApiNonJsonError extends Error
export async function apiFetch<T>(path: string, options?): Promise<T>
export async function getRuntimeState(): Promise<{ success, data, error }>

// Validacion de content-type antes de JSON.parse
const contentType = response.headers.get('content-type')
if (!contentType.includes('application/json')) {
  // Error legible, no SyntaxError
}
```

#### ProductDashboard.tsx

```typescript
// ANTES
const response = await fetch('/api/runtime/state')
const data = await response.json()  // CRASH con HTML

// DESPUES
import { getRuntimeState } from '../../services/api'
const result = await getRuntimeState()
if (result.success && result.data) {
  // Usar data
} else {
  setApiError(result.error)  // Mostrar degraded state
}
```

#### RuntimePage.tsx

Mismo patron: usar `getRuntimeState()` centralizado.

#### Vite Proxy (vite.config.ts)

```typescript
server: {
  proxy: {
    '/runtime': 'http://localhost:3001',
    '/queue': 'http://localhost:3001',
    '/api': 'http://localhost:3001'
    // ...
  }
}
```

#### .env.example

```
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
```

### Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `apps/web/src/services/api.ts` | isApiConnectionError, ApiNonJsonError, apiFetch, getRuntimeState |
| `apps/web/src/pages/product/ProductDashboard.tsx` | Usar getRuntimeState, mostrar degraded state |
| `apps/web/src/pages/product/RuntimePage.tsx` | Usar getRuntimeState, mostrar error |
| `apps/web/vite.config.ts` | Proxy para /runtime, /api, etc |
| `apps/web/.env.example` | Variables de entorno |

### Verificaciones

- ✅ npm run check sin errores
- ✅ npm run build exitoso
- ✅ ProductDashboard no crashea con HTML
- ✅ Muestra degraded state si API offline
- ✅ Error legible (no SyntaxError)
- ✅ Proxy configurable

---

## P5.2 — Consistency Hardening & Technical Debt Cleanup

**Fecha:** 2026-05-07
**Objetivo:** Cerrar inconsistencias y deuda tecnica antes de escalar.

### Config Consistency

Unificado env naming:

```bash
# CANONICAL
VITE_API_BASE_URL=http://localhost:3001
VITE_WS_BASE_URL=ws://localhost:3001

# DEPRECATED (backward compatible)
# VITE_API_URL
# VITE_WS_URL
# VITE_API_PORT
```

### API Client Consolidation

Todos los fetches centralizados en `api.ts`:
- `apiFetch<T>()` - Raw fetch con validacion JSON
- `getRuntimeState()` - Runtime state tipado
- `isApiConnectionError()` - Detector de errores
- `ApiNonJsonError` - Error clase para HTML responses

### Route Consistency

Backend: 40+ endpoints sin duplicados
Frontend: Producto, Control, Dev - separados

### Status Normalization

| Domain | Canonical Statuses |
|--------|-------------------|
| Queue | pending, running, completed, failed, dead-lettered |
| Task | pending, running, success, blocked, error, unconfirmed |
| Node | pending, queued, running, completed, validated, failed |
| Proposal | pending, approved, rejected, archived |

### Provider/Adapter Clarity

| Role | Type |
|------|------|
| Providers | openclaw, local, task_memory, capability, proposal |
| Adapters | openclaw-runtime, channel-specific |

### Consistency Endpoint

```
GET /runtime/consistency
```

Retorna:
- configDrift
- canonicalStatuses
- providerRoles
- legacyInventory
- queueBypassRisk

### Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `.env.example` | VITE_API_BASE_URL, VITE_WS_BASE_URL |
| `api.ts` | Backward compat VITE_API_BASE_URL |
| `runtime-ws.ts` | Backward compat VITE_WS_BASE_URL |
| `ProductDashboard.tsx` | VITE_API_BASE_URL reference |
| `vite.config.ts` | Comment update |
| `runtime-routes.ts` | handleGetConsistency |
| `index.ts` | /runtime/consistency route |

### Verificaciones

- ✅ npm run check sin errores
- ✅ npm run build exitoso
- ✅ Config naming unificado
- ✅ API client centralizado
- ✅ Rutas sin duplicados
- ✅ Estados canonicos
- ✅ Provider/adapter claro
- ✅ WS-first mantenido
- ✅ Queue authority mantenido

## P5.3 — WebSocket Subscription Registry Consistency

**Fecha:** 2026-05-07
**Objetivo:** Corregir error SUBSCRIPTION_NOT_FOUND en WS cleanup.

### Causa Raíz

Mismatch de subscriptionId entre frontend y backend:
- Frontend generaba ID local: `sub_...`
- Backend generaba ID diferente: `msg_...`
- Backend NO devolvía ID en ACK de subscribe
- Frontend usaba ID local al unsubscribe → error

### Solución

1. **Backend devuelve subscriptionId en ACK**
```typescript
createSubscriptionAckFrame(originalId, subscriptionId, channel, message)
```

2. **Frontend almacena serverSubscriptionId**
```typescript
interface Subscription {
  serverSubscriptionId?: string  // Backend-assigned ID
  pendingSubscribeId?: string    // For ACK correlation
}
```

3. **Unsubscribe idempotente**
- Backend: Si subscription no existe, devuelve success (no error)
- Frontend: Usa serverSubscriptionId si existe

4. **Error handling non-fatal**
- `SUBSCRIPTION_NOT_FOUND` tratado como debug, no error
- `MISSING_SUBSCRIPTION_ID` tratado como debug, no error

### Canales Canonicos

```typescript
export type WsChannel =
  | 'runtime'       // global runtime events
  | 'queue'         // queue/job events
  | 'workflow'      // workflow-specific events
  | 'notifications' // user notifications
  | 'debug'         // debug events
```

### Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `serializer.ts` | + createSubscriptionAckFrame() |
| `gateway.ts` | Unsubscribe idempotente, subscribe devuelve subscriptionId |
| `runtime-ws.ts` | serverSubscriptionId tracking, non-fatal error handling |

### Verificaciones

- ✅ npm run check sin errores
- ✅ npm run build exitoso
- ✅ No SUBSCRIPTION_NOT_FOUND en consola
- ✅ Unsubscribe idempotente
- ✅ Reconnect consistency

## P6.1 — Product Shell Action Wiring & Functional Buttons

**Fecha:** 2026-05-09
**Objetivo:** Conectar todos los botones del Product Shell al action model canonico.

### Problema

Muchos botones en el Product Shell:
- No tenian onClick handlers
- No llamaban a endpoints de backend
- No creaban jobs persistentes
- No mostraban feedback (loading/error)
- No actualizaban UI via WS/REST

### Solucion

1. **Action Model Canonico** (`actions.ts`)
```typescript
export interface ActionResult<T = unknown> {
  success: boolean
  status: 'queued' | 'executed' | 'failed' | 'requires_approval' | 'not_available'
  message: string
  data?: T
  jobId?: string
  error?: string
}
```

2. **Navigation Hook** (`useNavigation.ts`)
- useNavigation() para navegacion programatica
- useSearchParams() para URL params sin react-router-dom

3. **Paginas Actualizadas**

| Pagina | Acciones Implementadas |
|--------|------------------------|
| ProductDashboard | Quick Actions (Nueva Tarea, Nueva Automatizacion, Conectar Canal) navegan a paginas respectivas |
| TasksPage | + Nueva Tarea (modal), Reintentar, Cancelar, Ver detalles |
| ApprovalsPage | Aprobar, Denegar (llaman backend) |
| NotificationsPage | Marcar leida, Marcar todas leidas, Descartar, Limpiar todo (localStorage persistence) |
| ChannelsPage | Test (llama testChannel), Connect modal placeholder |
| AutomationsPage | Activar/Pausar, Ejecutar ahora, Create modal placeholder |

4. **Botones Sin Backend**
- Botones de funciones no implementadas muestran:
  - Estado disabled con opacity
  - Tooltip "Funcion en desarrollo"
  - Feedback "No disponible aun" al hacer click

5. **UX Improvements**
- Loading states en todos los botones de accion
- Feedback messages (success/error) con timeout
- Hover effects en botones
- Modals para creacion de tareas

### Archivos Creados/Modificados

| Archivo | Cambio |
|---------|--------|
| `services/actions.ts` | CREATED - Canonical action model |
| `hooks/useNavigation.ts` | CREATED - Navigation hooks sin react-router-dom |
| `pages/product/ProductDashboard.tsx` | Quick Actions funcionales |
| `pages/product/TasksPage.tsx` | Task CRUD funcional + modal |
| `pages/product/ApprovalsPage.tsx` | Approve/Deny backend calls |
| `pages/product/NotificationsPage.tsx` | LocalStorage persistence + actions |
| `pages/product/ChannelsPage.tsx` | Test channel + placeholder modals |
| `pages/product/AutomationsPage.tsx` | Toggle/Run now + placeholder modals |

### Acciones Disponibles

```typescript
// tasks
createTask(input) -> ActionResult
retryTask(taskId) -> ActionResult
cancelTask(taskId) -> ActionResult

// approvals
approveRequest(approvalId) -> ActionResult
denyRequest(approvalId) -> ActionResult

// queue
pauseQueue() -> ActionResult
resumeQueue() -> ActionResult
requeueDeadLetter(jobId) -> ActionResult
clearDeadLetters() -> ActionResult

// channels
testChannel(channelId) -> ActionResult

// automations
toggleAutomation(automationId, enabled) -> ActionResult
runAutomationNow(automationId) -> ActionResult
```

### Verificaciones

- ✅ npm run check sin errores
- ✅ npm run build exitoso
- ✅ Todos los botones tienen onClick o estan disabled
- ✅ Loading states en acciones async
- ✅ Error handling con feedback visual
- ✅ Navegacion funciona sin react-router-dom

## P6.2 — Frontend Functional Audit, API Contracts & Auth Flow Fix

**Fecha:** 2026-05-09
**Objetivo:** Corregir bug de crear tarea (400 Bad Request) y mejorar flujo de auth.

### Problema Detectado

1. **Bug Critico**: POST `/orchestrator/run` retornaba 400 Bad Request
   - Error: `Field "message" is required`
   - Causa: Frontend enviaba `{ input: ... }` pero backend espera `{ message: ... }`

2. **Auth UX Issues**:
   - No habia boton de Login visible cuando usuario no autenticado
   - Logout no navegaba a /login
   - Login redirecteaba a /control en vez de /dashboard (producto)
   - No habia handler global para session-expired (401)

### Solucion

1. **Fix API Contract** (`services/actions.ts`)
```typescript
// ANTES (bug)
export interface CreateTaskInput {
  input: string  // <-- INCORRECTO
}
body: JSON.stringify({ input: input.input })

// DESPUES (fix)
export interface CreateTaskInput {
  message: string  // <-- CORRECTO
}
body: JSON.stringify({ message: input.message })
```

2. **Fix TasksPage** (`pages/product/TasksPage.tsx`)
```typescript
// ANTES
createTask({ input: taskInput.trim() })

// DESPUES
createTask({ message: taskInput.trim() })
```

3. **Fix Topbar Auth** (`layouts/Topbar.tsx`)
- Usa `isAuthenticated` de useAuth
- Muestra boton "Iniciar Sesion" cuando no autenticado
- Logout ahora navega a /login despues de cerrar sesion

4. **Fix LoginPage** (`pages/login/index.tsx`)
- Redirecciona a `/dashboard` en vez de `/control`

5. **Global Session Handler** (`App.tsx`)
```typescript
// P6.2: Global session-expired handler - redirect to login on 401
useEffect(() => {
  const handleSessionExpired = () => {
    setCurrentPath('/login')
    window.history.pushState({}, '', '/login')
  }
  window.addEventListener('session-expired', handleSessionExpired)
  return () => window.removeEventListener('session-expired', handleSessionExpired)
}, [])
```

### Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `services/actions.ts` | CreateTaskInput.input -> .message, body usa message |
| `pages/product/TasksPage.tsx` | createTask({ message: ... }) |
| `layouts/Topbar.tsx` | Boton Login cuando !isAuthenticated, logout -> /login |
| `pages/login/index.tsx` | Redirect a /dashboard en vez de /control |
| `App.tsx` | Global session-expired handler |

### Verificaciones

- ✅ npm run build exitoso (web)
- ✅ CreateTaskInput usa `message` (API contract correcto)
- ✅ Topbar muestra Login cuando no autenticado
- ✅ Logout navega a /login
- ✅ Login redirectea a /dashboard
- ✅ session-expired redirige a /login globalmente

## P6.3 — Operational UX, Result Visibility & Real Task Outcomes

**Fecha:** 2026-05-09
**Objetivo:** Mostrar resultados reales de tareas, no solo "completed".

### Problema

- Tareas completadas no mostraban outputs reales
- No habia summary legible para humanos
- Artifacts no se mostraban
- No habia pagina de detalle /tasks/:id
- Automations llamaban endpoints inexistentes (404)

### Solucion

1. **TaskResult Model** (`apps/api/src/modules/task-results/`)

```typescript
interface TaskResult {
  taskId: string
  status: string
  summary: string           // Human-readable
  outputs: TaskOutput[]     // Structured outputs
  artifacts: TaskArtifact[] // Files/resources
  provider?: string
  durationMs?: number
}

interface TaskOutput {
  type: 'text' | 'link' | 'json' | 'table' | 'warning' | 'code' | 'list'
  label?: string
  value: unknown
}

interface TaskArtifact {
  type: 'file' | 'download' | 'screenshot' | 'report' | 'url'
  name: string
  path?: string
  url?: string
}
```

2. **Result Capture**
- `completeTask()` genera TaskResult automaticamente
- Extrae summary, outputs, artifacts del raw result
- Persiste en `data/task-results.json`

3. **Task Detail Page** (`/tasks/:id`)
- Summary destacado
- Outputs renderizados por tipo
- Artifacts listados
- Workflow trace visual
- Metadata

4. **Result Renderers** (`components/results/ResultRenderers.tsx`)
- TextResult, LinkResult, TableResult, JsonResult
- WarningResult, CodeResult, ImageResult
- ArtifactsRenderer

5. **Task Cards mejoradas**
- Muestran summary
- Preview de primer output
- Badge de artifacts count
- Click navega a detalle

6. **Automations Reality Check**
- Backend no existe
- Agregado banner de advertencia en UI

### Archivos Backend

| Archivo | Cambio |
|---------|--------|
| `modules/task-results/*` | CREATED - TaskResult model |
| `modules/tasks/types.ts` | Added structured result fields |
| `modules/tasks/service.ts` | completeTask generates TaskResult |
| `modules/tasks/routes.ts` | GET /tasks/:id/result |
| `index.ts` | Register new route |

### Archivos Frontend

| Archivo | Cambio |
|---------|--------|
| `services/api.ts` | TaskOutput, TaskArtifact types |
| `components/results/ResultRenderers.tsx` | CREATED |
| `pages/product/TaskDetailPage.tsx` | CREATED |
| `pages/product/TasksPage.tsx` | Enhanced cards |
| `pages/product/AutomationsPage.tsx` | Backend notice |
| `App.tsx` | Route /tasks/:id |

### Verificaciones

- ✅ npm run build exitoso (api)
- ✅ npm run build exitoso (web)
- ✅ TaskResult persiste con outputs/artifacts
- ✅ /tasks/:id muestra resultados estructurados
- ✅ Task cards muestran summary
- ✅ Result renderers funcionan por tipo
- ✅ Automations muestra advertencia de backend no disponible

## P6.4 — Persistent Pairing, Auth Lifecycle & Route Consistency

**Fecha:** 2026-05-09
**Objetivo:** Sistema robusto de pairing/auth lifecycle

### Problemas Resueltos

| Problema | Solucion |
|----------|----------|
| /tasks/new 404 | Usar ?create=true |
| No state machine de pairing | Nuevo modulo pairing-state |
| Inconsistencia capability/pairing | Sync service |
| Sin health check endpoint | GET/POST /pairing/* |
| Sin WS events de pairing | pairing:* events |
| Dashboard sin auth health | OpenClaw Connection section |

### Pairing State Machine

```typescript
type OverallPairingState =
  | 'unknown'        // Inicial
  | 'disconnected'   // OpenClaw no alcanzable
  | 'connected'      // Alcanzable sin auth
  | 'paired'         // Conectado + auth + capabilities OK
  | 'degraded'       // Auth OK pero scopes fallando
  | 'blocked'        // Issues criticos
  | 'error'          // Error fatal
```

### Archivos Nuevos

| Archivo | Descripcion |
|---------|-------------|
| `modules/pairing-state/types.ts` | Tipos de state machine |
| `modules/pairing-state/service.ts` | State machine + persistence |
| `modules/pairing-state/sync.ts` | Sync con system-state |
| `modules/pairing-state/routes.ts` | HTTP endpoints |

### Endpoints

| Ruta | Metodo | Descripcion |
|------|--------|-------------|
| `/pairing/state` | GET | Estado completo |
| `/pairing/health` | GET | Health para UI |
| `/pairing/combined` | GET | Health combinado |
| `/pairing/check` | POST | Ejecuta health check |
| `/pairing/reset` | POST | Reset a defaults |

### WS Events

- `pairing:state-change`
- `pairing:connected/disconnected/paired/degraded/blocked/error`

### Dashboard Health

Nueva seccion "OpenClaw Connection" en ProductDashboard:
- Estado de pairing con badge
- Indicador de capacidad de ejecucion
- Lista de issues activos
- Actualiza via WS events

### Verificaciones

- ✅ /tasks/new ahora usa ?create=true
- ✅ Pairing state persiste en data/pairing-state.json
- ✅ Health check corre en startup
- ✅ WS events emiten en cambio de estado
- ✅ Dashboard muestra OpenClaw health

## P6.5 — Runtime API Connectivity, Endpoint Registry & Dev Startup Fix

**Fecha:** 2026-05-09
**Objetivo:** Corregir ERR_CONNECTION_REFUSED en Dashboard y mejorar DX

### Problema Original

Dashboard mostraba "No se pudo conectar con Runtime API" con ERR_CONNECTION_REFUSED para:
- `/runtime/state`
- `/openclaw/health`
- `/pairing/health`

### Root Cause

El backend no estaba corriendo. NO era problema de configuración - todos los endpoints estaban correctamente registrados.

### Soluciones Implementadas

| Fase | Descripción | Estado |
|------|-------------|--------|
| A | Auditoría de puertos y scripts | ✅ |
| B | ENV variables normalizadas | ✅ |
| C | Dev health check visual | ✅ |
| D | Endpoint registry canónico | ✅ |
| E | Auditoría endpoints legacy | ✅ |
| F | Backend route registration audit | ✅ |
| G | Dev script documentado | ✅ |
| H | API connectivity test docs | ✅ |
| I | Frontend error handling mejorado | ✅ |
| J | Verificación (check + build) | ✅ |

### Archivos Creados/Modificados

| Archivo | Cambio |
|---------|--------|
| `apps/web/.env` | CREATED - VITE_API_BASE_URL, VITE_WS_BASE_URL |
| `apps/web/src/services/endpoints.ts` | CREATED - Endpoint registry canónico |
| `apps/web/src/services/api.ts` | ApiOfflineError class, isBackendOffline() |
| `apps/web/src/pages/product/ProductDashboard.tsx` | isOffline state, mejor error handling |
| `apps/web/src/services/runtime-ws.ts` | P6.4/P6.4R event types |
| `apps/api/src/index.ts` | Fix implicit 'any' type |
| `apps/api/src/modules/pairing-state/sync.ts` | Fix PairingHealthResponse import |
| `apps/api/src/modules/openclaw-auth/routes.ts` | DELETED (unused, used handlers.ts) |
| `apps/api/src/modules/openclaw-auth/index.ts` | Remove routes export |
| `docs/reports/claude/P6_5_startup_audit.md` | CREATED |
| `docs/reports/claude/P6_5_endpoint_registry_audit.md` | CREATED |

### Endpoint Registry

Nuevo archivo `apps/web/src/services/endpoints.ts` con todos los endpoints:
- Evita strings hardcodeados
- Tipado fuerte
- Centralized para mantenimiento

### Error Handling Mejorado

```typescript
// api.ts
export class ApiOfflineError extends Error {
  constructor(public url: string, public originalError?: Error) {
    super(`Backend API no esta corriendo en ${API_BASE}. Ejecuta: npm run dev:api`)
    this.name = 'ApiOfflineError'
  }
}

export function isBackendOffline(error: unknown): boolean {
  if (error instanceof ApiOfflineError) return true
  if (error instanceof TypeError && error.message.includes('Failed to fetch')) return true
  return false
}
```

### Dashboard Offline Detection

```typescript
// ProductDashboard.tsx
const [isOffline, setIsOffline] = useState(false)
// Shows specific message when backend is offline
// Includes command to start: npm run dev:api
```

### Verificaciones

- ✅ npm run check (api) exitoso
- ✅ npm run check (web) exitoso
- ✅ npm run build (api) exitoso
- ✅ npm run build (web) exitoso
- ✅ Todos los endpoints registrados en backend
- ✅ Frontend detecta backend offline correctamente
- ✅ Error messages muestran comando de startup

## P6.6 — Human Interaction Layer, Task Threads & Conversational Control

**Fecha:** 2026-05-10
**Objetivo:** Transformar tareas en conversaciones contextuales

### Problema Original

- Interaccion humana pobre
- Tareas no conversacionales
- Sin task threads
- Sin refinamiento progresivo
- Sin continuidad humana real

### Soluciones Implementadas

| Feature | Estado |
|---------|--------|
| Task Thread Model | ✅ |
| Human Task States | ✅ |
| Contextual Continuation | ✅ |
| Thread Memory | ✅ |
| Task Planning | ✅ |
| Conversational Task Page | ✅ |
| Approval Conversations | ✅ |

### Task Thread Model

```typescript
interface TaskThread {
  id: string
  taskId?: string
  title: string
  status: HumanTaskState
  messages: ThreadMessage[]
  activeContext: ThreadContext
  currentPlan?: HumanReadablePlan
  pendingApprovals: PendingApproval[]
}
```

### Human Task States

| Estado | Label |
|--------|-------|
| thinking | Pensando... |
| queued | En cola |
| executing | Ejecutando |
| waiting_approval | Esperando aprobacion |
| waiting_user_input | Esperando respuesta |
| paused | Pausada |
| completed | Completada |
| failed | Fallida |
| needs_repair | Requiere reparacion |
| cancelled | Cancelada |

### Thread Memory (Contextual)

```typescript
interface ThreadContext {
  preferences: Record<string, string | number | boolean>
  filters: string[]  // ["free_only", "secure"]
  decisions: Array<{key, value, reason}>
  entities: Array<{type, name}>
}
```

### Archivos Backend

| Archivo | Cambio |
|---------|--------|
| `modules/task-threads/types.ts` | CREATED |
| `modules/task-threads/service.ts` | CREATED |
| `modules/task-threads/handlers.ts` | CREATED |
| `modules/task-threads/index.ts` | CREATED |
| `index.ts` | Thread routes added |

### Archivos Frontend

| Archivo | Cambio |
|---------|--------|
| `components/threads/ThreadTimeline.tsx` | CREATED |
| `components/threads/ThreadChatInput.tsx` | CREATED |
| `components/threads/HumanTaskStateBadge.tsx` | CREATED |
| `pages/product/ConversationalTaskDetail.tsx` | CREATED |
| `services/api.ts` | Thread types + API |
| `App.tsx` | Route updated |

### API Endpoints

| Endpoint | Metodo |
|----------|--------|
| `/threads` | GET/POST |
| `/threads/active` | GET |
| `/threads/:id` | GET |
| `/threads/:id/messages` | POST |
| `/threads/:id/pause` | POST |
| `/threads/:id/resume` | POST |
| `/threads/:id/approvals` | GET/POST |

### Verificaciones

- ✅ npm run check (api) exitoso
- ✅ npm run check (web) exitoso
- ✅ npm run build (api) exitoso
- ✅ npm run build (web) exitoso
- ✅ Task threads persisten en data/
- ✅ Conversational UI funcional
- ✅ Human states con badges
