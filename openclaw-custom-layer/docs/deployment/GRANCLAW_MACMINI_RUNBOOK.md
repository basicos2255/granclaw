# GranClaw x OpenClaw — Mac mini Deployment Runbook

## 1. Objetivo

**GranClaw** es una capa UI/API/adapters sobre **OpenClaw**.
- OpenClaw es el motor principal.
- GranClaw NO modifica OpenClaw core.
- GranClaw proporciona UI, API backend, presets, agents, sessions y tools.

---

## 2. Arquitectura operativa

```
GranClaw Web UI (:5173)
  └─> GranClaw API (:3001)
        └─> OpenClaw Adapter
              └─> OpenClaw Gateway (:18789)
                    ├─> REST /v1/chat/completions (fallback)
                    ├─> WS/RPC (control plane principal)
                    ├─> /tools/invoke (ejecución tools)
                    └─> /hooks/* (si enabled)
```

**Notas:**
- REST = fallback cuando WS no disponible
- WS/RPC = control plane principal (handshake obligatorio)
- /tools/invoke = superficie sensible de operador
- Streaming actual = ACK mode; streaming real pendiente de eventos WS

---

## 3. Requisitos previos

### Software
- macOS en Mac mini
- Git instalado
- Node.js LTS (recomendado 20.x, mínimo 18.x)
- npm
- OpenClaw instalado y funcionando

### Verificar
```bash
node -v          # >= 18.0.0
npm -v           # >= 9.0.0
git --version
openclaw status  # Gateway running
```

### Puertos
| Servicio | Puerto | Notas |
|----------|--------|-------|
| OpenClaw Gateway | 18789 | Configurable en openclaw.json |
| GranClaw API | 3001 | APP_PORT |
| GranClaw Web | 5173 | Vite dev server |

### Archivos
- Repo GranClaw clonado
- Acceso a `~/.openclaw/openclaw.json`

---

## 4. Instalación limpia

### 4.1 Clonar repo
```bash
git clone <REPO_URL> granclaw
cd granclaw
```

### 4.2 Limpiar artefactos
```bash
rm -rf node_modules
rm -rf apps/*/dist packages/*/dist dist
find . -name "*.tsbuildinfo" -delete
```

### 4.3 Instalar dependencias
```bash
npm install
```

### 4.4 Verificar
```bash
npm run check --workspaces --if-present
npm run build --workspaces --if-present
```

---

## 5. Actualización de instalación existente

### 5.1 Parar procesos viejos
```bash
# Ver procesos en puertos
lsof -nP -iTCP:3001 -sTCP:LISTEN
lsof -nP -iTCP:5173 -sTCP:LISTEN

# Matar procesos
kill -9 $(lsof -t -i:3001) 2>/dev/null || true
kill -9 $(lsof -t -i:5173) 2>/dev/null || true
```

### 5.2 Actualizar repo
```bash
git fetch --all
git pull
```

### 5.3 Limpiar build
```bash
rm -rf apps/*/dist packages/*/dist dist
find . -name "*.tsbuildinfo" -delete
```

### 5.4 Reinstalar/build
```bash
npm install
npm run check --workspaces --if-present
npm run build --workspaces --if-present
```

**ADVERTENCIA:**
- NO borrar `apps/api/data/` en actualización si contiene usuarios/tokens locales.
- Solo borrar `data/` en instalación limpia o reset consciente.

---

## 6. Configuración OpenClaw obligatoria

OpenClaw es fuente de verdad de tokens.

### 6.1 Abrir configuración
```bash
cat ~/.openclaw/openclaw.json
# o
nano ~/.openclaw/openclaw.json
```

### 6.2 Configuración mínima requerida
```json
{
  "gateway": {
    "auth": {
      "token": "<GATEWAY_TOKEN>"
    },
    "http": {
      "endpoints": {
        "chatCompletions": {
          "enabled": true
        }
      }
    }
  }
}
```

