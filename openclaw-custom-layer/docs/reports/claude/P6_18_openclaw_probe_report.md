# P6.18 - OpenClaw Capability Probe, Control Center & Honest Real-Execution Readiness

**Fecha**: 2026-05-17
**Estado**: COMPLETADO

## Objetivo

Implementar un sistema de sondeo real que:
1. Prueba conectividad con OpenClaw Gateway
2. Reporta estado basado en evidencia (no hardcoded)
3. Muestra estado real en `/control/tools`
4. Provee acciones de recuperacion para capacidades bloqueadas

## Cambios Implementados

### 1. Modelo de Readiness Real (FASE B)

**Archivo**: `apps/api/src/modules/capabilities/types.ts`

Nuevos tipos:
- `ReadinessState` - Estados basados en evidencia (ready, unavailable, not_configured, gateway_unreachable, etc.)
- `ProbeEvidence` - Datos de prueba real (timestamp, latencia, target, error)
- `RealCapabilityReadiness` - Readiness con evidencia y acciones de recuperacion
- `OpenClawProbeResult` - Resultado de probe del gateway
- `SystemReadinessSnapshot` - Snapshot completo del sistema

### 2. Probe Service (FASE C)

**Archivo**: `apps/api/src/modules/capabilities/probe.ts`

Funciones implementadas:
- `probeOpenClawGateway()` - Hace HTTP request real a `/health` del gateway
- `probeCapabilityReadiness()` - Prueba una capacidad especifica
- `probeAllCapabilities()` - Snapshot completo del sistema
- `isCapabilityReady()` - Helper para task gates
- `getCapabilityDefinitions()` - Lista de definiciones para UI

Caracteristicas:
- Cache de 30 segundos para evitar probes excesivos
- Timeout de 5 segundos para probes HTTP
- Manejo de errores con mensajes descriptivos
- Logging con prefijo `[P6.18 Probe]`

### 3. Endpoints Backend (FASE D)

**Archivo**: `apps/api/src/modules/capabilities/routes.ts`

Nuevos handlers:
- `handleProbeGateway()` - GET `/capabilities/probe/gateway`
- `handleProbeCapability()` - GET `/capabilities/probe/:capability`
- `handleProbeAllCapabilities()` - GET `/capabilities/probe/all?refresh=true`

**Archivo**: `apps/api/src/index.ts`

Rutas registradas:
```typescript
'/capabilities/probe/gateway': handleProbeGateway,
'/capabilities/probe/all': handleProbeAllCapabilities,
{ pattern: /^\/capabilities\/probe\/([^/]+)$/, handler: handleProbeCapability }
```

### 4. Frontend Types & API (FASE E)

**Archivo**: `apps/web/src/services/api.ts`

Nuevos tipos espejo del backend:
- `ReadinessState`
- `ProbeEvidence`
- `ProbeRecoveryAction`
- `RealCapabilityReadiness`
- `OpenClawProbeResult`
- `SystemReadinessSnapshot`

Nuevos metodos API:
- `api.probeGateway()`
- `api.probeCapability(key)`
- `api.probeAllCapabilities(forceRefresh)`

### 5. UI /control/tools (FASE F)

**Archivo**: `apps/web/src/pages/control/Tools.tsx`

Nuevo panel "Estado del Sistema":
- Indicador visual del estado del gateway (verde/amarillo/rojo)
- Latencia de conexion si disponible
- Mensaje de error si no conecta
- Resumen: disponibles / no disponibles / requieren config
- Lista expandible de todas las capacidades con su estado
- Boton "Verificar conexion" para forzar probe

Helper `getReadinessStateStyle()` para badges de estado.

### 6. Harness P6.18 (FASE H)

**Archivo**: `apps/api/src/modules/testing/e2e/p6-18-harness.ts`

Tests:
1. `testGatewayProbe` - Estructura del probe de gateway
2. `testCapabilityProbe` - Estructura del probe de capability
3. `testUnknownCapabilityProbe` - Manejo de capacidades desconocidas
4. `testFullSystemSnapshot` - Snapshot completo del sistema
5. `testIsCapabilityReady` - Helper de verificacion
6. `testCapabilityDefinitions` - Lista de definiciones

