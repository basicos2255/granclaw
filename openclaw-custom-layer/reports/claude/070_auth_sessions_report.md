# FEATURE 070 - Auth Sessions Base

**Fecha**: 2026-05-02
**Estado**: Completado

---

## Objetivo

Implementar base de autenticacion y sesiones para GranClaw Portal.

---

## Cambios realizados

### Backend

#### 1. Tipos (`apps/api/src/modules/auth/types.ts`)
- RegisterInput: { email: string, name?: string }
- RegisterResult: { success, token?, user?, error? }

#### 2. Servicio (`apps/api/src/modules/auth/service.ts`)
- sessionMap: Map<string, AuthSession> - sesiones en memoria
- register(input): RegisterResult - registro publico
- getSessionCount(): number - contador de sesiones activas
- Actualizado createSession() para usar Map
- Actualizado getSessionByToken() para usar Map
- Actualizado logout() para usar Map

#### 3. Rutas (`apps/api/src/modules/auth/routes.ts`)
- handleRegister() - POST /auth/register

#### 4. Auth Context (`apps/api/src/shared/auth-context.ts`)
- /auth/register añadido a PUBLIC_ENDPOINTS

#### 5. Index (`apps/api/src/index.ts`)
- POST /auth/register registrado

#### 6. Data
- `apps/api/data/users.json` - archivo de persistencia

### Frontend

#### 1. RegisterPage (`apps/web/src/pages/register/index.tsx`)
- Formulario de registro
- Validacion email
- Redireccion a /chat tras registro
- Link a login

#### 2. LoginPage (`apps/web/src/pages/login/index.tsx`)
- Link a /register añadido

#### 3. API Client (`apps/web/src/services/api.ts`)
- api.register(email) añadido

#### 4. App Router (`apps/web/src/App.tsx`)
- Ruta /register añadida
- RegisterPage importado
- devRoutes actualizado

---

## Endpoints

| Metodo | Ruta | Publico | Descripcion |
|--------|------|---------|-------------|
| POST | /auth/register | Si | Registro de usuarios |
| POST | /auth/login | Si | Login con email |
| GET | /auth/me | No | Info usuario autenticado |

---

## Sesiones en memoria

```typescript
const sessionMap: Map<string, AuthSession> = new Map()

interface AuthSession {
  token: string
  userId: string
  tenantId: string
  createdAt: number
  expiresAt: number  // 24h
}
```

**Ventajas**:
- Rapido acceso O(1)
- Sin I/O de archivos para validar token
- Limpieza automatica en expiracion

**Desventajas**:
- Se pierden al reiniciar servidor
- No compartidas entre instancias

---

## Flujo de registro

```
1. Usuario -> /register
2. Introduce email
3. POST /auth/register { email }
4. Backend:
   - Valida email formato
   - Verifica no existe
   - Crea usuario (admin si primero)
   - Crea sesion en Map
   - Devuelve token
5. Frontend guarda token
6. Redirige a /chat
```

---

## Flujo de login

```
1. Usuario -> /login
2. Introduce email
3. POST /auth/login { email }
4. Backend:
   - Busca usuario
   - Si existe y activo -> crea sesion
   - Si no existe y hay usuarios -> error
   - Si no hay usuarios -> crea admin
5. Frontend guarda token
6. Redirige a /chat
```

---

## Archivos creados/modificados

| Archivo | Accion |
|---------|--------|
| apps/api/src/modules/auth/types.ts | Modificado |
| apps/api/src/modules/auth/service.ts | Modificado |
| apps/api/src/modules/auth/routes.ts | Modificado |
| apps/api/src/shared/auth-context.ts | Modificado |
| apps/api/src/index.ts | Modificado |
| apps/api/data/users.json | Creado |
| apps/web/src/pages/register/index.tsx | Creado |
| apps/web/src/pages/login/index.tsx | Modificado |
| apps/web/src/services/api.ts | Modificado |
| apps/web/src/App.tsx | Modificado |
| PROJECT_MEMORY.md | Actualizado |

---

## Proximos pasos

- [ ] Password con hash (bcrypt)
- [ ] OAuth support
- [ ] Persistencia de sesiones para recuperacion tras reinicio
- [ ] Rate limiting en register/login

---

## Notas

- Sesiones NO persisten al reiniciar servidor
- Usuarios SI persisten en JSON
- Primer usuario es admin automaticamente
- Sin password todavia (solo email)
