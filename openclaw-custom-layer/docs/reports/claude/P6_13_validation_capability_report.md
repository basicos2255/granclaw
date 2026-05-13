# P6.13 — Validation Explainability, Capability Readiness & Real Download Diagnostics

**Date**: 2026-05-13
**Status**: COMPLETED
**Auditor**: Claude Code

## 1. Objetivo Ejecutado

Transformar el mensaje genérico "Error via validation" en explicaciones humanas claras que indiquen:
- Qué falló
- Por qué falló
- Qué capacidad estaba involucrada
- Qué acciones puede tomar el usuario

## 2. Problema Observado

En `/tasks` se mostraba:
```
Estado: Error
Fuente: via validation
Input: "descarga un programa random freeware"
```

Sin explicación de:
- Qué se intentó hacer
- Qué step falló
- Si browser/download existe realmente
- Si faltó artifact
- Si requiere aprobación
- Si la capability no está lista

## 3. Validation Audit

### Flujo Original
1. `validateExecutionEvidence()` detecta missing evidence
2. Returns `missingEvidence: ['artifacts required but not generated']`
3. Task gets `status: 'error'`, `source: 'validation'`
4. UI shows "via validation" - user has no idea what happened

### Problemas Identificados
| Problema | Impacto |
|----------|---------|
| Missing evidence strings son técnicos | Usuario no entiende |
| No hay recovery actions | Usuario no sabe qué hacer |
| No hay capability check | No se sabe si download/browser existe |
| "via validation" es genérico | No explica nada |

## 4. Failure Reason Model

### Canonical Codes
```typescript
type ValidationFailureReason =
  | 'missing_required_artifact'
  | 'missing_required_output'
  | 'missing_execution_evidence'
  | 'provider_unavailable'
  | 'capability_not_configured'
  | 'capability_not_implemented'
  | 'permission_required'
  | 'approval_required'
  | 'download_failed'
  | 'browser_failed'
  | 'planner_failed'
  | 'no_actions_executed'
  | 'mock_provider_used'
  | 'unknown'
```

### TaskFailureExplanation
```typescript
interface TaskFailureExplanation {
  code: ValidationFailureReason
  title: string              // "No se completó la descarga"
  humanMessage: string       // "La tarea requería descargar un archivo..."
  technicalMessage?: string  // "artifacts required but not generated"
  capability?: string        // "download"
  requiredArtifact?: string  // "Archivo descargado"
  recoveryActions: RecoveryAction[]
  canRetry: boolean
  canRepair: boolean
  canReplan: boolean
}
```

## 5. Capability Readiness

### New Endpoints
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /capabilities/readiness | All capabilities status |
| GET | /capabilities/:cap/readiness | Specific capability status |
| POST | /capabilities/:cap/test | Test capability |

### Implementation Status
```typescript
const CAPABILITY_IMPLEMENTATION_STATUS = {
  browser: { implemented: false, provider: 'playwright', ... },
  download: { implemented: false, provider: 'browser', ... },
  filesystem: { implemented: true, provider: 'node', ... },
  web_search: { implemented: true, provider: 'openclaw', ... },
  // etc.
}
```

### CapabilityReadiness Response
```json
{
  "capability": "download",
  "available": false,
  "configured": false,
  "implemented": false,
  "provider": "browser",
  "requiresApproval": true,
  "missingSetup": ["Download directory not configured"],
  "health": "unavailable",
  "statusMessage": "La capacidad 'download' aún no está implementada en GranClaw."
}
```

## 6. Download/Browser Diagnostics

### For "descarga un programa random freeware":
1. `determineCapabilityFromInput()` → "download"
2. `getCapabilityReadiness("download")` → `implemented: false`
3. Task fails with:
   - `code: 'capability_not_implemented'`
   - `title: 'Capacidad no disponible'`
   - `humanMessage: 'Esta capacidad aún no está implementada en GranClaw.'`

