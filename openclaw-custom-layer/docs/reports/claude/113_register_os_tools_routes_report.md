# REPORTE CLAUDE - FIX 113

## 1. Objetivo ejecutado

Registrar las rutas de OS Tools en el dispatcher HTTP nativo de `apps/api/src/index.ts`.

## 2. Diagnostico real

El frontend llamaba correctamente a:
- `GET /os-tools`
- `GET /os-tools/pending`
- `POST /os-tools/confirm`
- `POST /os-tools/cleanup`

Los handlers existian en:
- `apps/api/src/modules/os-tools/routes.ts`
- `apps/api/src/modules/os-tools/index.ts` (exports)

PERO en `apps/api/src/index.ts`:
- No habia import de os-tools
- No habia rutas en `getRoutes` ni `postRoutes`

El 401 previo no demostraba que la ruta estuviera registrada porque `requireAuth` corre antes de resolver rutas.

## 3. Causa raiz

Los handlers de OS Tools se crearon en FIX 110/111 pero nunca se registraron en el dispatcher principal del servidor HTTP nativo.

## 4. Archivos modificados

| Archivo | Cambios |
|---------|---------|
| apps/api/src/index.ts | Import os-tools handlers, rutas GET/POST, wrapper sessionId, listado endpoints |
| PROJECT_MEMORY.md | Entrada FIX 113 |

## 5. Rutas registradas

### GET Routes

```typescript
'/os-tools': handleGetOSTools,
'/os-tools/pending': wrapPendingConfirmationsHandler
```

### POST Routes

```typescript
'/os-tools/confirm': handleConfirmOSTool,
'/os-tools/cleanup': handleCleanupOSTools
```

### Wrapper para sessionId

```typescript
const wrapPendingConfirmationsHandler: RouteHandler = (req, res, context) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`)
  const sessionId = url.searchParams.get('sessionId') || undefined
  handleGetPendingConfirmations(req, res, context, sessionId)
}
```

## 6. Pruebas curl esperadas

### Sin auth (debe dar 401, NO 404)

```bash
curl -X POST http://localhost:3001/os-tools/confirm
# 401 Authentication required

curl http://localhost:3001/os-tools
# 401 Authentication required
```

### Con auth valido

```bash
curl -H "Authorization: Bearer <token>" http://localhost:3001/os-tools
# Lista de OS tools disponibles

curl -X POST -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"confirmationId":"xxx","action":"confirm"}' \
  http://localhost:3001/os-tools/confirm
# Error de confirmationId invalido o resultado de ejecucion
```

## 7. Pruebas UI esperadas

1. Pedir "abre calculadora"
2. Debe mostrar confirmacion requerida
3. Pulsar Confirmar
4. NO debe aparecer "Route /os-tools/confirm not found"
5. Debe ejecutar o mostrar error humano

## 8. Resultado npm run check

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

**PASS**

## 9. Resultado npm run build

```
> @granclaw/api@0.1.0 build
> tsc

> @granclaw/web@0.1.0 build
> tsc && vite build
✓ built in 1.73s

> @granclaw/core@0.1.0 build
> tsc

> @granclaw/openclaw-adapter@0.1.0 build
> tsc
```

**PASS**

## 10. Estado PROJECT_MEMORY.md

**Actualizado**: Si

Entrada añadida:
```
| 2026-05-05 | FIX 113 Register OS Tools Routes | Handlers existian pero no registrados en index.ts, ahora GET/POST /os-tools/* funcionan |
```

## 11. Notas tecnicas

### Body parsing

`handleConfirmOSTool` maneja su propio body parsing con `req.on('data')` y `req.on('end')`. No requiere cambios en el dispatcher.

### Auth

Todas las rutas de OS Tools requieren autenticacion. Los handlers verifican `context` y devuelven 401 si es null.

### sessionId en GET /os-tools/pending

Se extrae de query params con un wrapper dedicado para mantener la firma del handler original.

