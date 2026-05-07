# P2.2 — API Base URL & Runtime State Fetch Fix

**Fecha:** 2026-05-07
**Autor:** Claude (Arquitecto Enterprise/Runtime Distribuido)
**Estado:** COMPLETADO

## 1. Objetivo Ejecutado

Corregir el error donde ProductDashboard crasheaba al intentar parsear HTML como JSON cuando el fetch iba a `/api/runtime/state` sin base URL.

## 2. Error Observado

```
ProductDashboard.tsx:61
SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
```

## 3. Causa Raiz

- `ProductDashboard.tsx:55` y `RuntimePage.tsx:60` usaban `fetch('/api/runtime/state')` directo
- Sin API_BASE_URL, el fetch iba a Vite dev server
- Vite servia `index.html` (HTML) en lugar del backend API (JSON)
- `response.json()` intentaba parsear HTML y crasheaba

## 4. Fetches Directos Encontrados

| Archivo | Linea | Fetch |
|---------|-------|-------|
| ProductDashboard.tsx | 55 | `fetch('/api/runtime/state')` |
| RuntimePage.tsx | 60 | `fetch('/api/runtime/state')` |

## 5. API Client Centralizado

Agregado a `apps/web/src/services/api.ts`:

```typescript
// Helper para detectar errores de conexion
export function isApiConnectionError(error: unknown): boolean

// Error especifico para respuestas no-JSON
export class ApiNonJsonError extends Error {
  constructor(status: number, url: string, preview: string)
}

// Fetch con validacion de content-type
export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T>

// Funcion especifica para runtime state
export async function getRuntimeState(): Promise<{
  success: boolean
  data: RuntimeStateData | null
  error: string | null
}>
```

## 6. ProductDashboard Handling

```typescript
// ANTES (crasheaba)
const response = await fetch('/api/runtime/state')
const data = await response.json()

// DESPUES (robusto)
import { getRuntimeState, RuntimeStateData } from '../../services/api'

const result = await getRuntimeState()
if (result.success && result.data) {
  // Mapear data a state
  setApiError(null)
} else {
  setApiError(result.error)  // Mostrar degraded state
}
```

Nuevo estado `apiError` con UI de degraded:
- Banner rojo con mensaje de error
- Instrucciones para verificar backend
- Dashboard no crashea

## 7. Vite Proxy / Env

### vite.config.ts

```typescript
server: {
  port: 5173,
  proxy: {
    '/runtime': 'http://localhost:3001',
    '/queue': 'http://localhost:3001',
    '/api': 'http://localhost:3001',
    // ... otros endpoints
  }
}
```

### .env.example

```
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
```

## 8. Casos Probados

| Caso | Resultado |
|------|-----------|
| Backend corriendo | Dashboard carga datos JSON |
| Backend apagado | Degraded state, no crash |
| Endpoint devuelve HTML | Error legible, no SyntaxError |
| fetch directo auditado | Ninguno queda disperso |

## 9. npm run check

```
> @granclaw/api@0.1.0 check
> tsc --noEmit

> @granclaw/web@0.1.0 check
> tsc --noEmit

> @granclaw/core@0.1.0 check
> tsc --noEmit

> @granclaw/openclaw-adapter@0.1.0 check
> tsc --noEmit
```

Sin errores.

## 10. npm run build

```
> @granclaw/web@0.1.0 build
> tsc && vite build

vite v5.4.21 building for production...
✓ 86 modules transformed.
dist/index.html                 0.70 kB
dist/assets/index-CchL4Rqy.js 382.54 kB

✓ built in 2.15s
```

Exitoso.

## 11. Estado PROJECT_MEMORY.md

Actualizado con seccion P2.2 documentando:
- Problema original
- Solucion implementada
- Archivos modificados
- Verificaciones pasadas
