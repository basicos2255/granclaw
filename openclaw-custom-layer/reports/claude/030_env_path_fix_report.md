# 030 - Env Path Fix Report

**Fecha**: 2026-04-30
**Prompt ID**: 030
**Estado**: Completado

---

## 1. Objetivo ejecutado

Corregir la carga de .env que fallaba porque el proceso se ejecuta desde
apps/api pero el archivo .env está en la raíz del monorepo.

---

## 2. Archivos modificados

| Archivo | Accion | Descripcion |
|---------|--------|-------------|
| `apps/api/src/index.ts` | Modificado | Búsqueda multi-path de .env |
| `PROJECT_MEMORY.md` | Modificado | Prompt 030 y reporte registrados |
| `reports/claude/030_env_path_fix_report.md` | Creado | Este reporte |

---

## 3. Decisiones aplicadas

| Decision | Motivo |
|----------|--------|
| Buscar en 3 paths | cwd, cwd/../../, __dirname/../../ cubren todos los casos |
| Mostrar path cargado | Debug claro de qué .env se usó |
| Validación individual | Warnings específicos por variable |
| No bloquear si falta | Permite arranque para debug |

---

## 4. Código aplicado

```typescript
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'

const envPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../../.env'),
  path.resolve(__dirname, '../../.env')
]

let loaded = false

for (const p of envPaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p })
    console.log('[ENV] Loaded from:', p)
    loaded = true
    break
  }
}

if (!loaded) {
  console.warn('[ENV] No .env file found in expected paths')
}

if (!process.env.OPENCLAW_BASE_URL) {
  console.warn('[ENV] OPENCLAW_BASE_URL not loaded')
}

if (!process.env.OPENCLAW_API_KEY) {
  console.warn('[ENV] OPENCLAW_API_KEY not loaded')
}
```

---

## 5. Problemas encontrados

| Problema | Solucion |
|----------|----------|
| `import 'dotenv/config'` busca solo en cwd | Reemplazado por búsqueda explícita |
| npm run start ejecuta desde apps/api/dist | __dirname apunta a dist, ../../ llega a raíz |

---

## 6. Pruebas realizadas

- `npm run build --workspaces` - OK
- TypeScript compila sin errores

---

## 7. Pendiente recomendado

1. Test real en Mac mini con `npm run start --workspace=@granclaw/api`
2. Verificar que `[ENV] Loaded from:` muestra path correcto
3. Verificar que variables se cargan correctamente

---

## 8. Estado de PROJECT_MEMORY.md

Actualizado con:
- Decisión "Env path resolution fix"
- Prompt 030 registrado
- Reporte 030 registrado
- Sección Env Bootstrap actualizada con fix de paths
