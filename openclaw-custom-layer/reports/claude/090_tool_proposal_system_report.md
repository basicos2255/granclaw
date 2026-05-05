# REPORTE CLAUDE - FEATURE 090

## Tool Proposal System v1

---

## 1. Objetivo ejecutado

Implementar sistema seguro de propuestas de tools para GranClaw:
- Detectar cuando una acción solicitada no puede ejecutarse
- Crear propuesta de tool pendiente de aprobación
- Mostrar estado "CAPACIDAD NO DISPONIBLE" en UI
- Página de gestión de propuestas
- NO ejecutar tools automáticamente
- Base para expansión controlada de capacidades

---

## 2. Archivos creados

### Backend:
- `apps/api/src/modules/tool-proposals/types.ts`
- `apps/api/src/modules/tool-proposals/service.ts`
- `apps/api/src/modules/tool-proposals/routes.ts`
- `apps/api/src/modules/tool-proposals/index.ts`

### Frontend:
- `apps/web/src/pages/control/Tools.tsx`

---

## 3. Archivos modificados

### Backend:
- `apps/api/src/index.ts` (rutas tool-proposals)
- `apps/api/src/modules/orchestrator/routes.ts` (detectar capacidad, crear propuesta)
- `apps/api/src/modules/orchestrator/trace.ts` (source 'granclaw', 'error')

### Frontend:
- `apps/web/src/services/api.ts` (tipos ToolProposal, métodos API)
- `apps/web/src/pages/control/Execute.tsx` (toolProposalInfo, status missing_capability)
- `apps/web/src/components/control/SecurityResultPanel.tsx` (estado missing_capability)
- `apps/web/src/pages/control/index.ts` (export Tools)
- `apps/web/src/App.tsx` (ruta /control/tools, tab Tools)

---

## 4. Modelo ToolProposal

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

---

## 5. Persistencia aplicada

- Archivo: `data/tool-proposals.json`
- Usa módulo `storage/file-db` existente
- Funciones: `read`, `write`, `getById`
- CRUD completo con filtros por tenant/status

---

## 6. Integración con ejecución

En `orchestrator/routes.ts`:

```typescript
// Después de Hub permitir, antes de ejecutar
const missingCapability = detectMissingCapability(input.message)
if (missingCapability) {
  // Crear propuesta
  const proposal = createToolProposal({...})

  // Trace + debugSnapshot
  trace.addStep({ stage: 'tool', status: 'blocked', label: 'Capacidad no disponible' })
  debugSnapshot.source = 'granclaw'
  debugSnapshot.error = 'Missing capability'

  // Respuesta con meta.toolProposalId
  return ok(res, {
    success: false,
    error: 'Missing capability',
    meta: { toolProposalId, missingCapability, proposedTool, riskLevel, ... }
  })
}
```

---

## 7. Cambios frontend

### SecurityResultPanel:
- Nuevo estado `missing_capability`
- Color púrpura (#7c3aed)
- Título: "CAPACIDAD NO DISPONIBLE"
- Panel con: tool propuesta, riesgo, capacidad
- Enlace a /control/tools

### Execute.tsx:
- Extrae toolProposalId, missingCapability de meta
- Construye toolProposalInfo
- Detecta status missing_capability
- Pasa toolProposalInfo a SecurityResultPanel

### Tools.tsx:
- Lista propuestas con colores por status
- Modal de detalle completo
- Botones aprobar/rechazar
- Mensaje al aprobar: "Implementación real en fase posterior"

---

## 8. Seguridad aplicada

| Regla | Implementación |
|-------|----------------|
| No ejecutar tool propuesta | Solo crear ToolProposal |
| Approval no ejecuta | Solo cambia status |
| OS access = high risk | Detector marca high |
| No código ejecutable | suggestedImplementation es texto |
| No inyección | No eval, no ejecución |

---

## 9. Casos probados

| Escenario | Esperado | Estado |
|-----------|----------|--------|
| "abre el editor de texto" | Propuesta high risk | ✅ |
| "crear archivo en escritorio" | Propuesta file_write | ✅ |
| acción normal soportada | Ejecuta normal | ✅ |
| approve propuesta | Status approved, no ejecuta | ✅ |
| reject propuesta | Status rejected | ✅ |
| Build completo | Sin errores TS | ✅ |

---

## 10. Problemas encontrados

1. **Import incorrecto**: `../../shared/file-db` → `../../storage/file-db`
2. **Source type**: Faltaba 'granclaw' en DebugSnapshot.source
3. **Tipos implícitos**: Añadidos tipos explícitos en service.ts

---

## 11. Pendiente recomendado

1. **IA proponer tools**: Usar LLM para sugerir implementaciones
2. **Activar tools**: Flujo seguro para activar tools aprobadas
3. **Tool registry**: Módulo de tools activas
4. **Sandbox**: Ejecución controlada de tools
5. **Permisos granulares**: Roles para aprobar tools
6. **Audit log**: Registro de aprobaciones/rechazos
7. **Webhooks**: Notificar cuando se crea propuesta

---

## 12. Estado PROJECT_MEMORY.md

✅ Actualizado con:
- Sección `## FEATURE 090 - Tool Proposal System v1`
- Modelo ToolProposal documentado
- Endpoints documentados
- Detector de capacidad documentado
- Cambios frontend documentados
- Verificaciones listadas

---

**Fecha**: 2026-05-03
**Implementado por**: Claude (Opus 4.5)
**Estado**: ✅ COMPLETADO
