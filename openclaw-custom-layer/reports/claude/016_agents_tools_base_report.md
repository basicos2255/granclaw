# Reporte 016: Sistema de Tools Base

**Fecha**: 2026-04-29
**Prompt ID**: 017
**Estado**: Completado

---

## Objetivo

Implementar un sistema de tools extensible que permita a los agents ejecutar herramientas específicas según el contenido del mensaje del usuario.

---

## Implementación

### 1. Módulo Tools

**Estructura creada**:
```
apps/api/src/modules/tools/
  types.ts      # Tipos del sistema de tools
  registry.ts   # Registry central de tools
  service.ts    # Tools builtin y ejecución
  routes.ts     # Endpoints HTTP
  index.ts      # Exports
```

### 2. Tipos Definidos

```typescript
// Función ejecutora de una tool
type ToolExecutor = (input: unknown) => Promise<unknown>

// Definición de una tool
interface Tool {
  id: string
  name: string
  description: string
  execute: ToolExecutor
}

// Resultado de ejecución
interface ToolExecutionResult {
  success: boolean
  toolId: string
  result: unknown
  error?: string
}

// Info pública (sin execute)
interface ToolInfo {
  id: string
  name: string
  description: string
}
```

### 3. Registry

**Funciones**:
- `registerTool(tool)` - Registra una tool en el Map central
- `getTool(id)` - Obtiene una tool por id
- `listTools()` - Lista todas (retorna ToolInfo[])
- `hasTool(id)` - Verifica existencia
- `getTools(ids)` - Obtiene múltiples por ids

**Implementación**:
```typescript
const toolRegistry: Map<string, Tool> = new Map()

export function registerTool(tool: Tool): void {
  toolRegistry.set(tool.id, tool)
}

export function getTool(id: string): Tool | null {
  return toolRegistry.get(id) || null
}
```

### 4. Tools Builtin

**Echo Tool**:
- ID: `echo`
- Keyword: `echo`
- Retorna el input tal cual con timestamp

**Time Tool**:
- ID: `time`
- Keywords: `time`, `hora`, `fecha`
- Retorna timestamp ISO, unix y formateado

```typescript
const timeTool: Tool = {
  id: 'time',
  name: 'Time',
  description: 'Returns the current timestamp',
  execute: async (): Promise<unknown> => {
    const now = new Date()
    return {
      timestamp: now.toISOString(),
      unix: now.getTime(),
      formatted: now.toLocaleString()
    }
  }
}
```

### 5. Detección y Ejecución

**Detección por keyword**:
```typescript
function detectToolFromMessage(message: string, availableToolIds: string[]): string | null {
  const lower = message.toLowerCase()

  for (const toolId of availableToolIds) {
    if (toolId === 'echo' && lower.includes('echo')) {
      return 'echo'
    }
    if (toolId === 'time' && (lower.includes('time') || lower.includes('hora') || lower.includes('fecha'))) {
      return 'time'
    }
  }

  return null
}
```

**Ejecución completa**:
```typescript
async function executeToolIfDetected(
  message: string,
  availableToolIds: string[]
): Promise<ToolExecutionResult | null> {
  const toolId = detectToolFromMessage(message, availableToolIds)
  if (!toolId) return null
  return executeTool(toolId, message)
}
```

### 6. Integración con Agents

**Agent actualizado**:
```typescript
interface Agent {
  id: string
  tenantId: string
  name: string
  presetId: string
  tools: string[]  // NUEVO: array de tool ids
  active: boolean
}
```

### 7. Integración con Orchestrator

**runSimpleAgentTask**:
1. Obtiene config del agent (incluyendo tools)
2. Si agent tiene tools, intenta detectar y ejecutar
3. Si tool ejecutada → retorna con `source: "tool"`
4. Si no → continúa con flujo normal (OpenClaw/mock)

**runStreamingTask**:
- Misma lógica que runSimpleAgentTask
- Retorna con `mode: "tool"` si tool ejecutada

**Tipos actualizados**:
```typescript
export type TaskSource = 'mock' | 'openclaw' | 'tool'
export type StreamMode = 'stream' | 'fallback' | 'tool'

// Añadido toolId a ambos results
```

### 8. Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /tools | Lista todas las tools disponibles |
| GET | /tools/:id | Obtiene una tool por id |

**Response GET /tools**:
```json
{
  "success": true,
  "tools": [
    { "id": "echo", "name": "Echo", "description": "..." },
    { "id": "time", "name": "Time", "description": "..." }
  ],
  "count": 2
}
```

---

## Flujo de Ejecución

```
1. POST /orchestrator/run { message: "What time is it?", agentId: "agent-1" }
2. Orchestrator obtiene agent config
3. Agent tiene tools: ["time", "echo"]
4. detectToolFromMessage("What time is it?", ["time", "echo"]) → "time"
5. executeTool("time", message) → { timestamp, unix, formatted }
6. Retorna { success: true, source: "tool", toolId: "time", result: {...} }
```

---

## Archivos Creados

| Archivo | Descripción |
|---------|-------------|
| apps/api/src/modules/tools/types.ts | Tipos del sistema |
| apps/api/src/modules/tools/registry.ts | Registry central |
| apps/api/src/modules/tools/service.ts | Tools y ejecución |
| apps/api/src/modules/tools/routes.ts | Endpoints HTTP |
| apps/api/src/modules/tools/index.ts | Exports |

---

## Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| apps/api/src/modules/agents/types.ts | Añadido `tools: string[]` a Agent |
| apps/api/src/modules/agents/service.ts | Añadido `tools: input.tools ?? []` |
| apps/api/src/modules/orchestrator/types.ts | Añadido 'tool' a TaskSource/StreamMode, toolId |
| apps/api/src/modules/orchestrator/service.ts | Integración con tools |
| apps/api/src/index.ts | Registrados endpoints /tools |
| PROJECT_MEMORY.md | Documentación tools |

---

## Decisiones de Diseño

1. **Registry pattern**: Map central permite registro dinámico de tools
2. **Keyword detection simple**: Sin NLP complejo, extensible con más keywords
3. **Tools asignadas a agents**: Cada agent define qué tools puede usar
4. **Prioridad tools > OpenClaw**: Tools se ejecutan primero si detectadas
5. **ToolInfo sin execute**: API pública no expone función de ejecución

---

## Extensibilidad

Para añadir una nueva tool:

```typescript
// 1. Crear la tool
const myTool: Tool = {
  id: 'mytool',
  name: 'My Tool',
  description: 'Does something',
  execute: async (input) => {
    // lógica
    return { result: 'done' }
  }
}

// 2. Registrarla
registerTool(myTool)

// 3. Añadir keywords en detectToolFromMessage
if (toolId === 'mytool' && lower.includes('mykey')) {
  return 'mytool'
}

// 4. Asignar a un agent
createAgent({ name: 'Agent', presetId: 'p1', tools: ['mytool'] })
```

---

## TODO

- [ ] Detección más inteligente (NLP básico o patterns más sofisticados)
- [ ] Tools con validación de input schema
- [ ] Tools con output schema
- [ ] UI para gestión de tools
- [ ] Tools asíncronas con callbacks
- [ ] Integración con OpenClaw tools reales

---

## Notas

- Este es el primer nivel de tools (interno, sin plugins externos)
- La detección por keyword es deliberadamente simple
- Preparado para extensión hacia tools más complejas
- No integra todavía con sistema de tools de OpenClaw
