# P5.1 — Controlled Real Testing & Connector Hardening

**Fecha:** 2026-05-07
**Autor:** Claude (Arquitecto Enterprise/Runtime Distribuido)
**Estado:** ✅ COMPLETADO

## Resumen

Implementación de infraestructura de pruebas controladas y endurecimiento de conectores para preparar GranClaw para despliegue real.

## Archivos Creados

| Archivo | Líneas | Función |
|---------|--------|---------|
| `testing/environments.ts` | ~200 | RuntimeEnvironment config |
| `testing/worker-modes.ts` | ~160 | Worker mode capabilities |
| `testing/email-sandbox.ts` | ~220 | Email testing sandbox |
| `testing/whatsapp-controls.ts` | ~280 | WhatsApp safety controls |
| `testing/browser-health.ts` | ~260 | Browser crash recovery |
| `testing/ftp-hardening.ts` | ~240 | FTP reconnect/checksum |
| `testing/soak-tests.ts` | ~200 | Long runtime tests |
| `testing/failure-simulation.ts` | ~240 | Failure injection |
| `testing/observability.ts` | ~280 | Prometheus metrics |
| `testing/safety-gates.ts` | ~220 | Safety gates |
| `testing/index.ts` | ~230 | Module exports |

**Total: ~2,500 líneas**

## FASE A — Test Environments

```typescript
type RuntimeEnvironment =
  | 'simulation'      // Fully mocked
  | 'sandbox'         // Test accounts, real protocols
  | 'controlled_real' // Real accounts with limits
  | 'production'      // Full production

// Default
let currentEnvironment: RuntimeEnvironment = 'sandbox'
```

### Environment Features

| Feature | simulation | sandbox | controlled_real | production |
|---------|------------|---------|-----------------|------------|
| realConnections | ❌ | ✅ | ✅ | ✅ |
| realSending | ❌ | ✅ | ✅ | ✅ |
| autonomousActions | ✅ | ❌ | ❌ | ❌ |
| approvalRequired | ❌ | ✅ | ✅ | ✅ |

### Environment Limits

| Limit | simulation | sandbox | controlled_real | production |
|-------|------------|---------|-----------------|------------|
| maxWorkersPerChannel | 100 | 5 | 10 | 20 |
| maxActionsPerHour | 10000 | 100 | 500 | 1000 |
| maxRecipientsPerAction | 1000 | 10 | 50 | 100 |
| cooldownMs | 0 | 5000 | 2000 | 1000 |

## FASE B — Email Sandbox

```typescript
interface EmailSandboxConfig {
  imapHost: string      // 'imap.ethereal.email'
  allowedDomains: string[]
  maxTestEmails: number
}

// Features
- isDuplicateMessage(messageId) // Dedupe
- trackTestThread(subject, messageId, from, to)
- validateAttachment(filename, mimeType, size)
- shouldTriggerWorkflow(subject, from, body)
```

## FASE C — WhatsApp Controlled Mode

```typescript
interface WhatsAppControlConfig {
  dryRunMode: boolean         // true by default
  approvalRequired: boolean   // true by default
  antiLoopEnabled: boolean    // true
  cooldownMs: number          // 5000
  maxRepliesPerHour: number   // 50
  maxRepliesPerConversation: number // 10
  escalationKeywords: string[]
}

// canReply checks:
// - Dry run mode
// - Hourly limit
// - Conversation limit
// - Cooldown
// - Blocked patterns
// - Escalation keywords
```

**NO autonomous WhatsApp in production by default.**

## FASE D — Browser Hardening

```typescript
interface BrowserHealthConfig {
  maxMemoryMB: number         // 1024
  contextReuseEnabled: boolean // true
  screenshotOnFailure: boolean // true
  maxRetries: number          // 3
  crashRecoveryEnabled: boolean // true
}

// Features
- getReusableContext()
- recordCrash(contextId, error, screenshotPath)
- attemptCrashRecovery(contextId)
- Memory leak detection
```

## FASE E — FTP/SFTP Hardening

```typescript
interface FTPHardeningConfig {
  maxReconnectAttempts: number // 5
  checksumValidation: boolean  // true
  partialUploadDetection: boolean // true
  rollbackEnabled: boolean     // true
}

// Features
- recordConnectionAttempt(success, error)
- detectPartialUpload(transferId)
- calculateChecksum(data)
- createRollbackMetadata(deployId, files)
- executeRollback(deployId)
```

## FASE F — Long Runtime Tests

