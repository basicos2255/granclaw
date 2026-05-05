# FEATURE 100: Real Capabilities v1 (Sandbox)

**Fecha**: 2026-05-04
**Estado**: Completado

## 1. Objetivo ejecutado

Implementar capacidades REALES (no mock) pero SEGURAS en un sandbox:
- Crear sandbox filesystem aislado
- Operaciones de archivos reales (read/write/list)
- Validaciones de seguridad (path traversal, tamaño, extensiones)
- Integración con capabilities existentes
- Mostrar rutas de archivos en frontend

## 2. Archivos creados

| Archivo | Descripción |
|---------|-------------|
| apps/api/src/storage/sandbox.ts | Módulo sandbox filesystem |
| apps/api/data/sandbox/ | Directorio de archivos sandbox |

## 3. Archivos modificados

| Archivo | Cambios |
|---------|---------|
| apps/api/src/storage/index.ts | Export sandbox module |
| apps/api/src/modules/orchestrator/routes.ts | Import sandbox, executeCapabilitySafeV1 actualizado |
| apps/web/src/components/control/OutputViewer.tsx | filePath y sandboxPath display |

## 4. Sandbox Module

### Funciones exportadas

```typescript
// Lee archivo del sandbox
readFile(filePath: string): SandboxResult

// Escribe archivo al sandbox
writeFile(filePath: string, content: string, overwrite?: boolean): SandboxResult

// Lista archivos del sandbox
listFiles(subPath?: string): SandboxResult

// Elimina archivo del sandbox
deleteFile(filePath: string): SandboxResult

// Obtiene info del archivo
getFileInfo(filePath: string): SandboxResult & { info?: SandboxFileInfo }

// Devuelve ruta del sandbox
getSandboxPath(): string
```

### Tipos

```typescript
interface SandboxResult {
  success: boolean
  error?: string
  data?: string
  filePath?: string
  files?: SandboxFileInfo[]
}

interface SandboxFileInfo {
  name: string
  path: string
  size: number
  createdAt: string
  modifiedAt: string
  isDirectory: boolean
}
```

## 5. Seguridad implementada

### Path traversal prevention
```typescript
function validatePath(inputPath: string): string | null {
  // Block obvious path traversal
  if (cleanPath.includes('..') || cleanPath.includes('~')) {
    return null
  }
  // Block absolute paths
  if (path.isAbsolute(cleanPath)) {
    return null
  }
  // Verify still within sandbox
  if (!resolved.startsWith(SANDBOX_DIR)) {
    return null
  }
  return resolved
}
```

### Extensiones permitidas
```typescript
const ALLOWED_EXTENSIONS = [
  '.txt', '.md', '.json', '.csv',
  '.log', '.xml', '.html', '.css'
]
```

### Límite de tamaño
```typescript
const MAX_FILE_SIZE = 1024 * 1024 // 1MB
```

## 6. Capabilities actualizadas

### open_text_editor
- Genera nombre de archivo desde la acción
- Crea archivo REAL en sandbox
- Devuelve filePath y sandboxPath
- Contenido editable en frontend

### write_local_file
- Extrae nombre de archivo de la acción
- Escribe archivo REAL en sandbox
- Soporta contenido desde la acción
- Devuelve filePath y sandboxPath

### read_local_file
- Busca archivo en sandbox
- Si no existe: lista archivos disponibles
- Si existe: devuelve contenido
- Devuelve filePath y sandboxPath

## 7. Frontend OutputViewer

### Tipos actualizados
```typescript
interface DocumentOutput {
  // ... campos existentes
  filePath?: string      // FEATURE 100
  sandboxPath?: string   // FEATURE 100
}
```

### UI actualizada
- Badge azul con icono 📄 y ruta del archivo
- Footer con icono 📁 y ruta del sandbox
- Tanto para document como info types

## 8. Flujo de ejecución

```
Usuario: "abre el editor de texto"
    |
    v
detectMissingCapability() -> open_text_editor
    |
    v
getCapabilityByToolName() -> capability aprobada
    |
    v
executeCapabilitySafeV1()
    |
    v
sandbox.writeFile("documento_2026-05-04.txt", content)
    |
    v
{ success: true, filePath: "documento_2026-05-04.txt", ... }
    |
    v
Frontend: OutputViewer muestra contenido + filePath
```

## 9. Logs de auditoría

```
[GranClaw Capability] Executing: open_text_editor
[GranClaw Capability] Action: abre el editor de texto
[GranClaw Capability] File created: documento_2026-05-04.txt
```

## 10. Build

```
npm run build
> tsc && vite build
✓ built in 2.64s
```

## 11. Verificaciones

| Escenario | Resultado |
|-----------|-----------|
| open_text_editor → crea archivo | ✅ |
| write_local_file → escribe archivo | ✅ |
| read_local_file → lee archivo | ✅ |
| Path traversal (../) | ✅ Bloqueado |
| Extension .exe | ✅ Rechazado |
| Archivo > 1MB | ✅ Rechazado |
| Frontend muestra filePath | ✅ |
| Frontend muestra sandboxPath | ✅ |
| Build exitoso | ✅ |

## 12. Próximos pasos sugeridos

1. **FEATURE 101**: Guardar ediciones desde OutputViewer al sandbox
2. **FEATURE 102**: Listar archivos del sandbox en UI
3. **FEATURE 103**: Descargar archivos del sandbox
4. **FEATURE 104**: Confirmación antes de operaciones (UI modal)
5. **FEATURE 105**: Límites de archivos por tenant
