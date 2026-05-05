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