### 6.3 Si se usan hooks (opcional)
```json
{
  "hooks": {
    "enabled": true,
    "token": "<HOOKS_TOKEN>",
    "allowRequestSessionKey": true,
    "allowedSessionKeyPrefixes": ["hook:"],
    "defaultSessionKey": "hook:ingress"
  }
}
```

**IMPORTANTE:**
- `chatCompletions.enabled=true` para usar REST fallback
- `hooks.enabled=true` solo si se usarán hooks
- `hooks.token` NO activa hooks por sí solo
- `sessionKey` es routing, no auth

### 6.4 Leer tokens
```bash
# Gateway token
openclaw config get gateway.token
# o
cat ~/.openclaw/openclaw.json | jq -r '.gateway.auth.token'

# Hooks token (si aplica)
cat ~/.openclaw/openclaw.json | jq -r '.hooks.token'
```

---

## 7. Variables de entorno GranClaw

**IMPORTANTE:** La API usa `dotenv` como dependencia para cargar `.env` automáticamente.
- `npm install` instala dotenv
- Al arrancar, la API carga `.env` desde la raíz del repo
- Si faltan variables críticas, muestra WARNING en consola

### 7.1 Crear archivo .env (FIX 042 - AUTOMÁTICO)

**RECOMENDADO**: Usar script automático que extrae token real:
```bash
./scripts/setup-env.sh
```

Este script:
- Lee el token de `openclaw config get gateway.token`
- Genera `.env` con el valor REAL del token
- Evita errores de command substitution literal

**MANUAL** (solo si el script falla):
```bash
# Primero obtener el token REAL
TOKEN=$(openclaw config get gateway.token)
echo "Token: $TOKEN"

# Luego crear .env con el valor
cat > .env << EOF
# Application Ports
APP_PORT=3001
WEB_PORT=5173
NODE_ENV=development

# OpenClaw Connection
OPENCLAW_BASE_URL=http://localhost:18789
OPENCLAW_WS_URL=ws://localhost:18789/__openclaw__/ws
OPENCLAW_API_KEY=$TOKEN

# WebSocket Client Identity
OPENCLAW_WS_CLIENT_ID=gateway-client
OPENCLAW_WS_CLIENT_MODE=backend

# Web UI
VITE_API_URL=http://localhost:3001
EOF
```

**PROHIBIDO** (causa AUTH_TOKEN_MISMATCH):
```bash
# NO HACER ESTO - el literal del comando se guarda, no el valor
OPENCLAW_API_KEY=$(openclaw config get gateway.token)
```

### 7.2 Variables explicadas

| Variable | Uso | Notas |
|----------|-----|-------|
| `OPENCLAW_BASE_URL` | REST + /tools/invoke | Gateway HTTP |
| `OPENCLAW_WS_URL` | WebSocket RPC | FIX 040: `/__openclaw__/ws` endpoint |
| `OPENCLAW_API_KEY` | Auth para REST, WS y tools | FIX 040: Bearer header en WS upgrade |
| `VITE_API_URL` | UI conecta a API | localhost o IP |

**Nota:** GranClaw usa `OPENCLAW_API_KEY` para todas las superficies (REST, WS, tools).
FIX 040: El token se envía como `Authorization: Bearer` header en el upgrade request de WebSocket.
Si OpenClaw requiere tokens separados, modificar código o usar gateway token unificado.

### 7.3 Variables WS client identity (FIX 034 - OFICIAL)

| Variable | Default | Notas |
|----------|---------|-------|
| `OPENCLAW_WS_CLIENT_ID` | `gateway-client` | Valor oficial para backend confiable |
| `OPENCLAW_WS_CLIENT_MODE` | `backend` | Valor oficial para backend confiable |
| `OPENCLAW_WS_CLIENT_VARIANTS` | `gateway-client:backend,cli:operator` | Fallbacks oficiales |

**Valores oficiales documentados:**
- Backend confiable: `client.id=gateway-client`, `client.mode=backend`
- CLI: `client.id=cli`, `client.mode=operator`

**IMPORTANTE:** No usar valores arbitrarios. Solo valores soportados por OpenClaw Gateway schema.

---

## 8. Arranque correcto

