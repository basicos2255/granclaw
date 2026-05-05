# Reporte 039 - Dev Runtime Stabilization

**Fecha**: 2026-05-01
**Prompt**: FIX 039 - Dev runtime stabilization
**Estado**: Completado

---

## 1. Objetivo ejecutado

Crear y documentar un flujo único y robusto de desarrollo/local deploy para GranClaw, evitando contaminación de procesos viejos y mezcla de modos start/dev.

---

## 2. Archivos creados/modificados

| Archivo | Acción |
|---------|--------|
| `scripts/granclaw-dev.sh` | Creado |
| `package.json` | Modificado (scripts) |
| `.gitignore` | Modificado (añadido .run/) |
| `README.md` | Modificado (sección arranque local) |
| `docs/deployment/GRANCLAW_MACMINI_RUNBOOK.md` | Modificado (sección 8, apéndice) |
| `docs/deployment/GRANCLAW_TUI_BOOTSTRAP_COMMANDS.md` | Reescrito |
| `PROJECT_MEMORY.md` | Modificado (sección FIX 039) |

---

## 3. Decisiones aplicadas

### 3.1 Script unificado

`scripts/granclaw-dev.sh` implementa:
- `start`: Parar procesos viejos, arrancar API + Web, health check
- `stop`: Matar por PID files y por puertos
- `restart`: stop + start
- `status`: Mostrar estado de puertos y archivos
- `logs`: tail -60 de logs API y Web

### 3.2 Directorio .run/

- Logs: `.run/granclaw-api.log`, `.run/granclaw-web.log`
- PIDs: `.run/granclaw-api.pid`, `.run/granclaw-web.pid`
- Añadido a `.gitignore`

### 3.3 Scripts en package.json

```json
{
  "dev": "./scripts/granclaw-dev.sh start",
  "dev:stop": "./scripts/granclaw-dev.sh stop",
  "dev:restart": "./scripts/granclaw-dev.sh restart",
  "dev:status": "./scripts/granclaw-dev.sh status",
  "dev:logs": "./scripts/granclaw-dev.sh logs",
  "dev:web": "npm run dev --workspace=@granclaw/web -- --host 0.0.0.0",
  "start:api": "npm run start --workspace=@granclaw/api",
  "start:web": "npm run preview --workspace=@granclaw/web -- --host 0.0.0.0"
}
```

### 3.4 Vite con --host 0.0.0.0

Permite acceso desde red local (ej: desde otra máquina en la misma red).

### 3.5 Cross-platform

Script detecta `lsof` (macOS/Linux) o `netstat`/`taskkill` (Windows/Git Bash).

---

## 4. Problemas encontrados

1. **Windows/Git Bash**: El script funciona en Git Bash pero `taskkill` requiere `//F` en lugar de `-9`.
2. **Puertos ocupados**: El script ahora mata procesos por PID files Y por puertos para limpiar huérfanos.

---

## 5. Pruebas realizadas

### Comandos ejecutados:
```bash
# TypeScript check
npm run check --workspaces --if-present
# Resultado: OK

# Build
npm run build --workspaces --if-present
# Resultado: OK

# Test script status
bash scripts/granclaw-dev.sh status
# Resultado:
# === GranClaw Status ===
# API (port 3001): DOWN
# Web (port 5173): DOWN

# Verificar script existe y es ejecutable
ls -la scripts/granclaw-dev.sh
# Resultado: -rwxr-xr-x
```

### Resultado real:
- Script funciona correctamente
- Muestra estado de puertos
- Build completa sin errores
- Documentación actualizada

**Nota**: No se ejecutó `npm run dev` porque requiere OpenClaw Gateway corriendo. El script está listo para uso en entorno con Gateway.

---

## 6. Pendiente recomendado

1. **Test en macOS**: Verificar script completo en Mac mini con OpenClaw
2. **Test start/stop ciclo**: Ejecutar ciclo completo con Gateway
3. **Health check timeout**: Añadir retry con timeout si API tarda en arrancar
4. **Modo watch**: Considerar añadir modo que muestre logs en tiempo real

---

## 7. Estado de PROJECT_MEMORY.md

✅ Añadida sección "FIX 039 - Dev Runtime Stabilization"
✅ Actualizada tabla de prompts ejecutados
✅ Actualizada tabla de reportes Claude

---

## Uso documentado

### Desarrollo
```bash
npm run dev           # Arrancar API + Web
npm run dev:status    # Ver estado
npm run dev:logs      # Ver logs
npm run dev:stop      # Parar todo
npm run dev:restart   # Reiniciar
```

### Producción local
```bash
npm run build
npm run start:api
npm run start:web
```

### Regla importante
No mezclar:
- API en `start` (compilada)
- Web en `dev` (Vite dev server)

Usar un modo por entorno:
- Todo `dev` → `npm run dev`
- Todo compilado → `npm run build` + `npm run start:api` + `npm run start:web`
