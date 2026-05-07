# P4.1R — OpenClaw-First Integrations & Productionization

**Fecha:** 2026-05-07
**Estrategia:** OpenClaw-first + GranClaw adapters/fallbacks
**Estado:** COMPLETADO

---

## Resumen Ejecutivo

P4.1R establece la estrategia correcta de integración entre OpenClaw y GranClaw:

1. **OpenClaw-first**: Usar capabilities/tools de OpenClaw cuando existen
2. **GranClaw Adapters**: Envolver OpenClaw con governance layer
3. **GranClaw Providers**: Implementar donde OpenClaw no soporta
4. **Fallback Strategy**: Recuperación cuando OpenClaw falla

---

## Auditoría OpenClaw

### Tools Nativos Detectados

| Tool | Tipo | Estado | Limitaciones |
|------|------|--------|--------------|
| `http` | tool | Implementado | No URLs internas, 10s timeout, GET/POST |
| `echo` | tool | Implementado | - |
| `time` | tool | Implementado | - |

### OS Tools (Capabilities)

| Capability | Riesgo | Modo | Plataformas |
|------------|--------|------|-------------|
| `open_calculator` | Low | passthrough | Win/Mac/Linux |
| `open_web_browser` | Low | passthrough | Win/Mac/Linux |
| `open_text_editor_os` | Low | passthrough | Win/Mac/Linux |
| `open_file_explorer` | Low | passthrough | Win/Mac/Linux |
| `open_terminal` | Medium | strict | Win/Mac/Linux |

### Hallazgo Clave

**OpenClaw NO tiene MCPs nativos.**

Implementa su propio sistema de:
- Capabilities (per-tenant)
- Approval workflow
- Risk classification

---

## Channel Classification

### Tipos de Source

```typescript
type ChannelSource =
  | 'openclaw_native'     // OpenClaw ejecuta directamente
  | 'granclaw_adapter'    // GranClaw envuelve OpenClaw
  | 'granclaw_provider'   // GranClaw implementa completo
  | 'fallback'            // Fallback cuando primario falla
  | 'experimental'        // Inestable/experimental
```

### Clasificación Final

| Canal | Source | OpenClaw Ref | Razón |
|-------|--------|--------------|-------|
| **email** | `granclaw_provider` | - | OpenClaw no tiene email tool |
| **ftp** | `granclaw_provider` | - | OpenClaw no tiene FTP tool |
| **sftp** | `granclaw_provider` | - | OpenClaw no tiene SFTP tool |
| **browser** | `granclaw_provider` | `open_web_browser` | OpenClaw solo lanza browser, GranClaw automatiza (Playwright) |
| **whatsapp** | `granclaw_provider` | - | OpenClaw no tiene WhatsApp tool |
| **calendar** | `granclaw_provider` | - | OpenClaw no tiene Calendar tool |
| **api** | `granclaw_adapter` | `http` | GranClaw adapta http con queue/validation/metrics |
| **filesystem** | `granclaw_provider` | `open_file_explorer` | OpenClaw solo lanza explorer |
| **webhook** | `granclaw_adapter` | `http` | GranClaw adapta http + incoming webhook handling |

### Resumen por Source

| Source | Canales | Cantidad |
|--------|---------|----------|
| `openclaw_native` | - | 0 |
| `granclaw_adapter` | api, webhook | 2 |
| `granclaw_provider` | email, ftp, sftp, browser, whatsapp, calendar, filesystem | 7 |

**Conclusión:** GranClaw P3 no duplicó OpenClaw. Los canales son extensiones operacionales donde OpenClaw no tiene soporte.

---

## Channel Discovery Layer

### Arquitectura

```
apps/api/src/modules/channel-discovery/
├── types.ts           # Tipos: ChannelSource, DiscoveryResult, etc.
├── registry.ts        # Registro de OpenClaw capabilities y mappings
├── discovery.ts       # Lógica de discovery y source resolution
├── adapters.ts        # Configuración de adapters (API, Webhook)
├── fallback.ts        # Estrategias de fallback por canal
└── index.ts           # Exports del módulo
```

### Funciones Principales

```typescript
// Descubrir source para un canal
discoverChannel(channelType: ChannelType, tenantId: string): ChannelDiscoveryResult

// Descubrir todos los canales
discoverAllChannels(tenantId: string): ChannelDiscoveryResult[]

// Obtener source recomendado considerando estado de OpenClaw
getRecommendedSource(channelType, action, context): ChannelSource

// Obtener enhancements de GranClaw por source
getEnhancements(source: ChannelSource): GranClawEnhancement[]
```

---

## GranClaw Enhancements

Cuando GranClaw adapta o provee un canal, añade:

| Enhancement | Descripción |
|-------------|-------------|
| `queue` | Integración con runtime-queue |
| `validation` | workflow-validation antes de ejecutar |
| `retries` | Exponential backoff |
| `runtime_events` | event-bus integration |
| `websocket` | Real-time updates via WS |
| `approvals` | Sistema de aprobaciones |
| `metrics` | messagesPerHour, errors, latency |
| `audit` | Registro en audit module |
| `rate_limiting` | Límites por canal |
| `fallback` | Recuperación cuando falla |

---

## Fallback Strategy

### Triggers

