# P6.5 - Startup Audit Report

**Fecha:** 2026-05-09
**Autor:** Claude
**Estado:** Completado

---

## 1. Puertos Configurados

| Servicio | Puerto Default | Variable ENV |
|----------|----------------|--------------|
| API Backend | 3001 | APP_PORT |
| Web Frontend | 5173 | WEB_PORT |

---

## 2. Scripts de Desarrollo

### Raiz (package.json)

| Script | Comando |
|--------|---------|
| `npm run dev` | `./scripts/granclaw-dev.sh start` |
| `npm run dev:stop` | `./scripts/granclaw-dev.sh stop` |
| `npm run dev:api` | `npm run dev --workspace=@granclaw/api` |
| `npm run dev:web` | `npm run dev --workspace=@granclaw/web -- --host 0.0.0.0` |

### API (apps/api/package.json)

| Script | Comando |
|--------|---------|
| `npm run dev` | `ts-node src/index.ts` |
| `npm run build` | `tsc` |
| `npm run start` | `node dist/index.js` |

### Web (apps/web/package.json)

| Script | Comando |
|--------|---------|
| `npm run dev` | `vite` |
| `npm run build` | `tsc && vite build` |

---

## 3. Script Unificado: granclaw-dev.sh

El script bash `scripts/granclaw-dev.sh` maneja el ciclo de vida completo:
- `start` - Inicia API y Web en background
- `stop` - Detiene ambos servicios
- `restart` - Reinicia ambos
- `status` - Muestra estado de puertos
- `logs` - Muestra ultimas 60 lineas de logs

**Archivos de estado:** `.run/granclaw-api.pid`, `.run/granclaw-web.pid`
**Logs:** `.run/granclaw-api.log`, `.run/granclaw-web.log`

---

## 4. Configuracion ENV

### Archivos Existentes

| Archivo | Estado |
|---------|--------|
| `.env.example` | EXISTE |
| `apps/web/.env.example` | EXISTE |
| `.env` | NO EXISTE |
| `apps/web/.env` | NO EXISTE |

### Variables Criticas Frontend

| Variable | Valor Default | Uso |
|----------|--------------|-----|
| `VITE_API_BASE_URL` | `http://localhost:3001` | URL del backend |
| `VITE_WS_BASE_URL` | `ws://localhost:3001` | WebSocket |
| `VITE_API_URL` | (deprecated) | Backward compat |

---

## 5. Vite Proxy Configuration

El proxy de Vite (`apps/web/vite.config.ts`) tiene rutas:

```typescript
proxy: {
  '/runtime': 'http://localhost:3001',
  '/queue': 'http://localhost:3001',
  '/dag': 'http://localhost:3001',
  '/notifications': 'http://localhost:3001',
  '/channels': 'http://localhost:3001',
  '/credentials': 'http://localhost:3001',
  '/approvals': 'http://localhost:3001',
  '/workers': 'http://localhost:3001',
  '/test-mode': 'http://localhost:3001',
  '/metrics': 'http://localhost:3001',
  '/readiness': 'http://localhost:3001',
  '/api': 'http://localhost:3001'
}
```

**NOTA:** El proxy NO aplica porque `api.ts` usa URL absoluta (`http://localhost:3001`).

---

## 6. Endpoints Registrados en Backend

Todos los endpoints usados por el Dashboard ESTAN registrados:

| Endpoint | Handler | Estado |
|----------|---------|--------|
| `GET /health` | handleHealth | REGISTRADO |
| `GET /runtime/state` | handleGetRuntimeState | REGISTRADO |
| `GET /runtime/health` | handleGetRuntimeHealth | REGISTRADO |
| `GET /pairing/health` | handleGetPairingHealth | REGISTRADO |
| `GET /openclaw/health` | handleGetOpenClawHealth | REGISTRADO |

---

## 7. Causa Raiz del Error

El error `ERR_CONNECTION_REFUSED` ocurre porque:

1. **Backend NO esta corriendo** en puerto 3001
2. Frontend usa URL absoluta correctamente
3. Cuando backend esta offline, fetch falla con connection refused
4. No hay problema de configuracion - solo falta iniciar el backend

---

## 8. Solucion

Para desarrollo:

```bash
# Opcion 1: Script unificado (recomendado)
cd openclaw-custom-layer
npm run dev

# Opcion 2: Terminales separadas
# Terminal 1:
cd openclaw-custom-layer && npm run dev:api

# Terminal 2:
cd openclaw-custom-layer && npm run dev:web
```

Verificar:
```bash
curl http://localhost:3001/health
```

---

## 9. Mejoras Necesarias (P6.5)

1. **FASE C**: Mostrar mensaje claro cuando backend esta offline
2. **FASE D**: Centralizar endpoints en registry
3. **FASE I**: Mejorar error handling para distinguir offline vs error
