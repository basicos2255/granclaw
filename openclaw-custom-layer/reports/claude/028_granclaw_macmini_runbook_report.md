# 028 - GranClaw Mac mini Runbook Report

**Fecha**: 2026-04-30
**Prompt ID**: 028
**Estado**: Completado

---

## 1. Objetivo ejecutado

Crear un RUNBOOK operativo completo para desplegar GranClaw sobre OpenClaw en Mac mini,
ejecutable por TUI/OpenClaw o un operador técnico.

---

## 2. Archivos creados/modificados

| Archivo | Accion | Descripcion |
|---------|--------|-------------|
| `docs/deployment/GRANCLAW_MACMINI_RUNBOOK.md` | Creado | Runbook completo (16 secciones) |
| `docs/deployment/GRANCLAW_TUI_BOOTSTRAP_COMMANDS.md` | Creado | Comandos TUI secuenciales |
| `PROJECT_MEMORY.md` | Modificado | Sección Deployment Runbook añadida |
| `reports/claude/028_granclaw_macmini_runbook_report.md` | Creado | Este reporte |

---

## 3. Decisiones aplicadas

| Decision | Motivo |
|----------|--------|
| Runbook en markdown | Legible por humanos y TUI |
| Comandos exactos bash | Ejecutables sin modificación |
| Checklist final | Verificación sistemática |
| Definition of Done | Criterio claro de éxito |
| Token unificado | OPENCLAW_API_KEY para todas las superficies |
| Puertos canónicos | 18789 (OpenClaw), 3001 (API), 5173 (Web) |
| ACK mode documentado | Sin streaming real por ahora |

---

## 4. Problemas encontrados

| Problema | Solucion |
|----------|----------|
| Hooks token separado | Documentado como opcional |
| No hay .env.example completo | Runbook incluye template completo |
| WS token vs API key | Documentado que usa OPENCLAW_API_KEY |
| Streaming confuso | ACK mode claramente documentado |

---

## 5. Pruebas realizadas

- Lectura de archivos fuente para extraer configuración real
- Verificación de scripts en package.json
- Verificación de variables de entorno usadas en código
- Verificación de endpoints disponibles

---

## 6. Pendiente recomendado

1. **Test real en Mac mini**: Ejecutar runbook completo
2. **Tokens reales**: Configurar con tokens OpenClaw reales
3. **Hooks**: Probar integración si se habilitan
4. **Streaming real**: Implementar cuando eventos WS disponibles
5. **Producción**: Añadir HTTPS, CORS restrictivo, auth con password

---

## 7. Estado de PROJECT_MEMORY.md

Actualizado con:
- Prompt 028 registrado
- Reporte 027 registrado
- Sección "Deployment Runbook" añadida con:
  - Archivos creados
  - Variables de entorno
  - Puertos
  - Estado de streaming

---

## Contenido del Runbook

### Secciones incluidas:
1. Objetivo
2. Arquitectura operativa
3. Requisitos previos
4. Instalación limpia
5. Actualización de instalación existente
6. Configuración OpenClaw obligatoria
7. Variables de entorno GranClaw
8. Arranque correcto
9. URLs visuales / UIX
10. Validación obligatoria post-arranque
11. Interpretación de auth-status
12. Troubleshooting
13. Seguridad mínima
14. Limpieza y reset controlado
15. Checklist final
16. Definition of Done

### TUI Bootstrap Commands:
- Kill ports
- Pull repo
- Clean
- Install
- Build
- Write .env
- Verify OpenClaw config
- Start API
- Start Web
- Curl checks
- One-liner completo
- Validación rápida

---

## Comandos clave del runbook

```bash
# Parar procesos viejos
kill -9 $(lsof -t -i:3001 -i:5173) 2>/dev/null || true

# Actualizar y build
git pull && npm install && npm run build --workspaces

# Arrancar
npm run start --workspace=@granclaw/api &
npm run dev --workspace=@granclaw/web -- --host 0.0.0.0 &

# Validar
curl -s http://localhost:3001/health
curl -s http://localhost:3001/openclaw/auth-status
```

---

## Variables de entorno

```bash
APP_PORT=3001
NODE_ENV=development
OPENCLAW_BASE_URL=http://localhost:18789
OPENCLAW_WS_URL=ws://localhost:18789/ws
OPENCLAW_API_KEY=<GATEWAY_TOKEN>
VITE_API_URL=http://localhost:3001
```