```typescript
type FallbackTrigger =
  | 'openclaw_unavailable'  // OpenClaw no responde
  | 'timeout'               // Timeout en operación
  | 'auth_expired'          // Credencial expirada
  | 'rate_limited'          // Rate limit alcanzado
  | 'capability_disabled'   // Capability deshabilitada
  | 'network_error'         // Error de red
```

### Acciones

```typescript
type FallbackAction =
  | 'use_granclaw_provider'  // Usar provider nativo GranClaw
  | 'queue_for_retry'        // Encolar para reintento
  | 'require_setup'          // Requiere configuración
  | 'escalate_human'         // Escalar a humano
  | 'skip'                   // Saltar operación
```

### Estrategias por Canal

| Canal | Triggers | Action | Max Retries | Cooldown |
|-------|----------|--------|-------------|----------|
| **api** | unavailable, timeout, network | queue_for_retry | 3 | 5s |
| **webhook** | unavailable, timeout, network | queue_for_retry | 5 | 10s |
| **email** | auth_expired, rate_limited, network | queue_for_retry | 3 | 60s |
| **whatsapp** | auth_expired, rate_limited, disabled | escalate_human | 0 | - |
| **browser** | timeout, disabled | escalate_human | 1 | - |
| **ftp/sftp** | auth_expired, network, timeout | queue_for_retry | 3 | 30s |
| **calendar** | auth_expired, rate_limited, network | queue_for_retry | 3 | 30s |
| **filesystem** | disabled | require_setup | 0 | - |

---

## Adapters

### API Adapter

Envuelve OpenClaw `http` tool con:
- Request transformation
- Response normalization
- Rate limiting
- Metrics collection
- Error classification

### Webhook Adapter

Envuelve OpenClaw `http` tool para salientes + handling de entrantes:
- Signature verification
- Payload validation
- Delivery tracking
- Retry queue

---

## Archivos Creados

| Archivo | Líneas | Descripción |
|---------|--------|-------------|
| `channel-discovery/types.ts` | 115 | Tipos del módulo |
| `channel-discovery/registry.ts` | 145 | OpenClaw capabilities y mappings |
| `channel-discovery/discovery.ts` | 135 | Lógica de discovery |
| `channel-discovery/adapters.ts` | 155 | Configuración de adapters |
| `channel-discovery/fallback.ts` | 225 | Estrategias de fallback |
| `channel-discovery/index.ts` | 55 | Exports |

**Total:** ~830 líneas de código

---

## Verificaciones

| Check | Resultado |
|-------|-----------|
| `npm run check` | ✅ Sin errores TypeScript |
| `npm run build` | ✅ Build exitoso |
| OpenClaw-first aplicado | ✅ |
| No duplicación | ✅ |
| Channel classification | ✅ Completa |
| Fallback strategy | ✅ Definida |
| PROJECT_MEMORY actualizado | ✅ |

---

## Diagrama Arquitectónico

```
┌─────────────────────────────────────────────────────────────────┐
│                        GRANCLAW LAYER                           │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                 Channel Discovery Layer                    │  │
│  │                                                            │  │
│  │  discoverChannel() → { source, provider, capabilities }   │  │
│  │                                                            │  │
│  │  Sources:                                                  │  │
│  │  ├── openclaw_native (0 canales - no hay tools útiles)    │  │
│  │  ├── granclaw_adapter (2: api, webhook)                   │  │
│  │  └── granclaw_provider (7: email,ftp,browser,wa,cal...)   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│              ┌───────────────┼───────────────┐                  │
│              ▼               ▼               ▼                  │
│      ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│      │   Adapters   │ │  Providers   │ │   Fallback   │        │
│      │              │ │              │ │              │        │
│      │ • API        │ │ • Email      │ │ • Retry      │        │
│      │ • Webhook    │ │ • FTP/SFTP   │ │ • Escalate   │        │
│      │              │ │ • Browser    │ │ • Setup      │        │
│      │ Enhancements:│ │ • WhatsApp   │ │              │        │
│      │ queue,valid, │ │ • Calendar   │ │              │        │
│      │ metrics,etc  │ │ • Filesystem │ │              │        │
│      └──────┬───────┘ └──────────────┘ └──────────────┘        │
│             │                                                    │
│             ▼                                                    │
│      ┌──────────────┐                                           │
│      │   OpenClaw   │                                           │
│      │   http tool  │                                           │
│      └──────────────┘                                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Próximos Pasos

1. **Implementar ApiChannelAdapter real**
   - Conectar con OpenClaw http tool
   - Añadir todas las enhancements

2. **Implementar WebhookChannelAdapter real**
   - Outgoing via OpenClaw http
   - Incoming via Express/native handler

3. **Conectar channel-discovery con channels-runtime**
   - Usar discovery para routing de acciones
   - Aplicar fallback automático

4. **UI: Mostrar source/stability**
   - Badge de source en cada canal
   - Indicador de fallback disponible

5. **Métricas por source type**
   - Dashboard de uso adapter vs provider
   - Tracking de fallback activations

---

## Conclusión

P4.1R establece una arquitectura clara para la integración OpenClaw-GranClaw:

- **No duplicación**: GranClaw no reimplementa lo que OpenClaw ya hace
- **Extensión**: GranClaw provee donde OpenClaw no puede
- **Governance**: GranClaw añade control (queue, approvals, metrics) sobre todo
- **Resiliencia**: Fallback strategy para recuperación

El Channel Discovery Layer es el cerebro que decide "quién ejecuta qué" en tiempo real.

---

*Reporte generado: 2026-05-07*
