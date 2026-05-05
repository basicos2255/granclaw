# GranClaw

Capa personalizada sobre OpenClaw para extender funcionalidades sin modificar el core.

## ¿Qué es este proyecto?

**GranClaw** es una capa de abstracción y extensión sobre **OpenClaw**, el motor principal de procesamiento.

## Arquitectura

- **OpenClaw** actúa como motor/gateway principal.
- Esta capa añade:
  - Backend API propio
  - Interfaz de usuario (UI)
  - Adapters para comunicación con OpenClaw
  - Presets y configuraciones personalizadas
  - Sistema de tareas y automatización
  - Auditoría y reportes

## Principio fundamental

**No se modifica OpenClaw core.** Toda la lógica personalizada vive en esta capa.

## Estructura

```
granclaw/
  apps/
    api/          # Backend API
    web/          # Frontend UI (GranClaw UI)
  packages/
    openclaw-adapter/  # Comunicación con OpenClaw
    core/              # Lógica compartida, tipos y contratos
    project-memory/    # Gestión de memoria del proyecto
  docs/           # Documentación
  prompts/        # Prompts reutilizables
  reports/        # Reportes de Claude y tests
  scripts/        # Scripts de utilidad
```

## Arranque local

### Uso recomendado (desarrollo)

```bash
# Arrancar API + Web
npm run dev

# Ver estado
npm run dev:status

# Ver logs
npm run dev:logs

# Parar todo
npm run dev:stop

# Reiniciar
npm run dev:restart
```

### Notas importantes

- `npm run dev` limpia procesos en puertos 3001/5173 y levanta API + Web
- Web escucha en `0.0.0.0` para acceso desde red local
- **No mezclar** `npm run start` de API con `npm run dev:web`
- Logs y PIDs se guardan en `.run/` (ignorado por git)

### Runtime compilado (producción local)

```bash
npm run build
npm run start:api   # API compilada
npm run start:web   # Web en preview mode
```

### Comandos individuales (avanzado)

```bash
npm run dev:api    # Solo API en dev mode
npm run dev:web    # Solo Web en dev mode (con --host 0.0.0.0)
```

## Health check

```bash
curl -s http://localhost:3001/health
```

## Estado

Proyecto funcional con API, Web, OpenClaw integration, tools, y chat.