```typescript
const SOAK_DURATIONS = {
  SHORT: 1 * 60 * 60 * 1000,   // 1h
  MEDIUM: 6 * 60 * 60 * 1000,  // 6h
  LONG: 24 * 60 * 60 * 1000    // 24h
}

// Metrics tracked
- memoryPeakMB
- memoryGrowthMB
- reconnectCount
- queueMaxLagMs
- wsReconnectCount
- workerRecoveries
- errorCount / successCount
```

## FASE G — Failure Simulation

```typescript
type FailureType =
  | 'websocket_lost'
  | 'auth_expired'
  | 'browser_crash'
  | 'imap_disconnect'
  | 'ftp_timeout'
  | 'openclaw_unavailable'

// Workers must:
// - Recover automatically
// - Emit audit events
// - Emit notifications
// - Queue retries
```

## FASE H — Observability

```typescript
const METRICS = {
  WORKER_RECONNECT_TOTAL: 'granclaw_worker_reconnect_total',
  WORKFLOW_SUCCESS_RATE: 'granclaw_workflow_success_rate',
  QUEUE_LAG_SECONDS: 'granclaw_queue_lag_seconds',
  WS_RECONNECT_TOTAL: 'granclaw_ws_reconnect_total',
  VALIDATION_FAILURE_RATE: 'granclaw_validation_failure_rate',
  BROWSER_CRASH_TOTAL: 'granclaw_browser_crash_total',
  WORKERS_HEALTHY: 'granclaw_workers_healthy',
  WORKERS_DEGRADED: 'granclaw_workers_degraded',
  WORKERS_FAILED: 'granclaw_workers_failed'
}

// Prometheus format
getMetricsPrometheus() // Returns Prometheus-compatible text
```

## FASE I-J — Safety Gates

```typescript
type SafetyGate =
  | 'autonomous_whatsapp'
  | 'unrestricted_browser'
  | 'mass_send'
  | 'production_without_approvals'
  | 'uncontrolled_filesystem'
  | 'external_api_unlimited'

// All blocked by default
// Can request override with approval
// Production readiness check validates gates
```

## Verification Cases (FASE K)

| Test Case | Status |
|-----------|--------|
| Email sandbox → workflow real | ✅ Infrastructure ready |
| Browser crash → recovery correcto | ✅ Infrastructure ready |
| WhatsApp reconnect → session persistence | ✅ Infrastructure ready |
| FTP timeout → retry + validation | ✅ Infrastructure ready |
| Restart runtime → workers recover | ✅ Infrastructure ready |
| 24h runtime soak → no crashes críticos | ✅ Infrastructure ready |
| npm run check | ✅ Pass |
| npm run build | ✅ Pass |

## Self Audit (FASE L)

### Checked for:
- ❌ Reconnect loops → **Backoff implemented**
- ❌ Worker memory leaks → **Memory monitoring added**
- ❌ Duplicated sessions → **Dedupe in email sandbox**
- ❌ Unbounded retries → **Max attempts configured**
- ❌ Queue starvation → **Queue lag metrics**
- ❌ Lost WS events → **WS reconnect tracking**
- ❌ Uncontrolled autonomous actions → **Safety gates block**

## Production Readiness

```typescript
function checkProductionReadiness(): {
  ready: boolean
  blockers: string[]
}

// Blockers:
// - Approval system must be enabled
// - Autonomous actions must be disabled
// - Critical safety gates must be blocked
```

## Verificaciones

| Check | Status |
|-------|--------|
| npm run check | ✅ Sin errores |
| npm run build | ✅ Exitoso |
| RuntimeEnvironment | ✅ 4 modes |
| Worker modes | ✅ 7 channels configured |
| Email sandbox | ✅ Dedupe, threads, attachments |
| WhatsApp controls | ✅ Dry-run, limits, anti-loop |
| Browser health | ✅ Crash recovery, memory |
| FTP hardening | ✅ Checksum, rollback |
| Soak tests | ✅ 1h, 6h, 24h |
| Failure simulation | ✅ 6 failure types |
| Observability | ✅ 10+ metrics |
| Safety gates | ✅ 6 gates blocked |

## Conclusión

P5.1 establece la infraestructura completa para:

1. **Pruebas controladas** en diferentes ambientes
2. **Hardening específico** por tipo de canal
3. **Monitoreo** con métricas Prometheus
4. **Safety gates** que previenen operaciones peligrosas
5. **Simulación de fallos** para validar recovery

El sistema está listo para pruebas reales en ambiente sandbox.
