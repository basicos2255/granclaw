# Reporte 017: Integración de Tools con Ejecución Real

**Fecha**: 2026-04-29
**Prompt ID**: 018
**Estado**: Completado

---

## 1. Objetivo Ejecutado

Integrar el sistema de tools interno con ejecución REAL (primer nivel), añadiendo:
- ToolExecutionContext para contexto de ejecución
- httpTool con ejecución real de HTTP requests
- Seguridad básica (bloqueo localhost, timeout)
- Placeholder para integración futura con OpenClaw tools/plugins

---

## 2. Archivos Creados/Modificados

### Modificados

| Archivo | Cambio |
|---------|--------|
| apps/api/src/modules/tools/types.ts | Añadido ToolExecutionContext, actualizado ToolExecutor |
| apps/api/src/modules/tools/service.ts | Añadido httpTool, parseHttpInputFromMessage, isBlockedUrl |
| apps/api/src/modules/orchestrator/service.ts | Añadido toolContext en executeToolIfDetected |
| packages/openclaw-adapter/src/runtime/openclaw-runtime.adapter.ts | Añadido executeToolViaOpenClaw placeholder |
| PROJECT_MEMORY.md | Documentación actualizada |

---

## 3. Decisiones Aplicadas

### ToolExecutionContext
```typescript
interface ToolExecutionContext {
  tenantId?: string
  userId?: string
  sessionId?: string
}
```
- Permite a tools acceder a contexto de ejecución
- Útil para logging, auditoría, rate-limiting por tenant

### httpTool Seguridad
- **BLOCKED_HOSTS**: localhost, 127.0.0.1, 0.0.0.0, ::1
- **Timeout**: 10 segundos con AbortController
- **Métodos**: Solo GET y POST soportados

### Detección de URL
```typescript
const urlMatch = message.match(/https?:\/\/[^\s]+/)
```
- Extrae primera URL del mensaje
- Detecta POST si mensaje contiene "post"

### Placeholder OpenClaw
```typescript
async executeToolViaOpenClaw(toolName: string, params: Record<string, unknown>)
```
- Método preparado en RuntimeAdapter
- Retorna error indicando no implementado
- TODO claro para integración futura

---

## 4. Problemas Encontrados

Ninguno. Implementación directa.

---

## 5. Pruebas Realizadas

No se ejecutaron pruebas manuales en esta sesión.

**Pruebas recomendadas**:
```bash
# Iniciar servidor
npm run dev

# Crear agent con httpTool
curl -X POST http://localhost:3001/agents \
  -H "Content-Type: application/json" \
  -d '{"name":"HTTP Agent","presetId":"preset_xxx","tools":["http"]}'

# Ejecutar httpTool
curl -X POST http://localhost:3001/orchestrator/run \
  -H "Content-Type: application/json" \
  -d '{"message":"fetch https://api.github.com/users/octocat","agentId":"agent_xxx"}'

# Verificar bloqueo localhost
curl -X POST http://localhost:3001/orchestrator/run \
  -H "Content-Type: application/json" \
  -d '{"message":"fetch http://localhost:3001/health","agentId":"agent_xxx"}'
# Debe retornar error: "Blocked: internal URLs not allowed"
```

---

## 6. Pendiente Recomendado

1. **Validación de schema input httpTool** - Usar zod o similar
2. **Más métodos HTTP** - PUT, DELETE, PATCH
3. **Headers customizables** - Permitir auth headers
4. **Implementar executeToolViaOpenClaw** - Cuando protocolo disponible
5. **Rate limiting por tenant** - Usar context.tenantId
6. **Logging de ejecución de tools** - Auditoría
7. **UI para probar tools** - Interfaz de testing

---

## 7. Estado de PROJECT_MEMORY.md

Actualizado con:
- ToolExecutionContext en tipos
- httpTool en tabla de tools builtin
- Seguridad httpTool documentada
- Decisiones de diseño añadidas
- Prompt 018 registrado
- Reporte 017 registrado
- RuntimeAdapter actualizado (placeholder)

---

## Código Clave

### httpTool
```typescript
const httpTool: Tool = {
  id: 'http',
  name: 'HTTP Request',
  description: 'Executes HTTP requests to external URLs',
  execute: async (input: unknown, _context?: ToolExecutionContext): Promise<unknown> => {
    const httpInput = input as HttpToolInput

    // Seguridad: bloquear URLs internas
    if (isBlockedUrl(httpInput.url)) {
      throw new Error('Blocked: internal URLs not allowed')
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), HTTP_TIMEOUT)

    const response = await fetch(httpInput.url, {
      method: httpInput.method || 'GET',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: httpInput.method === 'POST' ? JSON.stringify(httpInput.body) : undefined
    })

    clearTimeout(timeoutId)

    return {
      status: response.status,
      ok: response.ok,
      data: await response.json()
    }
  }
}
```

### isBlockedUrl
```typescript
function isBlockedUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return BLOCKED_HOSTS.some(host =>
      parsed.hostname === host || parsed.hostname.endsWith(`.${host}`)
    )
  } catch {
    return true // URL inválida = bloqueada
  }
}
```

### executeToolViaOpenClaw (placeholder)
```typescript
async executeToolViaOpenClaw(
  toolName: string,
  params: Record<string, unknown>
): Promise<{ success: boolean; result: unknown; error?: string }> {
  // TODO: Implementar cuando protocolo disponible
  return {
    success: false,
    result: null,
    error: `OpenClaw tool execution not implemented: ${toolName}`
  }
}
```
