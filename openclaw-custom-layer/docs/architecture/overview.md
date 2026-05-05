# Arquitectura Overview

## Flujo de datos

```
┌─────────┐     ┌─────────┐     ┌──────────────────┐     ┌─────────────────┐
│   UI    │ --> │ Backend │ --> │ OpenClaw Adapter │ --> │ OpenClaw Gateway│
│  (web)  │ <-- │  (api)  │ <-- │                  │ <-- │                 │
└─────────┘     └─────────┘     └──────────────────┘     └─────────────────┘
```

## Capas

1. **UI (apps/web)**: Interfaz de usuario
2. **Backend (apps/api)**: API REST, lógica de negocio
3. **Adapter (packages/openclaw-adapter)**: Abstracción de comunicación con OpenClaw
4. **OpenClaw Gateway**: Motor externo (no modificable)

## Principios

- Desacoplamiento entre capas
- Adapter como única interfaz con OpenClaw
- UI nunca se comunica directamente con OpenClaw
- Configuración via variables de entorno
