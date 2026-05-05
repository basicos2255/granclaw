# GranClaw TUI Bootstrap Commands

Comandos en orden para despliegue automático.

**Nota:** `npm install` instala `dotenv` como dependencia de @granclaw/api.
La API carga `.env` automáticamente al arrancar via `import 'dotenv/config'`.

---

## Flujo recomendado (FIX 039)

### 1. Stop existing processes
```bash
npm run dev:stop
```

### 2. Pull repo
```bash
cd ~/granclaw  # o path del repo
git fetch --all
git pull
```

### 3. Install
```bash
npm install
```

### 4. Build
```bash
npm run check --workspaces --if-present
npm run build --workspaces --if-present
```

### 5. Write .env (si no existe)
```bash
cat > .env << 'EOF'
APP_PORT=3001
NODE_ENV=development
OPENCLAW_BASE_URL=http://localhost:18789
OPENCLAW_WS_URL=ws://localhost:18789/ws
OPENCLAW_API_KEY=<INSERT_GATEWAY_TOKEN>
VITE_API_URL=http://localhost:3001
EOF
```

### 6. Verify OpenClaw config
```bash
openclaw status
cat ~/.openclaw/openclaw.json | jq -r '.gateway.auth.token'
```

### 7. Start (development)
```bash
npm run dev
```

### 8. Verify status
```bash
npm run dev:status
```

### 9. Health check
```bash
curl -s http://localhost:3001/health | jq
```

### 10. Login y endpoints protegidos
```bash
# Obtener token
TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@granclaw.local"}' | jq -r '.data.token')

echo "Token: $TOKEN"

# Endpoints protegidos (requieren token)
curl -s http://localhost:3001/openclaw/auth-status \
  -H "Authorization: Bearer $TOKEN" | jq

curl -s http://localhost:3001/openclaw/tools-status \
  -H "Authorization: Bearer $TOKEN" | jq

curl -s http://localhost:3001/tools \
  -H "Authorization: Bearer $TOKEN" | jq
```

### 11. View logs
```bash
npm run dev:logs
```

---

## One-liner completo (desarrollo)
```bash
npm run dev:stop && \
git pull && \
npm install && \
npm run check --workspaces --if-present && \
npm run build --workspaces --if-present && \
npm run dev
```

---

## Validación rápida
```bash
# Status
npm run dev:status

# Health (público)
curl -s http://localhost:3001/health | jq

# Login y guardar token
TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@granclaw.local"}' | jq -r '.data.token')

# Auth status (protegido)
curl -s http://localhost:3001/openclaw/auth-status \
  -H "Authorization: Bearer $TOKEN" | jq

# Test orchestrator (protegido)
curl -s -X POST http://localhost:3001/orchestrator/run \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"message":"time"}' | jq
```

---

## Producción local
```bash
npm run dev:stop
npm run build --workspaces --if-present
npm run start:api &
npm run start:web &
sleep 3
curl -s http://localhost:3001/health
```

---

## Parar todo
```bash
npm run dev:stop
```

---

## Comandos útiles
```bash
# Ver estado
npm run dev:status

# Ver logs
npm run dev:logs

# Reiniciar
npm run dev:restart
```
