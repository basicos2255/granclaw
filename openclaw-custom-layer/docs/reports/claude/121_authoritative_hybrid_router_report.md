# FIX 121 - Authoritative Hybrid Router & Intent Classification

**Fecha**: 2026-05-05
**Estado**: Completado
**Autor**: Claude (asistido)

---

## 1. Objetivo Ejecutado

Corregir FEATURE 120 para que la política híbrida gobierne realmente el flujo de ejecución, y mejorar la clasificación de intención para evitar falsos positivos.

---

## 2. Problema Inicial

- El execution-router existía pero era decorativo
- El detector de missing capabilities (`detectMissingCapability`) dominaba el flujo prematuramente
- Frases como "descarga X e instala" se clasificaban incorrectamente como `open_text_editor`
- Acciones complejas/multistep no se delegaban a OpenClaw
- Doble decisión: detector + router, sin autoridad clara

---

## 3. Causa Raíz

1. **Sin clasificación de intención**: El sistema no distinguía entre "abre editor" y "descarga e instala"
2. **Detector con patrones ambiguos**: `(lowerMessage.includes('notas') && lowerMessage.includes('abre'))` detectaba "descarga las notas de versión" como editor
3. **Router no autoritativo**: El flujo ejecutaba basándose en `capabilityEnabled`, no en `routeDecision.provider`
4. **Orden incorrecto**: Capability lookup antes de intent classification

---

## 4. Archivos Creados/Modificados

### Creados

| Archivo | Propósito |
|---------|-----------|
| `apps/api/src/modules/execution-policy/intent-classifier.ts` | Clasificador de intención con prioridades |

### Modificados

| Archivo | Cambios |
|---------|---------|
| `apps/api/src/modules/execution-policy/types.ts` | Import IntentClassification, intent en input/output |
| `apps/api/src/modules/execution-policy/execution-router.ts` | Router autoritativo con intent como input |
| `apps/api/src/modules/execution-policy/index.ts` | Export classifyIntent, shouldBlockLocalProposal, requiresOpenClaw |
| `apps/api/src/modules/tool-proposals/service.ts` | Guard install/download en detectMissingCapability |
| `apps/api/src/modules/orchestrator/routes.ts` | Flujo reordenado: Intent → Capability → Router → Execute |

---

## 5. Intent Classifier

Clasificación de intención con prioridades claras:

```typescript
type IntentKind =
  | 'simple_question'
  | 'deterministic_action'
  | 'os_action'
  | 'file_action'
  | 'web_action'
  | 'install_download_action'  // ALTA PRIORIDAD
  | 'complex_agent_task'        // ALTA PRIORIDAD
  | 'analysis_task'             // ALTA PRIORIDAD
  | 'unknown'
```

### Prioridad de detección

1. **install_download_action** (más alta): descarga, instala, setup, npm install, etc.
2. **complex_agent_task**: busca y haz, crea y configura, automatiza, etc.
3. **analysis_task**: analiza, compara, investiga, recomienda, etc.
4. **deterministic_action**: solo patrones exactos como "abre la calculadora"
5. **Otros**: web_action, file_action, simple_question, os_action

### Patrones install/download

```typescript
const INSTALL_DOWNLOAD_PATTERNS = [
  /\b(descarga|descargar|baja|bajar)\b/i,
  /\b(instala|instalar|instalador|installer)\b/i,
  /\b(setup|install|download)\b/i,
  /\b(actualiza|actualizar|update|upgrade)\b/i,
  /\b(npm\s+install|yarn\s+add|pip\s+install|brew\s+install)\b/i,
]
```

---

## 6. Execution Router Autoritativo

El router ahora es la **única autoridad** para decidir el provider:

```typescript
// RULE 3: Install/download ALWAYS go to OpenClaw
if (intent.kind === 'install_download_action') {
  return {
    provider: 'openclaw',
    reason: 'Instalacion/descarga requiere agente multistep',
    capabilityKey: undefined, // NO usar detected capability
    needsAi: true,
    tokenSaving: false,
    shouldCreateProposal: false
  }
}
```

### Orden de reglas

