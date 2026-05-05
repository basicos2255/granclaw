# FEATURE 120 - Hybrid Execution Policy v1

**Fecha**: 2026-05-05
**Estado**: Completado
**Autor**: Claude (asistido)

---

## Resumen Ejecutivo

Se implementó un sistema de políticas de ejecución híbrida que permite a GranClaw decidir inteligentemente cuándo ejecutar acciones localmente vs delegarlas a OpenClaw. El objetivo principal es optimizar el uso de tokens de IA evitando consumo innecesario en acciones determinísticas/aprendidas.

**Principio arquitectónico**: GranClaw no sustituye a OpenClaw. GranClaw actúa como capa de seguridad, cache y router. OpenClaw permanece como motor agente para razonamiento y acciones complejas.

---

## Objetivos Cumplidos

1. ✅ Crear módulo execution-policy con persistencia por tenant
2. ✅ Implementar execution-router con lógica de decisión
3. ✅ Integrar en orchestrator después de capability lookup
4. ✅ Crear UI Settings para configuración de políticas
5. ✅ Añadir métodos API frontend
6. ✅ Verificar compilación (npm run check + build)

---

## Arquitectura

### Flujo de Decisión

```
Usuario envía mensaje
        ↓
Orchestrator recibe request
        ↓
Capability Lookup (detectar acción)
        ↓
Execution Router decide: local | openclaw | proposal
        ↓
Si local → ejecutar via capability dispatcher
Si openclaw → delegar a OpenClaw Gateway
Si proposal → crear tool proposal
```

### Lógica del Router

```typescript
decideExecutionRoute(input) {
  // 1. Usuario pide explícitamente OpenClaw → openclaw
  if (requestsOpenClaw(message)) return 'openclaw'

  // 2. Provider forzado
  if (provider === 'local') return 'local'
  if (provider === 'openclaw') return 'openclaw'

  // 3. Modo auto
  if (provider === 'auto') {
    // Capability determinística + evitar IA → local
    if (isDeterministic && avoidAiForLearnedActions) return 'local'

    // Mensaje con keywords IA → openclaw
    if (containsAiRequiredKeywords(message)) return 'openclaw'

    // Sin capability + preferir OpenClaw → openclaw
    if (!capability && preferOpenClawForNewActions) return 'openclaw'

    // Default → local (ahorro de tokens)
    return 'local'
  }
}
```

---

## Archivos Creados

| Archivo | Propósito |
|---------|-----------|
| `apps/api/src/modules/execution-policy/types.ts` | Tipos y constantes (providers, routes, keywords) |
| `apps/api/src/modules/execution-policy/service.ts` | CRUD con file-db por tenant |
| `apps/api/src/modules/execution-policy/execution-router.ts` | Lógica de decisión |
| `apps/api/src/modules/execution-policy/routes.ts` | Handlers HTTP GET/POST |
| `apps/api/src/modules/execution-policy/index.ts` | Exports del módulo |
| `apps/web/src/pages/control/Settings.tsx` | UI de configuración |

---

## Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `apps/api/src/index.ts` | Rutas `/execution-policy` |
| `apps/api/src/modules/orchestrator/routes.ts` | Integración router |
| `apps/web/src/services/api.ts` | Métodos API |
| `apps/web/src/pages/control/index.ts` | Export Settings |
| `apps/web/src/App.tsx` | Ruta y nav item |

---

## Tipos Principales

```typescript
type ExecutionProvider = 'auto' | 'openclaw' | 'local'
type ExecutionRoute = 'local' | 'openclaw' | 'proposal'

interface ExecutionPolicyConfig {
  tenantId: string
  provider: ExecutionProvider
  preferOpenClawForNewActions: boolean
  allowLocalFallback: boolean
  avoidAiForLearnedActions: boolean
  requireConfirmationForOsToolsInStrict: boolean
  requireConfirmationForHighRiskInFree: boolean
  updatedAt: string
}

interface ExecutionRouteDecision {
  route: ExecutionRoute
  provider: ExecutionProvider
  reason: string
  useLocalCapability: boolean
  delegateToOpenClaw: boolean
  createProposal: boolean
  requiresConfirmation: boolean
}
```

---

## Casos de Uso Verificados

| Input | Provider | Capability | Resultado | Razón |
|-------|----------|------------|-----------|-------|
| "abre la calculadora" | auto | open_calculator | local | Determinístico |
| "analiza este código" | auto | - | openclaw | Keyword IA |
| "abre la calc con IA" | auto | open_calculator | openclaw | Usuario pidió |
| "busca X" | local | - | local | Política forzada |
| "abre chrome" | openclaw | open_web_browser | openclaw | Política forzada |
| "resume el documento" | auto | - | openclaw | Keyword IA |

---

## UI Settings

La página `/control/settings` permite configurar:

1. **Proveedor de ejecución**:
   - Auto (recomendado): Decide automáticamente
   - OpenClaw primero: Siempre delegar
   - Local primero: Preferir ejecución local

2. **Opciones avanzadas**:
   - Evitar IA en acciones aprendidas
   - Preferir OpenClaw para acciones nuevas
   - Permitir fallback local

3. **Seguridad**:
   - Confirmar OS tools en modo estricto
   - Confirmar alto riesgo en modo libre

---

## Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/execution-policy` | Obtiene política del tenant |
| POST | `/execution-policy` | Guarda política del tenant |

---

## Beneficios

1. **Ahorro de tokens**: Acciones determinísticas no consumen IA
2. **Flexibilidad**: Usuario controla nivel de delegación
3. **Fallback robusto**: Si OpenClaw falla, local puede continuar
4. **Preparación futura**: Base para tareas multi-step con TaskExecutionPlan

---

## Verificaciones

- ✅ `npm run check` - Sin errores TypeScript
- ✅ `npm run build` - Compilación exitosa
- ✅ Rutas registradas en servidor
- ✅ UI accesible en `/control/settings`
- ✅ Integración en orchestrator funcional

---

## Próximos Pasos (Futuros)

1. Implementar TaskExecutionPlan para tareas multi-step
2. Añadir métricas de tokens ahorrados
3. StatusBar/DebugPanel mostrando proveedor usado
4. Analytics de decisiones del router
