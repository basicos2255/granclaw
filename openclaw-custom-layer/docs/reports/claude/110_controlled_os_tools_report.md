# REPORTE CLAUDE

## FEATURE 110 - Controlled OS Tools v1 + Human Output Mode

**Fecha**: 2026-05-05
**Estado**: Completado

---

## 1. Objetivo ejecutado

Implementar acceso controlado a aplicaciones del SO mediante:
- Whitelist de aplicaciones permitidas por plataforma
- Ejecución segura via spawn (no exec)
- Integración con sistema de capabilities
- Output normalizer para respuestas human-readable

---

## 2. Módulo OS Tools creado

### Estructura

```
apps/api/src/modules/os-tools/
├── types.ts          # Tipos y interfaces
├── os-whitelist.ts   # Whitelist por plataforma
├── os-executor.ts    # Executor con spawn
├── routes.ts         # Handlers HTTP
└── index.ts          # Exports
```

### types.ts

```typescript
export type OSCapabilityKey =
  | 'open_calculator'
  | 'open_web_browser'
  | 'open_text_editor_os'
  | 'open_file_explorer'
  | 'open_terminal'

export type Platform = 'darwin' | 'win32' | 'linux'

export interface OSToolConfig {
  capabilityKey: OSCapabilityKey
  displayName: string
  description: string
  riskLevel: 'low' | 'medium' | 'high'
  requiresConfirmation: boolean
  platforms: {
    darwin?: OSToolCommand
    win32?: OSToolCommand
    linux?: OSToolCommand
  }
}

export interface OSExecutionResult {
  success: boolean
  capabilityKey: OSCapabilityKey
  platform: Platform
  command: string
  args: string[]
  exitCode?: number
  error?: string
  executedAt: string
  durationMs: number
}
```

### os-whitelist.ts

```typescript
export const OS_TOOLS_WHITELIST: Record<OSCapabilityKey, OSToolConfig> = {
  open_calculator: {
    capabilityKey: 'open_calculator',
    displayName: 'Calculadora',
    riskLevel: 'low',
    requiresConfirmation: false,
    platforms: {
      darwin: { command: 'open', args: ['-a', 'Calculator'] },
      win32: { command: 'calc.exe', args: [] },
      linux: { command: 'gnome-calculator', args: [] }
    }
  },
  // ... otras herramientas
}
```

### os-executor.ts

```typescript
export async function executeOSTool(
  capabilityKey: OSCapabilityKey,
  platform?: Platform
): Promise<OSExecutionResult> {
  // Usa spawn con detached: true, stdio: 'ignore'
  const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
    shell: false  // Más seguro
  })
  child.unref()  // Proceso independiente
}
```

---

## 3. Integración con Orchestrator

### orchestrator/routes.ts

```typescript
// Import
import { isOSToolCapability, executeOSTool, getOSToolConfig, type OSCapabilityKey } from '../os-tools'

// Nuevo caso en executeCapabilitySafeV1
case 'open_calculator':
case 'open_web_browser':
case 'open_text_editor_os':
case 'open_file_explorer':
case 'open_terminal': {
  const capKey = capability.capabilityKey || capability.toolName;
  const osConfig = getOSToolConfig(capKey);

  // Fire and forget para apps GUI
  executeOSTool(capKey as OSCapabilityKey).then(result => {
    if (result.success) {
      console.log(`[GranClaw Capability] OS tool launched: ${osConfig.displayName}`);
    }
  });

  return {
    success: true,
    result: {
      type: 'action',
      title: osConfig.displayName,
      message: `${osConfig.displayName} se esta abriendo...`,
      description: osConfig.description,
      capabilityId: capability.id,
      osToolKey: capKey
    },
    mode: 'capability'
  };
}
```

---

## 4. Output Normalizer

### orchestrator/output-normalizer.ts

```typescript
export type NormalizedOutputType = 'text' | 'action' | 'document' | 'info' | 'error' | 'approval_needed'

export interface NormalizedOutput {
  type: NormalizedOutputType
  title: string
  message: string
  details?: string
  raw?: unknown
}

export function normalizeOutput(response: OrchestratorResponse): NormalizedOutput {
  // Convierte respuestas estructuradas a formato human-readable
  // Maneja: errors, approval_needed, capability results, direct text
}

export function extractPlainText(normalized: NormalizedOutput): string {
  // Extrae texto plano para display simple
}

export function needsApproval(response: OrchestratorResponse): boolean {
  // Detecta si requiere acción del usuario
}
```

---

## 5. Endpoints nuevos

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | /os-tools | Lista herramientas OS con soporte de plataforma |
| POST | /os-tools/confirm | Confirma/rechaza ejecución pendiente |
| POST | /os-tools/cleanup | Limpia confirmaciones expiradas |

### index.ts

```typescript
// FEATURE 110: OS Tools
import { handleGetOSTools, handleConfirmOSTool, handleCleanupOSTools } from './modules/os-tools'

// GET routes
'/os-tools': handleGetOSTools

// POST routes
'/os-tools/confirm': handleConfirmOSTool,
'/os-tools/cleanup': handleCleanupOSTools
```

---

## 6. Flujo de ejecución

```
Usuario: "abre la calculadora"
    ↓
detectMissingCapability() → { capabilityKey: "open_calculator" }
    ↓
getEnabledCapabilityByKey("tenant_1", "open_calculator")
    ↓
Si no aprobada → createToolProposal() → pendiente aprobación
Si aprobada → executeCapabilitySafeV1()
    ↓
case 'open_calculator':
    ↓
executeOSTool("open_calculator") → spawn("calc.exe", [])
    ↓
Respuesta: { type: 'action', message: "Calculadora se esta abriendo..." }
```

---

## 7. Seguridad

1. **Whitelist estricta**: Solo apps definidas en OS_TOOLS_WHITELIST
2. **spawn vs exec**: spawn es más seguro, no usa shell
3. **Integración capabilities**: Requiere aprobación previa
4. **Modo strict**: Herramientas medium/high risk requieren confirmación
5. **Timeout**: Confirmaciones expiran en 5 minutos
6. **Aislamiento**: Procesos GUI se lanzan detached

---

## 8. Archivos creados/modificados

### Creados

| Archivo | Líneas |
|---------|--------|
| os-tools/types.ts | ~90 |
| os-tools/os-whitelist.ts | ~130 |
| os-tools/os-executor.ts | ~180 |
| os-tools/routes.ts | ~200 |
| os-tools/index.ts | ~20 |
| orchestrator/output-normalizer.ts | ~180 |

### Modificados

| Archivo | Cambios |
|---------|---------|
| index.ts | +import, +3 rutas |
| orchestrator/routes.ts | +import, +50 líneas case OS tools |
| orchestrator/index.ts | +export output-normalizer |

---

## 9. Verificaciones

- [x] Módulo os-tools creado completo
- [x] Whitelist definida para 3 plataformas
- [x] OS executor usa spawn (no exec)
- [x] Rutas registradas en index.ts
- [x] Integración con orchestrator completada
- [x] Output normalizer implementado
- [x] Build TypeScript exitoso

---

## 10. Próximos pasos (sugeridos)

1. **Frontend OutputViewer.tsx**: Componente para mostrar respuestas normalizadas
2. **Tests**: Unit tests para os-executor y output-normalizer
3. **Modo strict UI**: Modal de confirmación para herramientas riskLevel medium/high
4. **Extensión whitelist**: Agregar más aplicaciones según necesidad
