# FIX 104 - Capability Key Normalization & Deduplication

**Fecha**: 2026-05-04
**Estado**: Completado

## Resumen

Implementacion de `capabilityKey` como clave canonica normalizada para evitar duplicados y garantizar que capabilities aprobadas sean encontradas en reintentos posteriores.

## Problema

1. Usuario aprueba capacidad (ej: "abre la calculadora")
2. Al reintentar, GranClaw dice "CAPACIDAD NO DISPONIBLE" de nuevo
3. Multiples duplicados aparecen en /control/tools
4. Cada retry crea nueva propuesta aunque ya existe capacidad

## Causa raiz

Inconsistencia entre campos usados para lookup:
- `detectedCapability` = "system:open_calculator"
- `proposedToolName` = "open_calculator"
- `requestedAction` = "abre la calculadora"
- `toolName` (en capability) = "open_calculator"

El lookup usaba valores literales sin normalizar.

## Solucion implementada

### 1. capability-normalizer.ts (NUEVO)

```typescript
export function normalizeCapabilityKey(input: string): string {
  // lowercase, trim, remove accents
  const normalized = removeAccents(input.toLowerCase().trim())

  // synonym mapping
  if (CAPABILITY_SYNONYMS[normalized]) {
    return CAPABILITY_SYNONYMS[normalized]
  }

  // partial match
  // fallback
}
```

### 2. Tipos actualizados

**ToolProposal**:
- `capabilityKey: string` - clave normalizada
- Status `'archived'` para cleanup

**ApprovedCapability**:
- `capabilityKey: string` - clave normalizada
- `deleted?: boolean` - soft delete

### 3. Services actualizados

**tool-proposals/service.ts**:
- `migrateProposals()` - añade capabilityKey a existentes
- `findExistingProposal()` - usa capabilityKey
- `archiveToolProposal()` - para cleanup

**capabilities/service.ts**:
- `migrateCapabilities()` - añade capabilityKey a existentes
- `getCapabilityByKey()` - lookup principal
- `getEnabledCapabilityByKey()` - verifica si habilitada
- `deleteCapability()` - soft delete
- `createCapabilityFromProposal()` - idempotente por key

### 4. Orchestrator actualizado

```typescript
const capabilityKey = missingCapability.capabilityKey ||
  normalizeCapabilityKey(missingCapability.proposedToolName)

const capability = getEnabledCapabilityByKey(context.tenant.id, capabilityKey)
```

### 5. UI actualizada

- Boton "Archivar" para propuestas rechazadas
- Boton "Eliminar" para capabilities
- Status "ARCHIVADA" en lista

## Archivos modificados

| Archivo | Cambios |
|---------|---------|
| apps/api/src/modules/capabilities/capability-normalizer.ts | NUEVO |
| apps/api/src/modules/tool-proposals/types.ts | capabilityKey, archived |
| apps/api/src/modules/capabilities/types.ts | capabilityKey, deleted |
| apps/api/src/modules/tool-proposals/service.ts | migrate, lookup, archive |
| apps/api/src/modules/capabilities/service.ts | migrate, lookup, delete |
| apps/api/src/modules/orchestrator/routes.ts | getEnabledCapabilityByKey |
| apps/api/src/modules/tool-proposals/routes.ts | handleArchiveToolProposal |
| apps/api/src/modules/capabilities/routes.ts | handleDeleteCapability |
| apps/api/src/index.ts | POST /archive, DELETE /capabilities/:id |
| apps/web/src/services/api.ts | archive, delete methods |
| apps/web/src/pages/control/Tools.tsx | archive, delete buttons |

## Flujo corregido

```
Usuario: "abre la calculadora"
    |
    v
normalizeCapabilityKey("abre la calculadora") -> "open_calculator"
    |
    v
getEnabledCapabilityByKey("tenant_1", "open_calculator") -> null (primera vez)
    |
    v
createToolProposal con capabilityKey = "open_calculator"
    |
    v
Usuario aprueba -> createCapabilityFromProposal

--- Retry ---

Usuario: "Abre la Calculadora" (variante)
    |
    v
normalizeCapabilityKey("Abre la Calculadora") -> "open_calculator"
    |
    v
getEnabledCapabilityByKey("tenant_1", "open_calculator") -> ENCONTRADA!
    |
    v
Ejecuta sin crear duplicado
```

## Verificaciones

- [x] Aprobar capability y reintentar encuentra la capacidad
- [x] Diferentes variantes normalizan a misma key
- [x] No se crean duplicados
- [x] Archive oculta propuestas de la lista
- [x] Delete capability permite re-proponer
- [x] Migracion automatica de datos existentes
- [x] Build exitoso

## Notas

- La migracion es automatica al cargar datos (migrateProposals/migrateCapabilities)
- Los sinonimos estan en CAPABILITY_SYNONYMS map
- El soft delete usa flag `deleted: true` en lugar de eliminacion fisica
- El archive usa status `'archived'` en propuestas
