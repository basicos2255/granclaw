# GranClaw Portal — Guía Maestra (v1)

## 1) Definición
GranClaw = Portal SaaS que convierte OpenClaw (motor) en un producto usable para empresas:
- Control (Hub): decide qué se puede ejecutar
- Ejecución (OpenClaw): ejecuta tareas
- Experiencia (UI): comunica decisiones y resultados

---

## 2) Arquitectura del Portal

GranClaw Portal
├── Autenticación
│   ├── Registro / Login
│   ├── Sesiones persistentes
│   └── Roles (admin / user)
├── Dashboard
├── Ejecutar (Control)
├── Tareas
│   ├── Simple
│   ├── Secuencial
│   └── Repetitiva (cron)
├── Agentes (Capacidades)
│   ├── Catálogo
│   ├── Herramientas
│   └── Permisos
├── Políticas (Hub)
├── Historial / Auditoría
└── Dev Mode (oculto)

---

## 3) Módulos clave

### 3.1 Autenticación
- Login / Register
- Cookie o token (httpOnly recomendado)
- Persistencia de sesión
- Roles básicos

### 3.2 Ejecutar (Control)
Flujo:
Usuario → Hub decide → (si permitido) OpenClaw ejecuta → Resultado

### 3.3 Tareas
- Crear tarea
- Secuencias
- Repetición
- Estados

### 3.4 Agentes
- Lista de agentes
- Qué hacen
- Herramientas

---

## 4) Objetivo

"Portal empresarial de control y ejecución de IA"
