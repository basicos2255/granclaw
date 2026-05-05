# REPORTE CLAUDE

## FIX 105 - Canonical Capability Groups & Cleanup

**Fecha**: 2026-05-04
**Estado**: Completado

---

## 1. Objetivo ejecutado

Corregir definitivamente el bug de capabilities duplicadas/no reconocidas y limpiar la UX de /control/tools:
- Usar tenantId + capabilityKey como verdad única
- Agrupar Tools por capabilityKey
- Approval usa capabilityKey como lookup principal
- Retry reconoce capabilities aprobadas
- Cleanup de duplicados
- Acciones activar/desactivar/eliminar visibles
- Manejar sesión expirada

---

## 2. Causa raíz real encontrada

1. **Lookup visual usaba proposalId**: `getCapabilityForProposal(proposalId)` fallaba cuando capability existía por otra proposal de la misma capabilityKey.

2. **Orchestrator no distinguía estados**: Solo verificaba `getEnabledCapabilityByKey`, no diferenciaba entre disabled e inexistente.

3. **Sin deduplicación**: Múltiples proposals y capabilities para la misma capabilityKey se acumulaban sin limpieza.

4. **401 no manejado**: Sesión expirada causaba llamadas repetidas sin aviso al usuario.

---

## 3. Backend modificado

### orchestrator/routes.ts
```typescript
// FIX 105: Diagnostic logs y lookup completo
const capabilityAny = getCapabilityByKey(context.tenant.id, capabilityKey)
const capabilityEnabled = getEnabledCapabilityByKey(context.tenant.id, capabilityKey)

console.log(`[Capability Lookup] capabilityFound=${!!capabilityAny}`)
console.log(`[Capability Lookup] enabled=${capabilityAny?.enabled ?? false}`)

// Case A: enabled -> execute
// Case B: disabled -> return error with capabilityId
// Case C/D/E/F: no capability -> check proposals
```

### tool-proposals/routes.ts
```typescript
// FIX 105: Buscar capability por capabilityKey (no proposalId)
const capabilityKey = proposal.capabilityKey || normalizeCapabilityKey(proposal.proposedToolName)
let existingCapability = getCapabilityByKey(context.tenant.id, capabilityKey)

if (existingCapability) {
  // Reutilizar capability existente, no crear duplicado
}
```

### capabilities/service.ts
```typescript
// FIX 105: Deduplica capabilities por tenantId + capabilityKey
export function deduplicateCapabilities(tenantId?: string): { deleted: number; kept: number }
```

### tool-proposals/service.ts
```typescript
// FIX 105: Deduplica proposals
export function deduplicateProposals(tenantId, hasCapabilityForKey): { archived: number; kept: number }
```

### POST /tool-proposals/cleanup
- Ejecuta deduplicación
- Devuelve: `{ archivedProposals, deletedCapabilities, keptCapabilities, keptProposals }`

---

## 4. Frontend modificado

### api.ts
```typescript
// FIX 105: Handle 401 status
if (response.status === 401) {
  clearToken()
  window.dispatchEvent(new CustomEvent('session-expired'))
  return { success: false, error: 'Sesion expirada...' }
}

// FIX 105: Cleanup endpoint
cleanupToolProposals: async () => postRequest('/tool-proposals/cleanup', {})
```

### Tools.tsx - Completamente reescrito
- **ToolGroup**: Agrupa proposals por capabilityKey
- **normalizeKey**: Normalización frontend
- **toolGroups**: useMemo para agrupar
- **getCapabilityForKey**: Busca por capabilityKey, no proposalId
- **Tarjetas**: Una por capabilityKey con acciones visibles
- **Botón Limpiar duplicados**: En header
- **Session expired listener**: Muestra aviso

---

## 5. Limpieza/deduplicación aplicada

### Capabilities
- Agrupa por tenantId + capabilityKey
- Mantiene: primera enabled o más reciente
- Marca duplicadas: deleted=true, enabled=false

### Proposals
- Si existe capability activa: archiva proposals pending
- Si no: mantiene la más relevante (approved > pending > rejected)
- Archiva el resto

---

## 6. Cambios UX visibles

### Antes
- Lista de proposals individuales
- Acciones solo en modal
- Duplicados visibles
- Sin cleanup
- 401 silencioso

### Después
- Una tarjeta por capabilityKey
- Acciones directas en tarjeta: Aprobar, Rechazar, Activar, Desactivar, Eliminar, Archivar
- Badge "X solicitudes" si hay múltiples
- Botón "Limpiar duplicados"
- Toast "Sesión expirada. Inicia sesión de nuevo."

---

## 7. Casos probados

- [x] "abre la calculadora" -> una entrada open_calculator
- [x] Aprobar desde /control -> aparece aprobada
- [x] Reintentar -> NO vuelve a pedir aprobar
- [x] Desactivar -> reintentar muestra "Capacidad desactivada"
- [x] Tools muestra una tarjeta por capabilityKey
- [x] Limpiar duplicados -> compacta sin romper activas
- [x] Build exitoso

---

## 8. Problemas encontrados

1. **Type error en api.ts**: `handleUnauthorized` recibía ApiResponse con error: null. Solucionado pasando objeto con error string.

2. **Replace_all necesario**: Orchestrator tiene mismo código en handleOrchestratorRun y handleOrchestratorRunStream.

---

## 9. Estado PROJECT_MEMORY.md

Actualizado con:
- Nueva entrada en tabla de decisiones
- Sección completa FIX 105 con:
  - Problema
  - Causa raíz
  - Principio (tenantId + capabilityKey)
  - Solución
  - Archivos modificados
  - Verificaciones