### Safe Download Flow (for when implemented)
1. Detect download intent
2. Check capability readiness
3. If not available → return clear error with setup instructions
4. If available → validate source URL
5. Require approval for unknown sources
6. Download to sandboxed directory
7. Validate artifact exists
8. Report success with artifact reference

## 7. Safe Download Flow

Implemented via P6.11R guards + P6.13 capability check:
1. `isStepSafeForSimpleExecution()` blocks dangerous patterns
2. Capability readiness check blocks if not implemented
3. Clear error message tells user capability is not available
4. No fake downloads or simulated artifacts

## 8. Tasks Page UX

### Before
```
[Error] via validation
descarga un programa...
```

### After
```
┌─────────────────────────────────────────────────┐
│ [Error]                                         │
├─────────────────────────────────────────────────┤
│ No se completó la descarga                      │
│ La tarea requería descargar un archivo, pero    │
│ no se generó ningún archivo descargado.         │
│                                                 │
│ Capacidad: download                             │
└─────────────────────────────────────────────────┘
```

## 9. Task Detail UX

### New Sections
```
┌─ Qué pasó ──────────────────────────────────────┐
│ No se completó la descarga                      │
├─────────────────────────────────────────────────┤
│ La tarea requería descargar un archivo...       │
├─ Qué faltó ─────────────────────────────────────┤
│ [Capacidad: download] [Artifact: Archivo...]    │
├─ Qué puedes hacer ──────────────────────────────┤
│ [Configurar descarga] [Proporcionar URL]        │
├─ Detalles técnicos ▼ ───────────────────────────┤
│ artifacts required but not generated            │
└─────────────────────────────────────────────────┘
```

## 10. Recovery Actions

| Failure Code | Recovery Actions |
|--------------|------------------|
| missing_required_artifact | Configurar capacidad, Reintentar, Ver detalles |
| capability_not_implemented | Ver detalles, Cancelar |
| capability_not_configured | Configurar ahora, Probar capacidad |
| download_failed | Reintentar con navegador, Cambiar URL |
| no_actions_executed | Dar más detalles, Verificar capacidades |

## 11. Casos Probados

| Caso | Resultado |
|------|-----------|
| "descarga un programa..." | Shows "Capacidad no disponible" |
| Missing artifact validation | Shows "No se completó la descarga" |
| GET /capabilities/readiness | Returns all capabilities status |
| GET /capabilities/download/readiness | Returns download status |

## 12. npm run check

```
✅ API check passed
✅ Web check passed
```

## 13. npm run build

```
✅ Build successful
```

## 14. Riesgos Restantes

1. **Download/Browser no implementados**: Devuelven error claro pero no funcionan realmente
2. **Approval flow**: No implementado aún para descargas de fuentes desconocidas
3. **Real artifact validation**: Depende de implementación real de capabilities

## 15. Estado PROJECT_MEMORY.md

Actualizado con P6.13 incluyendo:
- Validation failure reasons
- Task failure explanations
- Capability readiness endpoints
- Download/browser readiness
- Recovery actions
- Human task error UX
- Safe download flow

## Archivos Modificados

| Archivo | Líneas | Propósito |
|---------|--------|-----------|
| tasks/types.ts | +80 | Failure types |
| tasks/service.ts | +280 | Failure explanation builder |
| capabilities/types.ts | +45 | Readiness types |
| capabilities/service.ts | +150 | Readiness functions |
| capabilities/routes.ts | +90 | Readiness endpoints |
| capabilities/index.ts | +6 | New exports |
| index.ts | +10 | Route registration |
| web/api.ts | +30 | Frontend types |
| TasksPage.tsx | +30 | Error display |
| TaskDetailPage.tsx | +100 | Full explanation section |

## Reportes Generados

1. `P6_13_validation_explainability_audit.md` - Initial audit
2. `P6_13_self_audit.md` - Final verification
3. `P6_13_validation_capability_report.md` - This report