### 8.1 Verificar OpenClaw
```bash
openclaw status
curl -s http://localhost:18789/v1/models -H "Authorization: Bearer $OPENCLAW_API_KEY"
```

### 8.2 Parar procesos viejos (RECOMENDADO)
```bash
# Usar script unificado
npm run dev:stop
```

**O manualmente:**
```bash
# Inspección
lsof -nP -iTCP:3001 -sTCP:LISTEN
lsof -nP -iTCP:5173 -sTCP:LISTEN

# Matar procesos
kill -9 $(lsof -t -i:3001) 2>/dev/null || true
kill -9 $(lsof -t -i:5173) 2>/dev/null || true
```

### 8.3 Arranque recomendado (desarrollo)
```bash
# Arrancar API + Web con un solo comando
npm run dev

# Ver estado
npm run dev:status

# Ver logs
npm run dev:logs
```

**IMPORTANTE:**
- `npm run dev` limpia puertos 3001/5173 automáticamente
- Web escucha en `0.0.0.0` para acceso desde red local
- Logs y PIDs se guardan en `.run/`

### 8.4 Runtime compilado (producción local)
```bash
npm run build
npm run start:api   # API compilada
npm run start:web   # Web en preview mode
```

### 8.5 Regla importante

**No mezclar:**
- API en `start` (compilada)
- Web en `dev` (Vite dev server)

**Usar un modo por entorno:**
- Todo `dev` → `npm run dev`
- Todo compilado → `npm run build` + `npm run start:api` + `npm run start:web`

---

## 9. URLs visuales / UIX

### Desde Mac mini (local)
- Login: http://localhost:5173/login
- Chat: http://localhost:5173/chat
- Dashboard: http://localhost:5173/

### Desde Windows/otra máquina
- Login: http://<IP_MAC_MINI>:5173/login
- Health: http://<IP_MAC_MINI>:3001/health

**Notas:**
- Primer login crea admin temporal si no hay usuarios
- NO borrar `apps/api/data/` tras crear admin (salvo reset)
- Chat funciona en ACK mode (no streaming real)

---

## 10. Validación obligatoria post-arranque

### 10.1 Endpoints públicos (sin token)
```bash
# Health (público)
curl -s http://localhost:3001/health

# OpenClaw status (público)
curl -s http://localhost:3001/openclaw/status
```

### 10.2 Login (obtener token)
```bash
# Crear/login admin
TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@granclaw.local"}' | jq -r '.data.token')

echo "Token: $TOKEN"
```

### 10.3 Endpoints protegidos (requieren token)
```bash
# Auth validation (REST, WS, tools)
curl -s http://localhost:3001/openclaw/auth-status \
  -H "Authorization: Bearer $TOKEN" | jq

# WS RPC status
curl -s http://localhost:3001/openclaw/ws-rpc-status \
  -H "Authorization: Bearer $TOKEN" | jq

# Tools status
curl -s http://localhost:3001/openclaw/tools-status \
  -H "Authorization: Bearer $TOKEN" | jq

# Tools list
curl -s http://localhost:3001/tools \
  -H "Authorization: Bearer $TOKEN" | jq
```

### 10.4 Probar orquestador (protegido)
```bash
curl -s -X POST http://localhost:3001/orchestrator/run \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"message":"time"}' | jq
```

---

## 11. Interpretación de auth-status

```json
{
  "rest": "ok|fail|not_configured",
  "ws": "ok|fail|not_configured",
  "tools": "ok|fail|not_configured",
  "details": { ... }
}
```

### REST fail
- Token incorrecto
- Endpoint `/v1/models` deshabilitado
- Gateway no accesible

### WS fail
- WS URL incorrecta
- Token incorrecto
- Handshake requiere campos adicionales

### Tools fail
- Token sin permisos
- `/tools/invoke` no accesible
- Gateway protege endpoint

---

## 12. Troubleshooting

### A. Puerto 3001 ocupado
```bash
kill -9 $(lsof -t -i:3001) 2>/dev/null || true
```

### B. Puerto 5173 ocupado
```bash
kill -9 $(lsof -t -i:5173) 2>/dev/null || true
```

