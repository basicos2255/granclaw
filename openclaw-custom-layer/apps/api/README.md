# GranClaw API

Backend API para GranClaw.

## Stack

- Node.js + TypeScript
- HTTP nativo (sin Express/Fastify)
- Memoria in-memory temporal

## Scripts

```bash
npm run dev    # Desarrollo con ts-node
npm run build  # Compilar TypeScript
npm run start  # Ejecutar build
```

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /health | Estado del servidor |
| GET | /tenants | Lista de tenants |
| GET | /users | Lista de usuarios |
| GET | /presets | Lista de presets |
| GET | /agents | Lista de agentes |
| GET | /sessions | Lista de sesiones |
| GET | /tasks | Lista de tareas |
| GET | /audit | Lista de auditoría |

## Estado

- Sin conexión a OpenClaw
- Sin base de datos real
- Memoria temporal in-memory
