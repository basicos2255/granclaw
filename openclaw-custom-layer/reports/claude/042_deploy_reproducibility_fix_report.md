# REPORTE CLAUDE 042

## 1. Objetivo ejecutado

Hacer el despliegue 100% reproducible sin pasos manuales de TUI que introduzcan errores.

## 2. Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `scripts/granclaw-dev.sh` | Permisos cambiados de 100644 a 100755 |
| `scripts/setup-env.sh` | Nuevo - genera .env con token real |
| `docs/deployment/GRANCLAW_MACMINI_RUNBOOK.md` | Sección 7.1 y comandos rápidos actualizados |
| `PROJECT_MEMORY.md` | Sección FIX 042, prompt y reporte |

## 3. Decisiones aplicadas

| Decisión | Motivo |
|----------|--------|
| Script setup-env.sh en zsh | Compatibilidad con Mac mini |
| Token extraído con `openclaw config get` | Fuente de verdad oficial |
| Validación de token vacío | Fallo temprano si OpenClaw no configurado |
| Prefijo de token en output | Verificación visual sin exponer token |
| Prohibición documentada | Evitar error de command substitution |

## 4. Problemas encontrados

1. **Permisos 100644**: El script bash no era ejecutable en git
   - Fix: `git update-index --chmod=+x`

2. **Command substitution literal**:
   - Error: `.env` contenía `OPENCLAW_API_KEY=$(openclaw config get ...)`
   - Resultado: El servidor recibía el literal del comando, no el token
   - Fix: Script que evalúa el comando y escribe el valor

3. **AUTH_TOKEN_MISMATCH**:
   - Causa: Token incorrecto (literal vs valor)
   - Fix: Generar .env con valor real

## 5. Pruebas realizadas

```bash
# Verificar permisos
git ls-files -s scripts/granclaw-dev.sh
# Resultado: 100755 (ejecutable)

git ls-files -s scripts/setup-env.sh
# Resultado: 100755 (ejecutable)

# Verificación real pendiente en Mac mini:
./scripts/setup-env.sh
npm run dev
curl -s http://localhost:3001/openclaw/auth-status
```

## 6. Pendiente recomendado

1. **Test en Mac mini**: Ejecutar flujo completo de despliegue
2. **Verificar auth-status**: Confirmar que REST/WS/tools responden OK
3. **Documentar fallback manual**: Si `openclaw config get` no está disponible

## 7. Estado de PROJECT_MEMORY.md

- [x] Sección FIX 042 añadida
- [x] Decisión en tabla de decisiones
- [x] Prompt 042 en tabla de prompts
- [x] Reporte 042 en tabla de reportes

---

## Flujo de despliegue correcto

```bash
# 1. Parar procesos
npm run dev:stop

# 2. Actualizar código
git pull && npm install

# 3. Verificar y compilar
npm run check --workspaces --if-present
npm run build --workspaces --if-present

# 4. FIX 042: Generar .env con token REAL
./scripts/setup-env.sh

# 5. Arrancar
npm run dev

# 6. Verificar
curl -s http://localhost:3001/health
curl -s http://localhost:3001/openclaw/auth-status -H "Authorization: Bearer $TOKEN"
```

---

## Error corregido

**ANTES** (incorrecto):
```bash
cat > .env << 'EOF'
OPENCLAW_API_KEY=$(openclaw config get gateway.token)
EOF
# Resultado: .env contiene el literal "$(openclaw config get gateway.token)"
```

**DESPUÉS** (correcto):
```bash
TOKEN=$(openclaw config get gateway.token)
cat > .env << EOF
OPENCLAW_API_KEY=$TOKEN
EOF
# Resultado: .env contiene el valor real del token
```

---

**Fecha**: 2026-05-02
**Estado**: Completado
**Test real**: Pendiente en Mac mini
