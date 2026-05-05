# FIX 102: Missing Capability Detector Before OpenClaw

**Fecha**: 2026-05-04
**Estado**: Completado

## 1. Objetivo ejecutado

Corregir la integración del detector de capacidades faltantes para que se ejecute ANTES del orchestrator/OpenClaw y genere ToolProposal cuando corresponda.

Problema: Al pedir "abre el navegador", OpenClaw respondía "No puedo abrir..." pero GranClaw debería interceptar ANTES y mostrar "CAPACIDAD NO DISPONIBLE" + crear ToolProposal.

## 2. Causa raíz encontrada

El detector `detectMissingCapability` existía y estaba correctamente ubicado (después de Hub, antes de OpenClaw), pero **no cubría los patrones** para:
- Navegador: chrome, safari, firefox, edge, google, web
- Calculadora: calc, calculadora del sistema
- Aplicaciones específicas: word, excel, photoshop, finder, explorador
- Terminal: cmd, powershell, script

## 3. Archivos modificados

| Archivo | Cambios |
|---------|---------|
| apps/api/src/modules/tool-proposals/service.ts | Ampliar detector + añadir findExistingProposal |
| apps/api/src/modules/orchestrator/routes.ts | Import findExistingProposal + prevenir duplicados |

## 4. Nuevo orden del flujo

```
Usuario envía mensaje
    │
    ▼
1. Crear requestId / trace / debugSnapshot
    │
    ▼
2. Evaluar Hub
    │
    ├── Si Hub bloquea → devolver "blocked"
    │
    ▼
3. detectMissingCapability(message)
    │
    ├── Si NO detecta falta → 6. Llamar OpenClaw
    │
    ▼
4. Buscar ApprovedCapability enabled
    │
    ├── Si existe y enabled → Ejecutar capability segura
    │
    ▼
5. Buscar/Crear ToolProposal
    │
    ├── Si existe pending → Reutilizar
    ├── Si no existe → Crear nueva
    │
    ▼
   Devolver "Missing capability"
   (NO llama OpenClaw)
```

## 5. Patrones añadidos

### Editor de texto (open_text_editor)
```typescript
'abre editor', 'abrir editor', 'editor de texto', 'editor de notas',
'bloc de notas', 'notas' + 'abre', 'textedit', 'notepad',
'vscode', 'visual studio code', 'sublime', 'atom editor'
```

### Navegador web (open_web_browser)
```typescript
'abre navegador', 'abrir navegador', 'abre el navegador',
'abre chrome', 'abre safari', 'abre firefox', 'abre edge',
'abre una web', 'abre google', 'abre la web', 'abre internet'
```
- riskLevel: high
- requiresOsAccess: true
- requiresNetworkAccess: true

### Calculadora (open_calculator)
```typescript
'abre calculadora', 'abrir calculadora', 'abre la calculadora',
'calculadora del sistema', 'abre calc', 'abrir calc'
```
- riskLevel: high
- requiresOsAccess: true
- requiresNetworkAccess: false

### Aplicaciones locales (open_local_application)
```typescript
'abre photoshop', 'abre word', 'abre excel', 'abre powerpoint',
'abre finder', 'abre explorador', 'abre spotify', 'abre slack',
'abre discord', 'abre zoom', 'abre teams',
'abre la aplicacion', 'abrir aplicacion', 'lanzar aplicacion'
```
- riskLevel: high
- requiresOsAccess: true

### Terminal/Comandos (run_system_command)
```typescript
'abre terminal', 'abrir terminal', 'abre la terminal',
'ejecutar comando', 'ejecutar script', 'run command',
'consola' + 'abre', 'shell' + 'abre', 'cmd' + 'abre',
'powershell' + 'abre'
```
- riskLevel: high
- requiresOsAccess: true

## 6. Prevención de duplicados

Nueva función `findExistingProposal`:

```typescript
export function findExistingProposal(
  tenantId: string,
  proposedToolName: string,
  status?: ToolProposalStatus
): ToolProposal | null {
  const proposals = read<ToolProposal>(ENTITY)
  return proposals.find((p: ToolProposal) =>
    p.tenantId === tenantId &&
    p.proposedToolName === proposedToolName &&
    (status ? p.status === status : p.status === 'pending')
  ) || null
}
```

Uso en orchestrator:
```typescript
let proposal = findExistingProposal(context.tenant.id, missingCapability.proposedToolName, 'pending')

if (proposal) {
  console.log(`[GranClaw] Found existing proposal ${proposal.id}`)
} else {
  proposal = createToolProposal({ ... })
}
```

## 7. Pruebas realizadas

| Escenario | Esperado | Resultado |
|-----------|----------|-----------|
| "abre el navegador" | Missing capability + open_web_browser | ✅ |
| "abre la calculadora" | Missing capability + open_calculator | ✅ |
| "abre chrome" | Missing capability + open_web_browser | ✅ |
| "abre el editor" (sin capability) | Missing capability + open_text_editor | ✅ |
| "abre el editor" (con capability enabled) | Ejecuta capability segura | ✅ |
| "dame la hora de Australia" | Llama OpenClaw normal | ✅ |
| Dos veces "abre navegador" | No duplica proposals | ✅ |
| Build completo | Sin errores | ✅ |

## 8. Problemas encontrados

Ninguno. El flujo estaba correcto, solo faltaban patrones.

## 9. Pendiente recomendado

1. **Añadir más patrones**: cubrir más variantes coloquiales
2. **Detector inteligente**: usar LLM para detectar intención
3. **Configuración por tenant**: permitir personalizar patrones
4. **Métricas**: tracking de detecciones vs OpenClaw calls

## 10. Estado PROJECT_MEMORY.md

✅ Actualizado con:
- Reporte 102 en tabla
- Sección FIX 102 con causa raíz, solución, flujo y verificaciones
