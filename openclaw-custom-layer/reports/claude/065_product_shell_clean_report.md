# Reporte FEATURE 065: Product Shell Clean

## 1. Objetivo ejecutado

Convertir la app en "modo producto limpio":
- Eliminar header antiguo web 1.0 de las rutas producto
- Redirigir "/" a UI moderna de Control
- Mantener rutas dev accesibles manualmente

## 2. Archivos modificados

```
apps/web/src/App.tsx
```

## 3. Cambios de routing/shell

### Antes
- "/" mostraba Dashboard técnico JSON
- Header antiguo con 13 botones grises visibles en todas las rutas
- Sensación de panel técnico web 1.0

### Después
- "/" renderiza `<Execute />` (UI moderna)
- Rutas producto: shell limpio sin header antiguo
- Rutas dev: header oscuro técnico con botón "Volver a Producto"

### Detección de modo
```typescript
function isProductRoute(path: string): boolean {
  return path === '/' || path.startsWith('/control')
}
```

## 4. Rutas producto

| Ruta | Componente | Navegación |
|------|------------|------------|
| `/` | Execute | Tab "Control" activo |
| `/control` | Execute | Tab "Control" activo |
| `/control/clientes` | Clientes | Tab "Políticas" activo |
| `/control/dashboard` | ControlDashboard | - |
| `/control/historial` | Historial | Tab "Historial" activo |

### Navegación producto
- Tabs modernos: Control | Políticas | Historial
- Fondo blanco, border-bottom sutil
- Botón activo azul `#2563eb`
- Sin menú técnico visible

## 5. Rutas dev conservadas

| Ruta | Componente |
|------|------------|
| `/dev/dashboard` | DashboardPage |
| `/dev/chat` | ChatPage |
| `/dev/agents` | AgentsPage |
| `/dev/sessions` | SessionsPage |
| `/dev/tasks` | TasksPage |
| `/dev/presets` | PresetsPage |
| `/dev/config` | ConfigPage |
| `/dev/debug` | DebugPage |
| `/login` | LoginPage |

### Header dev
- Fondo oscuro `#1e293b`
- Título "GranClaw Dev" en gris
- Botón "← Volver a Producto" azul
- Tabs compactos para cada página técnica

## 6. Pruebas realizadas

- Build verificado: 57 modules, 176KB
- `/` → UI moderna de Control
- `/control` → UI moderna sin menú antiguo
- `/control/clientes` → Políticas funciona
- `/control/historial` → Historial funciona
- `/dev/dashboard` → Dashboard técnico accesible

## 7. Pendiente

- Ninguno. Shell producto limpio implementado.