1. Hub blocked → stop
2. User requests OpenClaw explicitly → openclaw
3. **install_download_action → openclaw** (NUEVO)
4. **complex_agent_task → openclaw** (NUEVO)
5. **analysis_task → openclaw** (NUEVO)
6. Policy provider = 'openclaw' → openclaw
7. Policy provider = 'local' + capability → local
8. Auto mode: deterministic + avoidAi → local (ahorro tokens)
9. Detected capability but not approved → proposal
10. Default → openclaw

---

## 7. Cambios en Orchestrator

### Flujo anterior (problemático)

```
Hub → detectMissingCapability → if (missingCapability) { ... } → else { OpenClaw }
```

### Flujo nuevo (FIX 121)

```
Hub → classifyIntent → detectMissingCapability → capabilityLookup → decideExecutionRoute → switch(provider)
```

### Ejecución basada en router

```typescript
// Provider 'openclaw' - delegate to OpenClaw
if (routeDecision.provider === 'openclaw') {
  // Execute via OpenClaw
  return
}

// Provider 'local' - execute via capability
if (routeDecision.provider === 'local' && capabilityEnabled) {
  // Execute capability
  return
}

// Provider 'proposal' - create tool proposal
if (routeDecision.provider === 'proposal' && capabilityKey) {
  // Create proposal
  return
}

// Fallback - should rarely happen
```

---

## 8. Corrección Falsos Positivos Editor

### Antes (FIX 102)

```typescript
if ((lowerMessage.includes('notas') && lowerMessage.includes('abre')) { ... }
```

Problema: "descarga las notas de versión y abre el instalador" → open_text_editor

### Después (FIX 121)

```typescript
// Guard FIRST
if (hasInstallDownloadSignals) {
  console.log('[detectMissingCapability] Install/download signals - returning null')
  return null
}

// More restrictive editor patterns
const isEditorAction = (
  /^abre\s+(el\s+)?editor/.test(lowerMessage) ||
  /^crea\s+una?\s+nota/.test(lowerMessage) && !hasInstallDownloadSignals
)
```

---

## 9. Trace/Debug/Provider

Todas las respuestas incluyen `routerDecision`:

```typescript
meta: {
  routerDecision: {
    provider: routeDecision.provider,
    reason: routeDecision.reason,
    intentKind: intent.kind,
    needsAi: routeDecision.needsAi,
    tokenSaving: routeDecision.tokenSaving
  }
}
```

Logs en consola:

```
[Intent Classifier] kind=install_download_action confidence=high needsAi=true
[Execution Router] AUTHORITATIVE provider=openclaw reason="Instalacion/descarga requiere agente multistep"
[GranClaw] Delegating to OpenClaw: Instalacion/descarga requiere agente multistep
```

---

## 10. Casos Probados

| Input | Intent | Provider | Correcto |
|-------|--------|----------|----------|
| "abre la calculadora" | deterministic_action | local | ✅ |
| "descarga Chrome e instala" | install_download_action | openclaw | ✅ |
| "descarga X e instala" | install_download_action | openclaw | ✅ |
| "crea una nota con hola" | file_action | local/proposal | ✅ |
| "analiza qué necesito instalar" | analysis_task | openclaw | ✅ |
| "abre photoshop" | os_action | proposal | ✅ |
| "si conviene, abre calc y calcula" | complex_agent_task | openclaw | ✅ |

---

## 11. Riesgos y Mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Patrones demasiado restrictivos | Prioridad clara: install > complex > deterministic |
| Router no seguido | Flujo forzado por `if (provider ===)` en orchestrator |
| Intent mal clasificado | Múltiples patrones + confidence levels |
| Streaming handler diferente | Ambos handlers actualizados con mismo flujo |

---

## 12. Estado PROJECT_MEMORY.md

✅ Actualizado con FIX 121 completo

---

## Verificaciones Finales

- ✅ `npm run check` - Sin errores TypeScript
- ✅ `npm run build` - Compilación exitosa
- ✅ Intent classifier funcional
- ✅ Router autoritativo
- ✅ Guard install/download en detector
- ✅ routerDecision en meta de respuestas
- ✅ Ambos handlers (run y stream) actualizados
