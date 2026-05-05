# Reporte 018: Integración OpenClaw Tools Gateway

**Fecha**: 2026-04-29
**Prompt ID**: 019
**Estado**: Completado

---

## 1. Objetivo Ejecutado

Integrar ejecución REAL de tools vía OpenClaw Gateway (primer puente real):
- OpenClawToolsRpc wrapper para ejecutar tools via RPC
- Modo híbrido en agents (internal/openclaw por tool)
- Implementación de executeToolViaOpenClaw en runtime adapter
- Endpoint de diagnóstico GET /openclaw/tools-status

---

## 2. Archivos Creados/Modificados

### Creados

| Archivo | Descripción |
|---------|-------------|
| packages/openclaw-adapter/src/tools/openclaw-tools.rpc.ts | Wrapper RPC para tools |
| packages/openclaw-adapter/src/tools/index.ts | Exports del módulo tools |

### Modificados

| Archivo | Cambio |
|---------|--------|
| packages/openclaw-adapter/src/ws/index.ts | Export de OpenClawToolsRpc |
| packages/openclaw-adapter/src/runtime/openclaw-runtime.adapter.ts | toolsRpc, executeToolViaOpenClaw, getToolsRpc, isToolsRpcReady |
| apps/api/src/modules/agents/types.ts | ToolMode, ToolConfig, ToolsConfig, Agent.toolsConfig |
| apps/api/src/modules/agents/service.ts | toolsConfig en createAgent |
| apps/api/src/modules/orchestrator/service.ts | executeToolWithHybridMode, getOpenClawToolsStatus |
| apps/api/src/modules/openclaw/types.ts | ToolsRpcStatusResponse |
| apps/api/src/modules/openclaw/service.ts | getToolsRpcStatus |
| apps/api/src/modules/openclaw/routes.ts | handleToolsStatus |
| apps/api/src/index.ts | Registro endpoint /openclaw/tools-status |
| PROJECT_MEMORY.md | Documentación actualizada |

---

## 3. Decisiones Aplicadas

### OpenClawToolsRpc
```typescript
class OpenClawToolsRpc {
  isReady(): boolean
  executeTool(toolName: string, params: Record<string, unknown>): Promise<ToolExecuteResult>
  listTools(): Promise<{ tools: string[] }>
}
```
- Método RPC tentativo: `tools.execute`
- TODO explícito: validar método real contra OpenClaw

### Agent.toolsConfig
```typescript
type ToolMode = 'internal' | 'openclaw'

interface ToolConfig {
  mode: ToolMode
}

type ToolsConfig = Record<string, ToolConfig>

interface Agent {
  tools: string[]
  toolsConfig?: ToolsConfig
}
```
- Por defecto: mode = 'internal'
- Permite configurar mode por tool individual

### executeToolWithHybridMode
```typescript
async function executeToolWithHybridMode(
  message: string,
  availableToolIds: string[],
  toolsConfig: ToolsConfig | undefined,
  context: ToolExecutionContext
): Promise<ToolExecutionResult | null>
```
- Si mode = 'openclaw' → intenta via Gateway
- Si falla OpenClaw → fallback a internal
- Si mode = 'internal' → ejecuta directamente

### Validación de entrada
- toolName: string no vacío
- params: object
- Verificación de wsConnected y rpcReady

---

## 4. Problemas Encontrados

- **Método RPC desconocido**: No se conoce el método real de OpenClaw para tools
- **Solución**: Usar `tools.execute` como tentativo con TODO claro

---

## 5. Pruebas Realizadas

No se ejecutaron pruebas manuales en esta sesión.

**Pruebas recomendadas**:
```bash
# Verificar endpoint tools-status
curl http://localhost:3001/openclaw/tools-status

# Crear agent con toolsConfig
curl -X POST http://localhost:3001/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Hybrid Agent",
    "presetId": "preset_xxx",
    "tools": ["time", "http"],
    "toolsConfig": {
      "time": { "mode": "internal" },
      "http": { "mode": "openclaw" }
    }
  }'

# Ejecutar (fallback a internal si OpenClaw no conectado)
curl -X POST http://localhost:3001/orchestrator/run \
  -H "Content-Type: application/json" \
  -d '{"message": "fetch https://api.github.com/users/octocat", "agentId": "agent_xxx"}'
```

---

## 6. Pendiente Recomendado

1. **Validar método RPC real** - Cuando docs OpenClaw disponibles
2. **Implementar tools.list** - Listar tools disponibles en OpenClaw
3. **Sincronización de tools** - Registrar tools de OpenClaw en registry interno
4. **Manejo de errores específicos** - Diferentes tipos de error RPC
5. **Retry con backoff** - Para fallos de conexión temporales
6. **Cache de resultados** - Para tools sin side-effects

---

## 7. Estado de PROJECT_MEMORY.md

Actualizado con:
- Decisiones: OpenClawToolsRpc, modo híbrido, tools.execute tentativo
- Estado: OpenClaw Tools RPC wrapper, modo híbrido, endpoint tools-status
- Prompts: 019 registrado
- Reportes: 018 registrado
- Endpoints: /openclaw/tools-status añadido
- Documentación modo híbrido y toolsConfig

---

## Código Clave

### OpenClawToolsRpc
```typescript
export class OpenClawToolsRpc {
  constructor(wsClient: OpenClawWsClient) {
    this.wsClient = wsClient
  }

  isReady(): boolean {
    return this.wsClient.isConnected() && this.wsClient.isHandshakeComplete()
  }

  async executeTool(toolName: string, params: Record<string, unknown>): Promise<ToolExecuteResult> {
    // Validación
    if (!toolName || typeof toolName !== 'string') {
      return { success: false, result: null, error: 'Invalid toolName' }
    }

    if (!this.isReady()) {
      return { success: false, result: null, error: 'RPC not ready' }
    }

    // TODO: Validar método RPC real
    const result = await this.wsClient.request('tools.execute', {
      tool: toolName,
      params
    })

    return { success: true, result }
  }
}
```

### executeToolWithHybridMode
```typescript
async function executeToolWithHybridMode(
  message: string,
  availableToolIds: string[],
  toolsConfig: ToolsConfig | undefined,
  context: ToolExecutionContext
): Promise<ToolExecutionResult | null> {
  const toolId = detectToolFromMessage(message, availableToolIds)
  if (!toolId) return null

  const mode = getToolMode(toolId, toolsConfig)

  if (mode === 'openclaw') {
    const adapter = getOpenClawRuntimeAdapter()
    if (adapter?.isToolsRpcReady()) {
      const result = await adapter.executeToolViaOpenClaw(toolId, buildToolParams(message, toolId))
      if (result.success) return { success: true, toolId, result: result.result }
      // Fallback a internal si falla
    }
  }

  return executeToolIfDetected(message, availableToolIds, context)
}
```

### getToolsRpcStatus
```typescript
export function getToolsRpcStatus(): ToolsRpcStatusResponse {
  const toolsStatus = getOpenClawToolsStatus()
  return {
    configured: Boolean(wsUrl),
    wsConnected: toolsStatus.wsConnected,
    rpcReady: toolsStatus.rpcReady,
    toolsMode: toolsStatus.toolsMode,
    methodTentative: 'tools.execute',
    note: 'Método RPC tentativo, pendiente validación'
  }
}
```
