# FEATURE 091: Approved Capabilities v1

**Fecha**: 2026-05-03
**Estado**: Completado

## Resumen

Implementado el sistema de capacidades aprobadas que permite:
1. Crear una `ApprovedCapability` al aprobar una `ToolProposal`
2. Ejecutar capacidades aprobadas con comportamiento "safe v1" (sin acceso real a OS)
3. Habilitar/deshabilitar capacidades individualmente
4. Visualizar resultados de capacidades en el frontend

## Flujo de Operación

```
Usuario pide: "Abre el editor de texto"
        |
        v
detectMissingCapability() -> open_text_editor
        |
        v
getCapabilityByToolName() -> Busca capability aprobada
        |
        |--- Si no existe: crear ToolProposal, devolver missing_capability
        |
        |--- Si existe y enabled=true:
                |
                v
        executeCapabilitySafeV1() -> Ejecutar comportamiento safe
                |
                v
        Devolver result.type='document' con contenido web
```

## Backend

### Módulo capabilities

**apps/api/src/modules/capabilities/**

```
types.ts      - ApprovedCapability, RiskLevel types
service.ts    - CRUD + getByToolName, createFromProposal
routes.ts     - HTTP handlers para enable/disable
index.ts      - Exports
```

### Tipos

```typescript
interface ApprovedCapability {
  id: string
  tenantId: string
  proposalId: string
  toolName: string
  description: string
  riskLevel: 'low' | 'medium' | 'high'
  requiresOsAccess: boolean
  requiresNetworkAccess: boolean
  enabled: boolean
  createdAt: string
  updatedAt: string
}
```

### Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | /capabilities | Lista capabilities del tenant |
| GET | /capabilities/:id | Obtiene capability por ID |
| POST | /capabilities/:id/enable | Habilita capability |
| POST | /capabilities/:id/disable | Deshabilita capability |

### Integración con approval

El endpoint `POST /tool-proposals/:id/approve` ahora:
1. Cambia status de proposal a 'approved'
2. Crea `ApprovedCapability` asociada (si no existe)
3. Devuelve `{ proposal, capability, message }`

### Integración con ejecución

En `orchestrator/routes.ts`:
1. Se detecta capacidad faltante con `detectMissingCapability()`
2. Se busca capability con `getCapabilityByToolName()`
3. Si existe y está habilitada, se ejecuta `executeCapabilitySafeV1()`
4. El resultado contiene `{ type: 'document', title, content, format, editable }`

### Comportamiento Safe v1

Para cada capability, se define un comportamiento seguro:

| Capability | Comportamiento v1 |
|------------|-------------------|
| open_text_editor | Devuelve documento editable en web |
| write_local_file | Devuelve documento de vista previa |
| read_local_file | Devuelve mensaje informativo |
| (otros) | Devuelve info con descripción |

## Frontend

### API Methods

```typescript
api.getCapabilities()           // GET /capabilities
api.getCapability(id)           // GET /capabilities/:id
api.enableCapability(id)        // POST /capabilities/:id/enable
api.disableCapability(id)       // POST /capabilities/:id/disable
api.approveToolProposal(id)     // Ahora devuelve { proposal, capability }
```

### Tools.tsx Actualizado

- Carga capabilities junto con proposals
- Muestra indicador ACTIVA/INACTIVA en lista
- Modal muestra estado de capability con botón enable/disable
- Color amarillo para deshabilitada, verde para habilitada

### OutputViewer Component

Nuevo componente para renderizar resultados de capabilities:
- Soporta tipo 'document' (con edición opcional)
- Soporta tipo 'info' (mensaje informativo)
- Muestra capability ID, formato, título

### Execute.tsx Integración

- Detecta cuando result contiene capability output
- Renderiza `OutputViewer` después de `SecurityResultPanel`
- Pasa capabilityName desde meta

## Archivos Modificados

### Backend
- `apps/api/src/modules/capabilities/` (nuevo módulo)
- `apps/api/src/modules/tool-proposals/routes.ts` - Integración approval
- `apps/api/src/modules/orchestrator/routes.ts` - Ejecución capabilities
- `apps/api/src/index.ts` - Endpoints capabilities

### Frontend
- `apps/web/src/services/api.ts` - Types y methods
- `apps/web/src/pages/control/Tools.tsx` - UI capabilities
- `apps/web/src/components/control/OutputViewer.tsx` (nuevo)
- `apps/web/src/components/control/index.ts` - Export
- `apps/web/src/pages/control/Execute.tsx` - Render output

## Verificación

### Build
```
npm run build
> tsc && vite build
✓ built in 2.22s
```

## Decisiones de Diseño

1. **Safe v1**: No ejecutar nada real en OS, solo devolver contenido web
2. **Enabled por defecto**: Nueva capability se crea con `enabled: true`
3. **Sin duplicación**: Si capability ya existe para proposal, se devuelve existente
4. **Tenant isolation**: Capabilities filtradas por tenantId
5. **Separation**: Proposal es la solicitud, Capability es la autorización activa

## Próximos Pasos

- FEATURE 092: Implementación real de capabilities (con confirmación)
- FEATURE 093: Guardar ediciones de OutputViewer
- FEATURE 094: Historial de uso de capabilities
- FEATURE 095: Límites de uso por capability
