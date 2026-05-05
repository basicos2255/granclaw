# 029 - Env Bootstrap Fix Report

**Fecha**: 2026-04-30
**Prompt ID**: 029
**Estado**: Completado

---

## 1. Objetivo ejecutado

Garantizar que el flujo CLONE → npm install → start funcione correctamente
cargando `.env` automáticamente sin intervención manual.

---

## 2. Archivos creados/modificados

| Archivo | Accion | Descripcion |
|---------|--------|-------------|
| `apps/api/package.json` | Modificado | Añadido `dotenv: ^16.4.0` a dependencies |
| `apps/api/src/index.ts` | Modificado | `import 'dotenv/config'` como primera línea |
| `docs/deployment/GRANCLAW_MACMINI_RUNBOOK.md` | Modificado | Nota sobre dotenv añadida |
| `docs/deployment/GRANCLAW_TUI_BOOTSTRAP_COMMANDS.md` | Modificado | Nota sobre dotenv añadida |
| `PROJECT_MEMORY.md` | Modificado | Sección Env Bootstrap añadida, prompt 029 registrado |
| `reports/claude/029_env_bootstrap_fix_report.md` | Creado | Este reporte |

---

## 3. Cambios aplicados

### 3.1 apps/api/package.json

```json
"dependencies": {
  "@granclaw/core": "*",
  "@granclaw/openclaw-adapter": "*",
  "dotenv": "^16.4.0"
}
```

### 3.2 apps/api/src/index.ts

```typescript
import 'dotenv/config'

/**
 * GranClaw API - Servidor HTTP nativo
 * ...
 */

// Validación de variables de entorno críticas
const requiredEnvVars = ['OPENCLAW_BASE_URL', 'OPENCLAW_API_KEY']
const missingEnvVars = requiredEnvVars.filter(v => !process.env[v])
if (missingEnvVars.length > 0) {
  console.warn(`[ENV] WARNING: Missing required env vars: ${missingEnvVars.join(', ')}`)
  console.warn('[ENV] Create .env file or set environment variables')
}

import { createServer, IncomingMessage, ServerResponse } from 'http'
// ...
```

---

## 4. Decisiones aplicadas

| Decision | Motivo |
|----------|--------|
| `import 'dotenv/config'` primera línea | Carga .env antes de cualquier otro código |
| Validación con console.warn | No bloquea arranque, solo avisa |
| dotenv en dependencies (no devDependencies) | Necesario en runtime |

---

## 5. Flujo garantizado

```bash
# En Mac mini o cualquier entorno limpio
git clone <repo>
cd granclaw
npm install          # Instala dotenv como dependencia
npm run build --workspaces
# Crear .env con tokens
npm run start --workspace=@granclaw/api  # Carga .env automáticamente
```

---

## 6. Pruebas realizadas

- `npm install` - OK (added 1 package)
- `npm run check --workspaces` - OK
- `npm run build --workspaces` - OK

---

## 7. Comportamiento esperado

### Sin .env:
```
[ENV] WARNING: Missing required env vars: OPENCLAW_BASE_URL, OPENCLAW_API_KEY
[ENV] Create .env file or set environment variables
GranClaw API running on http://localhost:3001
```

### Con .env correcto:
```
GranClaw API running on http://localhost:3001
```

---

## 8. Estado de documentación

| Documento | Estado |
|-----------|--------|
| GRANCLAW_MACMINI_RUNBOOK.md | Actualizado con nota dotenv |
| GRANCLAW_TUI_BOOTSTRAP_COMMANDS.md | Actualizado con nota dotenv |
| PROJECT_MEMORY.md | Sección Env Bootstrap añadida |
| .env.example | Ya existía, sin cambios necesarios |

---

## 9. Próximos pasos recomendados

1. Test real en Mac mini con flujo completo
2. Verificar warning en consola si falta .env
3. Verificar que funciona con .env configurado

---

## Resumen

El flujo CLONE → npm install → start ahora carga `.env` automáticamente:
- `dotenv` es dependencia de `@granclaw/api`
- `import 'dotenv/config'` es la primera línea del entry point
- Variables críticas se validan con WARNING (no bloquea)
