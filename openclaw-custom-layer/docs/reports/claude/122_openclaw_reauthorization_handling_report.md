# FIX 122 - OpenClaw Reauthorization Handling

**Fecha**: 2026-05-05
**Estado**: Completado
**Autor**: Claude (asistido)

---

## 1. Objetivo Ejecutado

Implementar manejo correcto de errores de permisos/reauthorization de OpenClaw, evitando mostrar "PERMITIDO" cuando realmente se requiere reautorización del dispositivo.

---

## 2. Problema Inicial

- OpenClaw devuelve errores de permisos como éxito falso
- Mensajes como "pairing required" o "authorization required" no se detectaban
- El frontend mostraba "PERMITIDO" cuando realmente se requería reautorización
- No había estado visual específico para indicar problemas de permisos
- Los usuarios no sabían que debían reautorizar el dispositivo

---

## 3. Causa Raíz

1. **Sin detección de patrones**: El sistema no analizaba el contenido de las respuestas de OpenClaw para detectar errores de permisos
2. **Sin estado específico**: No existía un estado `reauthorization_required` diferenciado de success/error
3. **UI no informativa**: La interfaz no tenía forma de indicar que se requería acción del usuario en OpenClaw
4. **Respuesta engañosa**: `success: true` sin verificar si el contenido indicaba un problema de permisos

---

## 4. Archivos Creados/Modificados

### Creados

| Archivo | Propósito |
|---------|-----------|
| `apps/api/src/modules/orchestrator/reauth-detector.ts` | Detector de errores de reautorización con patrones |

### Modificados

| Archivo | Cambios |
|---------|---------|
| `apps/api/src/modules/orchestrator/output-normalizer.ts` | Tipo 'reauthorization_required', executionStatus, reauthInfo |
| `apps/api/src/modules/orchestrator/index.ts` | Export reauth-detector |
| `apps/api/src/modules/orchestrator/routes.ts` | Detección reauth en todas las rutas OpenClaw |
| `apps/web/src/lib/output-normalizer.ts` | Tipo reauth, ReauthorizationInfo, helpers |
| `apps/web/src/components/control/SecurityResultPanel.tsx` | Estado visual REAUTORIZACIÓN REQUERIDA |
| `apps/web/src/components/control/OutputViewer.tsx` | ReauthorizationOutput component |

---

## 5. Reauth Detector

### Patrones detectados

```typescript
const REAUTH_PATTERNS = [
  /pairing required/i,
  /authorization required/i,
  /more scopes/i,
  /device is asking for more scopes/i,
  /reauthorize/i,
  /permission denied/i,
  /not authorized/i,
  /requires authorization/i,
  /access denied/i,
  /insufficient permissions/i,
  /token expired/i,
  /session expired/i,
  /auth.*required/i,
  /need.*permission/i,
  /grant.*access/i,
  /oauth.*error/i,
  /scope.*required/i,
  /unauthorized/i,
]
```

### Fuentes analizadas

1. `response.error`
2. `response.message`
3. `response.response` (texto directo)
4. `response.result` (búsqueda recursiva)
5. `response.meta.executionTrace`
6. `response.meta.debugSnapshot`

### Interface de resultado

```typescript
interface ReauthDetectionResult {
  requiresReauth: boolean
  matchedPattern?: string
  matchSource?: 'message' | 'error' | 'trace' | 'result' | 'debugSnapshot'
  matchedText?: string
}
```

---

## 6. Respuesta Estandarizada

Cuando se detecta reauth, el orchestrator devuelve:

```typescript
{
  success: false,
  executionStatus: 'reauthorization_required',
  error: 'OpenClaw requiere reautorización',
  message: 'El dispositivo o la acción solicitada requiere permisos adicionales...',
  reauthInfo: {
    matchedPattern: string,
    matchSource: string,
    matchedText: string
  },
  meta: {
    requestId,
    taskId,
    source: 'openclaw-reauth',
    originalResponse,
    // ... otros campos
  }
}
```

---

## 7. Integración en Orchestrator

