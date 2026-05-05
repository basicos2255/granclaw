REPORTE CODEX/CLAUDE

1. Objetivo ejecutado

Aplicado Fix 023 pre-deploy para GranClaw sin modificar OpenClaw core:
- `/tenants` y `/users` migrados desde `memory-store` a storage file-based.
- `executeToolViaOpenClaw` usa `OpenClawToolsHttpClient` con POST `/tools/invoke` por defecto.
- RPC `tools.execute` quedó experimental, deshabilitado por defecto y marcado como no confirmado.
- UI mínima de login agregada en `/login`.
- `apps/web/src/services/api.ts` usa `import.meta.env.VITE_API_URL || "http://localhost:3001"`.
- `.env.example`, `.gitignore` y `PROJECT_MEMORY.md` actualizados.

2. Archivos creados/modificados

Archivos creados:
- `apps/web/src/pages/login/index.tsx`
- `apps/web/src/vite-env.d.ts`
- `reports/claude/023_pre_deploy_final_fixes_report.md`

Archivos modificados:
- `.env.example`
- `.gitignore`
- `PROJECT_MEMORY.md`
- `apps/api/src/modules/openclaw/service.ts`
- `apps/api/src/modules/orchestrator/service.ts`
- `apps/api/src/modules/tenants/service.ts`
- `apps/api/src/modules/tenants/types.ts`
- `apps/api/src/modules/users/service.ts`
- `apps/api/src/modules/users/types.ts`
- `apps/web/src/App.tsx`
- `apps/web/package.json`
- `apps/web/src/services/api.ts`
- `packages/openclaw-adapter/src/runtime/openclaw-runtime.adapter.ts`
- `packages/openclaw-adapter/src/tools/openclaw-tools.rpc.ts`

3. Decisiones aplicadas

- `GET /tenants` devuelve solo el tenant autenticado leído desde `storage`.
- `GET /users` devuelve usuarios persistidos del tenant autenticado en forma pública.
- `/tools/invoke` HTTP es la vía por defecto para tools OpenClaw.
- `tools.execute` RPC no se usa salvo `OPENCLAW_TOOLS_RPC_EXPERIMENTAL=true`.
- La UI mantiene router simple y navegación mínima.
- `@granclaw/web` ahora tiene script `check` para que `npm run check --workspaces --if-present` cubra también el frontend.
- `dist`, `node_modules` y `apps/api/data` quedan ignorados, no versionados.

4. Problemas encontrados

- `npm install` literal falló en PowerShell por ExecutionPolicy:
  `No se puede cargar el archivo C:\Program Files\nodejs\npm.ps1 porque la ejecución de scripts está deshabilitada en este sistema.`
- Se ejecutó `npm.cmd install` como equivalente Windows.
- Primer check falló porque `apps/api` compilaba contra declaraciones `dist` stale del adapter:
  `src/modules/orchestrator/service.ts(83,19): error TS2339: Property 'isToolsHttpConfigured' does not exist on type 'OpenClawRuntimeAdapter'.`
- Se corrigió con una comprobación estructural local en orchestrator, sin tocar `dist`.
- Revisión posterior detectó que `@granclaw/web` no tenía script `check`; se agregó `tsc --noEmit` para evitar falso positivo en checks por workspaces.

5. Pruebas realizadas

- `npm install`
  - Resultado real: falló por ExecutionPolicy de PowerShell sobre `npm.ps1`.
- `npm.cmd install`
  - Resultado real: `up to date, audited 94 packages in 5s`.
  - NPM reportó `2 moderate severity vulnerabilities`.
- `npm.cmd run check --workspaces --if-present`
  - Resultado real: primer intento falló con TS2339 en `isToolsHttpConfigured`.
- `npm.cmd run check --workspaces --if-present`
  - Resultado real tras corrección: `@granclaw/api`, `@granclaw/web`, `@granclaw/core` y `@granclaw/openclaw-adapter` pasaron `tsc --noEmit`.
- `npm.cmd run build --workspaces --if-present`
  - Resultado real: `@granclaw/api`, `@granclaw/web`, `@granclaw/core` y `@granclaw/openclaw-adapter` compilaron correctamente.
- `git ls-files openclaw-custom-layer/node_modules openclaw-custom-layer/dist openclaw-custom-layer/apps/api/data openclaw-custom-layer/apps/api/dist openclaw-custom-layer/apps/web/dist openclaw-custom-layer/packages/core/dist openclaw-custom-layer/packages/openclaw-adapter/dist`
  - Resultado real: sin salida, no están versionados.
- `git check-ignore -v node_modules apps\api\dist apps\web\dist packages\core\dist packages\openclaw-adapter\dist apps\api\data`
  - Resultado real: todos cubiertos por `.gitignore`.
- `rg -n 'result\?: unknown|data\?: unknown|role: ''control''|role: "control"|operator\.read/write|RPC devuelve respuesta completa' PROJECT_MEMORY.md`
  - Resultado real: sin matches.
- `rg -n "memory-store|store\." apps\api\src\modules\tenants apps\api\src\modules\users`
  - Resultado real: sin matches.

6. Pendiente recomendado

- Capturar eventos reales chat/session antes de llamar streaming real.
- Resolver vulnerabilidades npm moderadas con revisión separada.
- Validar `/tools/invoke` contra OpenClaw real en Mac mini.
- Mantener `node_modules`, `dist` y `apps/api/data` fuera del deploy versionado.

7. Estado de PROJECT_MEMORY.md

Actualizado:
- RPC response documentado como `ok/payload`.
- RPC event documentado como `event/payload`.
- Handshake documentado con `role: operator` y scopes `operator.read/operator.write`.
- `tools.execute` marcado experimental y no confirmado.
- Añadida sección `Streaming actual`.
- Registrado Fix 023 pre deploy final y reporte `023_pre_deploy_final_fixes_report.md`.
