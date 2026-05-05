# 031 - Pre-commit Runbook + Clean Tree Report

**Fecha**: 2026-04-30
**Prompt ID**: 031
**Estado**: Completado

---

## 1. Objetivo ejecutado

Corregir runbook para usar Bearer token en endpoints protegidos y limpiar
artefactos de build del repositorio antes del commit final.

---

## 2. Archivos modificados

| Archivo | Accion | Descripcion |
|---------|--------|-------------|
| `docs/deployment/GRANCLAW_MACMINI_RUNBOOK.md` | Modificado | Sección 10 reorganizada con endpoints públicos/protegidos |
| `docs/deployment/GRANCLAW_TUI_BOOTSTRAP_COMMANDS.md` | Modificado | Login antes de endpoints protegidos |
| `PROJECT_MEMORY.md` | Modificado | Sección FIX 031, prompt y reporte registrados |
| `reports/claude/031_pre_commit_runbook_clean_report.md` | Creado | Este reporte |

---

## 3. Decisiones aplicadas

| Decision | Motivo |
|----------|--------|
| Separar endpoints públicos/protegidos | Claridad operativa |
| Login antes de validaciones | Flujo correcto de auth |
| dist/ limpio para commit | Repo limpio, sin artefactos build |
| .gitignore verificado | Ya tenía todas las entradas necesarias |

---

## 4. Problemas encontrados

| Problema | Solucion |
|----------|----------|
| Runbook llamaba /openclaw/auth-status sin token | Añadido Bearer token |
| Runbook llamaba /openclaw/tools-status sin token | Añadido Bearer token |
| TUI one-liner no incluía login | Simplificado, login en sección separada |

---

## 5. Pruebas realizadas

### Comandos ejecutados:

```bash
# Limpieza de artefactos
rm -rf apps/*/dist packages/*/dist dist
find . -name "*.tsbuildinfo" -delete

# Verificar limpieza (solo node_modules tiene dist/)
find . -path "*/dist/*" -type f | wc -l  # 201 (todos en node_modules)
ls -la apps/api/dist  # No dist in apps/api
ls -la apps/web/dist  # No dist in apps/web

# Check y build
npm run check --workspaces --if-present  # OK
npm run build --workspaces --if-present  # OK

# Limpieza post-build para commit limpio
rm -rf apps/*/dist packages/*/dist dist
find . -name "*.tsbuildinfo" -delete
```

### Resultado:
- check: OK (todos los workspaces)
- build: OK (todos los workspaces)
- dist/ eliminado para commit limpio

---

## 6. Pendiente recomendado

1. Commit final con tree limpio
2. Test en Mac mini con flujo completo:
   - Clone
   - npm install
   - npm run build
   - Crear .env
   - npm run start
   - curl /health
   - Login
   - curl /openclaw/auth-status con token

---

## 7. Estado de PROJECT_MEMORY.md

Actualizado con:
- Sección "FIX 031 - Pre-commit Runbook + Clean Tree"
- Lista de endpoints públicos vs protegidos
- Flujo correcto de validación
- Prompt 031 registrado
- Reporte 031 registrado

---

## Endpoints públicos (sin token)

- `/health`
- `/openclaw/status`
- `/auth/login`

## Endpoints protegidos (requieren Bearer token)

- `/openclaw/auth-status`
- `/openclaw/tools-status`
- `/openclaw/ws-rpc-status`
- `/tools`
- `/orchestrator/run`
- `/orchestrator/run-stream`
- `/presets`
- `/agents`
- `/sessions`
- Todos los demás

---

## Estado del repo

- dist/ limpio
- *.tsbuildinfo limpio
- .gitignore correcto
- Listo para commit
