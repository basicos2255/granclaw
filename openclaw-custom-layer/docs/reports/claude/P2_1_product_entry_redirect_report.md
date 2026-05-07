# P2.1 — Product Entry Redirect & Shell Visibility

**Fecha:** 2026-05-07
**Autor:** Claude (Arquitecto Enterprise/Runtime Distribuido)
**Estado:** COMPLETADO

## Resumen

Implementacion de redirect principal a experiencia producto, manteniendo panel de control como acceso avanzado.

## Cambios Realizados

### FASE A: Auditoria Router

Archivos analizados:
- `apps/web/src/App.tsx` - Router principal
- `apps/web/src/layouts/Sidebar.tsx` - Navegacion lateral
- `apps/web/src/layouts/Topbar.tsx` - Barra superior

Hallazgos:
- `/` estaba mapeado a `<Execute />` (panel control)
- `/control` y `/` compartian mismo handler
- AppShell no incluia `/` como ruta

### FASE B: Redirect Principal

```typescript
// App.tsx - Router function
// ANTES
if (path === '/' || path === '/control') return <Execute />

// DESPUES
if (path === '/') return <ProductDashboard />
if (path === '/control') return <Execute />
```

### FASE C: Control como Avanzado

```typescript
// Sidebar.tsx - navItems
// ANTES
{ id: 'control', label: 'Control', icon: 'herramientas', path: '/control', advanced: true }

// DESPUES
{ id: 'control', label: 'Control avanzado', icon: 'herramientas', path: '/control', advanced: true }
```

### FASE D: AppShell Route

```typescript
// App.tsx
// ANTES
function isAppShellRoute(path: string): boolean {
  return productRoutes.some(r => path === r || path.startsWith(r + '/'))
}

// DESPUES
function isAppShellRoute(path: string): boolean {
  // P2.1: / ahora es producto con AppShell (redirige a /dashboard)
  return path === '/' || productRoutes.some(r => path === r || path.startsWith(r + '/'))
}
```

## Archivos Modificados

| Archivo | Lineas | Cambio |
|---------|--------|--------|
| `apps/web/src/App.tsx` | 58-65, 81-85 | Router logic |
| `apps/web/src/layouts/Sidebar.tsx` | 29 | Control label |

## Flujo de Navegacion

```
Usuario abre /
    |
    v
isAppShellRoute('/') = true
    |
    v
AppShell wrapper
    |
    v
Router('/') -> <ProductDashboard />
```

## Verificaciones

| Check | Estado |
|-------|--------|
| npm run check | Sin errores |
| npm run build | Exitoso |
| / renderiza ProductDashboard | OK |
| AppShell visible en / | OK |
| /control accesible | OK |
| Sidebar "Control avanzado" | OK |

## Conclusion

P2.1 establece la experiencia de producto como entrada principal:

1. **/** ahora muestra ProductDashboard con AppShell
2. **Control panel** sigue accesible en /control
3. **Sidebar** etiqueta Control como "Control avanzado"
4. **Navegacion** clara entre producto y tecnico