## Flujo de Datos

```
Usuario -> /control/tools
         |
         v
    [Tools.tsx]
         |
         | api.probeAllCapabilities()
         v
    [API /capabilities/probe/all]
         |
         | probeAllCapabilities()
         v
    [probe.ts]
         |
         | probeOpenClawGateway()
         v
    [HTTP GET OPENCLAW_BASE_URL/health]
         |
         v
    [OpenClawProbeResult]
         |
         | probeCapabilityReadiness() x N
         v
    [RealCapabilityReadiness[]]
         |
         v
    [SystemReadinessSnapshot]
         |
         v
    [UI muestra estado real]
```

## Estados de Readiness

| Estado | Significado | Color |
|--------|-------------|-------|
| `ready` | Funciona, probado exitosamente | Verde |
| `unavailable` | No disponible | Rojo |
| `not_configured` | Falta configuracion (env vars) | Amarillo |
| `gateway_unreachable` | Gateway no responde | Rojo |
| `cli_not_running` | CLI local no ejecutando | Amarillo |
| `plugin_missing` | Plugin requerido no instalado | Amarillo |
| `auth_expired` | Autenticacion expirada | Rojo |
| `rate_limited` | Limite de uso temporal | Amarillo |
| `unknown` | Sin probe aun | Gris |

## Capacidades Definidas

| Key | Display Name | Requiere OpenClaw | Requiere Aprobacion |
|-----|--------------|-------------------|---------------------|
| browser | Navegador Web | Si | Si |
| download | Descargas | Si | Si |
| filesystem | Sistema de Archivos | No | Si |
| install_app | Instalar Aplicaciones | No | Si |
| web_search | Busqueda Web | Si | No |
| ftp | FTP | No | Si |
| email | Correo Electronico | No | Si |
| whatsapp | WhatsApp | No | Si |
| calendar | Calendario | No | Si |
| screenshot | Capturas de Pantalla | Si | No |
| clipboard | Portapapeles | No | Si |

## Verificacion

### Checks

```bash
$ npm run check (API)
> tsc --noEmit
✓ Sin errores

$ npm run check (Web)
> tsc --noEmit
✓ Sin errores
```

### Builds

```bash
$ npm run build (API)
> tsc
✓ Sin errores

$ npm run build (Web)
> tsc && vite build
✓ 95 modules transformed
✓ built in 4.22s
```

### Self-Audit

```bash
$ grep -c "P6.18" apps/**/*.ts
56 ocurrencias en archivos relevantes
```

## Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `apps/api/src/modules/capabilities/types.ts` | Nuevos tipos P6.18 |
| `apps/api/src/modules/capabilities/probe.ts` | NUEVO - Probe service |
| `apps/api/src/modules/capabilities/routes.ts` | Nuevos handlers de probe |
| `apps/api/src/modules/capabilities/index.ts` | Exports actualizados |
| `apps/api/src/index.ts` | Rutas de probe registradas |
| `apps/web/src/services/api.ts` | Tipos y metodos de probe |
| `apps/web/src/pages/control/Tools.tsx` | Panel de estado del sistema |
| `apps/api/src/modules/testing/e2e/p6-18-harness.ts` | NUEVO - Test harness |

## Archivos NO Modificados

- OpenClaw core
- Task execution flow (ya usa capability gates de P6.17)
- ConversationalTaskDetail (ya navega a /control/tools)
- Backend orchestrator routes (no requiere cambios)

## Integracion con P6.17

P6.18 complementa P6.17:
- P6.17 bloquea tasks y muestra `failureExplanation` con `navigateTo: '/control/tools'`
- P6.18 hace que `/control/tools` muestre el estado REAL del sistema
- Usuario ahora puede ver POR QUE la capability no funciona (gateway inaccesible, no configurado, etc.)

## Conclusion

P6.18 implementa un sistema de probe real que reemplaza el mapa hardcoded anterior con verificaciones de conectividad reales. El usuario ahora puede:

1. Ver el estado real del gateway OpenClaw
2. Ver cuales capacidades funcionan y cuales no
3. Entender POR QUE algo no funciona
4. Forzar re-verificacion con un boton
5. Ver acciones de recuperacion sugeridas