### Rutas actualizadas

Se añadió detección de reauth en todas las rutas que llaman a OpenClaw:

1. **handleOrchestratorRun - provider 'openclaw'**
2. **handleOrchestratorRun - fallback**
3. **handleOrchestratorRunStream - provider 'openclaw'**
4. **handleOrchestratorRunStream - fallback**

### Flujo de detección

```
1. result = await runSimpleAgentTask(taskInput)
2. reauthDetection = detectReauthRequired(result)
3. if (reauthDetection.requiresReauth) {
4.   - Log detección
5.   - Trace step con error
6.   - Complete task como 'error'
7.   - Return respuesta reauth
8. }
9. // Continuar flujo normal
```

---

## 8. UI: Estado Visual

### SecurityResultPanel

```typescript
// Nuevo estado
export type ResultStatus =
  | 'allowed'
  | 'blocked'
  | 'error'
  | 'unconfirmed'
  | 'missing_capability'
  | 'confirmation_required'
  | 'reauthorization_required'  // FIX 122

// Colores
const rose = '#f43f5e'
const roseBg = '#fff1f2'
const roseDark = '#9f1239'

// Textos
case 'reauthorization_required':
  return {
    icon: '🔐',
    title: 'REAUTORIZACIÓN REQUERIDA',
    message: 'OpenClaw necesita permisos adicionales...'
  }
```

### OutputViewer

Nuevo componente `ReauthorizationOutput`:
- Header con icono 🔐 y título rose
- Mensaje explicativo
- Detalles técnicos (pattern detectado)
- Botón para ir a reautorizar en OpenClaw

---

## 9. Frontend Output Normalizer

### Detección

```typescript
function isReauthorizationRequired(val: unknown): val is {
  executionStatus: 'reauthorization_required'
  message?: string
  reauthInfo?: ReauthorizationInfo
} {
  if (!isPlainObject(val)) return false
  return val.executionStatus === 'reauthorization_required'
}
```

### Normalización

```typescript
// FIX 122: Reauthorization required
if (isReauthorizationRequired(response)) {
  return {
    type: 'reauthorization_required',
    title: 'Reautorización Requerida',
    content: response.message || 'OpenClaw requiere permisos adicionales...',
    raw: response,
    isTechnicalRaw: true,
    reauthorization: response.reauthInfo
  }
}
```

---

## 10. Trace y Logs

### Logs de consola

```
[Reauth Detector] Found in error: "pairing required" (pattern: pairing required)
[GranClaw] Reauth required detected: pairing required in error
```

### Trace step

```typescript
trace.addStep({
  stage: 'openclaw',
  status: 'error',
  label: 'Reautorización requerida',
  detail: `OpenClaw requiere permisos adicionales: ${matchedText}`
})
```

---

## 11. Casos de Prueba

| Respuesta OpenClaw | Detecta | Estado |
|-------------------|---------|--------|
| `{ error: "pairing required" }` | ✅ | reauthorization_required |
| `{ message: "authorization required for this action" }` | ✅ | reauthorization_required |
| `{ result: { error: "more scopes needed" } }` | ✅ | reauthorization_required |
| `{ success: true, result: "ok" }` | ❌ | allowed |
| `{ error: "network error" }` | ❌ | error |

---

## 12. Riesgos y Mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Falsos positivos | Patrones específicos y case-insensitive |
| Patrones nuevos no detectados | Fácil agregar patrones al array |
| Búsqueda muy profunda | Límite de profundidad (5 niveles) |
| Texto en idioma diferente | Patrones en español e inglés |

---

## Verificaciones Finales

- ✅ `npm run check` - Sin errores TypeScript
- ✅ `npm run build` - Compilación exitosa
- ✅ Reauth detector implementado
- ✅ Orchestrator detecta reauth en todas las rutas
- ✅ Output normalizer actualizado (API y Web)
- ✅ SecurityResultPanel con estado visual
- ✅ OutputViewer con ReauthorizationOutput
- ✅ PROJECT_MEMORY.md actualizado
