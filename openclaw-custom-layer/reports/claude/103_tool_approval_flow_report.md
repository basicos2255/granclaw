# FIX 103: Tool Approval Flow & Return Context

**Fecha**: 2026-05-04
**Estado**: Completado

## 1. Problema reportado

1. Error al aprobar ToolProposal desde /control/tools
2. Después de aprobar, el usuario debía navegar manualmente y repetir el mensaje
3. No había forma de aprobar inline desde la pantalla de Control

## 2. Causa raíz

El backend envuelve respuestas con `ok(res, data)`:
```typescript
{ success: true, data: { proposal, capability, message }, error: null }
```

Pero el frontend verificaba incorrectamente:
```typescript
// Incorrecto - busca 'proposal' en el objeto envuelto
if (response && 'proposal' in response)

// Correcto - verifica success y luego data
if (response.success && response.data?.proposal)
```

## 3. Archivos modificados

| Archivo | Cambios |
|---------|---------|
| apps/api/src/modules/tool-proposals/routes.ts | Idempotente: ya aprobada → éxito, rechazada → error |
| apps/web/src/services/api.ts | approveToolProposal/rejectToolProposal devuelven ApiResponse |
| apps/web/src/pages/control/Tools.tsx | Verificar response.success && response.data |
| apps/web/src/components/control/SecurityResultPanel.tsx | Aprobar inline + callback onRetry |
| apps/web/src/pages/control/Execute.tsx | Guardar lastMessage, pasar onRetry |

## 4. Backend idempotente

```typescript
// Si ya está aprobada, devolver éxito con datos existentes
if (proposal.status === 'approved') {
  const existingCapability = getCapabilityByProposalId(proposalId)
  if (existingCapability) {
    ok(res, {
      proposal,
      capability: existingCapability,
      message: 'Propuesta ya estaba aprobada.'
    })
    return
  }
  // Si por algún motivo no hay capability, crearla
  const newCapability = createCapabilityFromProposal(proposal)
  ok(res, {
    proposal,
    capability: newCapability,
    message: 'Propuesta ya aprobada. Capability creada.'
  })
  return
}

// Si está rechazada, no permitir aprobar
if (proposal.status === 'rejected') {
  notFound(res, 'No se puede aprobar una propuesta rechazada')
  return
}
```

## 5. API wrapper corregido

```typescript
// Antes (incorrecto)
approveToolProposal: (id: string) =>
  postRequestProtected<ApproveProposalResponse>(`/tool-proposals/${id}/approve`, {})

// Después (correcto)
approveToolProposal: async (id: string): Promise<ApiResponse<ApproveProposalResponse>> => {
  if (!isAuthenticated()) {
    return { success: false, data: null, error: 'Debes iniciar sesion' }
  }
  const response = await postRequest<ApiResponse<ApproveProposalResponse>>(
    `/tool-proposals/${id}/approve`,
    {}
  )
  return response
}
```

## 6. Tools.tsx corregido

```typescript
// Antes
if (response && 'proposal' in response) {
  setNotice({ message: 'Capacidad aprobada correctamente', type: 'success' })
} else {
  setNotice({ message: 'Error al aprobar propuesta', type: 'error' })
}

// Después
if (response.success && response.data?.proposal) {
  setNotice({ message: 'Capacidad aprobada correctamente', type: 'success' })
} else {
  setNotice({ message: response.error || 'Error al aprobar propuesta', type: 'error' })
}
```

## 7. Aprobar inline desde Control

Nuevos estados en SecurityResultPanel:
```typescript
const [approving, setApproving] = useState(false)
const [approveResult, setApproveResult] = useState<'success' | 'error' | null>(null)
const [approveError, setApproveError] = useState<string | null>(null)
```

Handler de aprobación inline:
```typescript
const handleApproveInline = async () => {
  if (!toolProposalInfo?.toolProposalId || approving) return
  setApproving(true)
  try {
    const response = await api.approveToolProposal(toolProposalInfo.toolProposalId)
    if (response.success && response.data?.proposal) {
      setApproveResult('success')
    } else {
      setApproveResult('error')
      setApproveError(response.error || 'Error al aprobar')
    }
  } catch {
    setApproveResult('error')
    setApproveError('Error de conexión')
  } finally {
    setApproving(false)
  }
}
```

## 8. Reintentar sin perder contexto

En Execute.tsx:
```typescript
// Guardar último mensaje
const [lastMessage, setLastMessage] = useState<string | null>(null)

const handleExecute = async (message: string) => {
  setLastMessage(message)  // Guardar para retry
  // ... ejecutar
}

// Función de retry
const handleRetry = () => {
  if (lastMessage) {
    handleExecute(lastMessage)
  }
}

// Pasar a SecurityResultPanel
<SecurityResultPanel
  onRetry={result.status === 'missing_capability' ? handleRetry : undefined}
/>
```

## 9. Flujo UX mejorado

```
Usuario: "abre el navegador"
    ↓
GranClaw: "CAPACIDAD NO DISPONIBLE"
    ↓ [Botón: ✓ Aprobar ahora] [Botón: Ver detalle →]
Usuario: Click "Aprobar ahora"
    ↓
GranClaw: "✓ Aprobada" [Botón: 🔄 Reintentar acción]
    ↓
Usuario: Click "Reintentar acción"
    ↓
GranClaw: Ejecuta "abre el navegador" con capability habilitada
```

## 10. Estados visuales

| Estado | Background | Borde | Botones |
|--------|------------|-------|---------|
| Pendiente | #f5f3ff (violeta claro) | #7c3aed | Aprobar, Ver detalle |
| Aprobando | #f5f3ff | #7c3aed | (Aprobando...) disabled |
| Aprobada | #dcfce7 (verde claro) | #16a34a | ✓ Aprobada, Reintentar |
| Error | #f5f3ff | #7c3aed | Error msg, Reintentar aprobar |

## 11. Pruebas realizadas

| Escenario | Resultado |
|-----------|-----------|
| Aprobar desde Tools.tsx | ✅ |
| Aprobar inline desde Control | ✅ |
| Reintentar después de aprobar | ✅ |
| Aprobar propuesta ya aprobada (idempotente) | ✅ |
| Aprobar propuesta rechazada | ✅ Error controlado |
| Error de red al aprobar | ✅ Muestra error legible |
| Build completo | ✅ |

## 12. Pendiente recomendado

1. **Aprobar + ejecutar automáticamente**: opción para ejecutar inmediatamente tras aprobar
2. **Confirmación antes de aprobar**: modal de confirmación para riesgo alto
3. **Historial de aprobaciones**: log de quién aprobó qué y cuándo
4. **Notificaciones**: toast más prominente al aprobar