### C. /v1/chat/completions 404
Activar en `~/.openclaw/openclaw.json`:
```json
"gateway.http.endpoints.chatCompletions.enabled": true
```

### D. /hooks/agent 404
Activar en `~/.openclaw/openclaw.json`:
```json
"hooks.enabled": true
```

### E. /tools/invoke 401/403
- Revisar `OPENCLAW_API_KEY`
- Verificar gateway token

### F. WS handshake fail
- Verificar `OPENCLAW_WS_URL`
- Verificar token
- Revisar minProtocol/maxProtocol (actualmente v3)
- Si error INVALID_REQUEST con `/client/id` o `/client/mode`:
  - Usar valores oficiales: `gateway-client` y `backend` (ver sección 7.3)
  - NO usar valores arbitrarios (ej: `granclaw`, `web`)
  - Solo valores soportados por OpenClaw Gateway schema

### G. UI no conecta
- Verificar `VITE_API_URL`
- Verificar CORS (permitido por defecto)

### H. Login no funciona
- Verificar `apps/api/data/` existe
- Verificar permisos de escritura
- Primer login crea admin automáticamente

---

## 13. Seguridad mínima

**En primera fase:**
- NO exponer GranClaw ni OpenClaw a internet
- `/tools/invoke` es superficie de operador completo
- Usar solo loopback o red privada

**NO subir al repo:**
- `.env`
- `apps/api/data/`
- Tokens

**Producción:**
- Configurar CORS restrictivo
- Usar HTTPS
- Implementar auth con password

---

## 14. Limpieza y reset controlado

### Reset DEV (borra usuarios/sesiones)
```bash
rm -rf apps/api/data
```

### Update normal
```bash
# NO borrar apps/api/data
git pull
npm install
npm run build --workspaces
```

### Limpiar build
```bash
rm -rf apps/*/dist packages/*/dist dist
find . -name "*.tsbuildinfo" -delete
```

---

## 15. Checklist final

- [ ] OpenClaw arriba (`openclaw status`)
- [ ] `openclaw.json` con `chatCompletions.enabled`
- [ ] `hooks.enabled` si se usan hooks
- [ ] Tokens copiados a `.env`
- [ ] Puerto 3001 libre
- [ ] Puerto 5173 libre
- [ ] `npm install` OK
- [ ] `npm run check` OK
- [ ] `npm run build` OK
- [ ] API arranca sin errores
- [ ] UI arranca sin errores
- [ ] `/health` responde OK
- [ ] `/openclaw/auth-status` revisado
- [ ] Login funciona
- [ ] Ruta protegida 401 sin token
- [ ] Ruta protegida OK con token
- [ ] Orchestrator responde
- [ ] Logs sin errores críticos

---

## 16. Definition of Done

GranClaw está correctamente desplegado cuando:

1. API y UI arrancan en puertos canónicos (3001, 5173)
2. `/health` responde OK
3. `/openclaw/auth-status` devuelve diagnóstico claro
4. Login funciona
5. `/chat` carga
6. Orchestrator responde sin errores
7. No quedan procesos viejos en 3001/5173
8. No hay tokens expuestos en repo

---

## Apéndice: Comandos rápidos

### A. Desarrollo (recomendado) - FIX 042
```bash
# Parar, actualizar, arrancar
npm run dev:stop
git pull && npm install
npm run check --workspaces --if-present
npm run build --workspaces --if-present

# FIX 042: Generar .env con token REAL
./scripts/setup-env.sh

# Arrancar
npm run dev

# Verificar
npm run dev:status
curl -s http://localhost:3001/health

# Login y endpoints protegidos
TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@granclaw.local"}' | jq -r '.data.token')

curl -s http://localhost:3001/openclaw/auth-status \
  -H "Authorization: Bearer $TOKEN" | jq
```

### B. Producción local
```bash
# Parar, build, arrancar
npm run dev:stop
npm run build --workspaces --if-present
npm run start:api &
npm run start:web &

# Verificar
sleep 3
curl -s http://localhost:3001/health
```
