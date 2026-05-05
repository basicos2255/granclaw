# REPORTE CLAUDE 041

## 1. Objetivo ejecutado

Consolidar el fix real del handshake WS alineando el flujo con el protocolo oficial de OpenClaw Gateway:

**Antes (incorrecto)**:
```
open -> connect (inmediato) -> timeout/error
```

**Después (correcto)**:
```
open -> wait for connect.challenge -> connect -> hello-ok
```

## 2. Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `packages/openclaw-adapter/src/ws/openclaw-ws.client.ts` | Implementación completa del flujo connect.challenge |
| `PROJECT_MEMORY.md` | Sección FIX 041, decisión, prompt, reporte |

### Cambios en openclaw-ws.client.ts:

**Línea 1-16**: Añadido comentario CRITICAL sobre protocolo

**Líneas 139-142**: Nuevos estados:
```typescript
private connectChallengeSeen = false
private connectChallengeNonce: string | null = null
private connectChallengeResolver: (() => void) | null = null
```

**Líneas 320-325**: Reset de estados en disconnect()

**Líneas 419-449**: Nuevo método `waitForConnectChallenge(timeout)`

**Líneas 459-468**: performHandshake espera challenge antes de connect

**Líneas 589-607**: handleEvent detecta connect.challenge

## 3. Decisiones aplicadas

| Decisión | Motivo |
|----------|--------|
| Promise-based wait | Permite await limpio en performHandshake |
| Timeout de 10s | Balance entre espera y detección de error |
| NO añadir nonce a params | Rompe schema de OpenClaw |
| Return early en handleEvent | No pasar challenge a handlers normales |
| Reset completo en disconnect | Evitar estado corrupto en reconexión |

## 4. Problemas encontrados

1. **Protocolo no documentado**: El flujo connect.challenge no estaba documentado oficialmente
2. **Nonce ambiguo**: No claro si nonce debe usarse en connect params (decisión: NO)
3. **Race condition potencial**: Resuelto con check doble en waitForConnectChallenge

## 5. Pruebas realizadas

```bash
# Type check
npm run check --workspace=@granclaw/openclaw-adapter
# Resultado: OK

# Build completo
npm run build --workspaces --if-present
# Resultado: OK

# Prueba real pendiente contra OpenClaw Gateway
# Debe verificar:
# curl -s http://localhost:3001/openclaw/auth-status -H "Authorization: Bearer $TOKEN"
# Esperado: ws: ok, wsHandshakeComplete: true
```

## 6. Pendiente recomendado

1. **Test real**: Ejecutar contra OpenClaw Gateway en Mac mini
2. **Verificar logs**: Confirmar secuencia CONNECT CHALLENGE RECEIVED -> CONNECT SENT -> HELLO OK
3. **Documentar nonce**: Si OpenClaw usa nonce para algo, documentar el uso

## 7. Estado de PROJECT_MEMORY.md

- [x] Sección FIX 041 añadida con problema, causa, solución, flujo, logging, CRITICAL
- [x] Decisión añadida en tabla de decisiones
- [x] Prompt 041 añadido en tabla de prompts
- [x] Reporte 041 añadido en tabla de reportes

---

## Código crítico

```typescript
// CRITICAL: OpenClaw requires connect.challenge before connect.
// Do not send connect before receiving challenge. Changing this breaks WS completely.

// In handleEvent:
if (event.event === 'connect.challenge') {
  console.log('[WS] CONNECT CHALLENGE RECEIVED')
  this.connectChallengeSeen = true
  this.connectChallengeNonce = payload?.nonce || null
  if (this.connectChallengeResolver) {
    this.connectChallengeResolver()
  }
  return
}

// In performHandshake:
await this.waitForConnectChallenge(10000)
console.log('[WS] CONNECT CHALLENGE RECEIVED, nonce:', this.connectChallengeNonce || 'none')
// Solo después de esto: request('connect', params)
```

---

**Fecha**: 2026-05-02
**Estado**: Completado
**Build**: OK
**Test real**: Pendiente
