# ADR 000: Arquitectura inicial - No acoplar UI a OpenClaw

## Estado

Aceptado

## Fecha

2026-04-28

## Contexto

Se necesita definir cómo la interfaz de usuario se comunicará con OpenClaw.

Opciones consideradas:
1. UI se comunica directamente con OpenClaw
2. UI se comunica con backend propio, que a su vez usa un adapter para OpenClaw

## Decisión

**Opción 2**: No acoplar UI directamente a OpenClaw.

La UI se comunica exclusivamente con el backend propio. El backend usa `openclaw-adapter` para toda comunicación con OpenClaw.

## Motivo

- **Mantenibilidad**: Cambios en OpenClaw no afectan directamente a la UI
- **Seguridad**: API keys y credenciales no se exponen al cliente
- **Flexibilidad**: Permite agregar lógica, caché, transformaciones en el backend
- **Testing**: Más fácil mockear el adapter que OpenClaw completo

## Consecuencias

- Requiere mantener un backend propio
- Latencia adicional (UI -> Backend -> OpenClaw)
- Mayor control sobre la experiencia del usuario
