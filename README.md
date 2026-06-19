# nutri-habits

App full-stack para que pacientes de una nutrióloga registren hábitos diarios (agua, ejercicio, sueño, estado de ánimo) y la nutrióloga monitoree el progreso de todos sus pacientes. Incluye un rol `ADMIN` para gestionar cuentas de nutriólogas y reasignar pacientes.

Tres roles: `PATIENT`, `NUTRITIONIST`, `ADMIN`.

---

## Stack

| Capa | Tecnología |
|---|---|
| Backend | Fastify + TypeScript + Prisma + PostgreSQL |
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS v4 |
| Validación | Zod, en un paquete compartido (`packages/shared`) entre backend y frontend |
| Auth | JWT (access token en memoria + refresh token en cookie `httpOnly`) |
| Routing frontend | React Router |
| Tests | Vitest (backend con Fastify `inject()` contra una BD real; frontend con Testing Library) |
| BD local | Postgres vía Docker Compose |
| BD producción (planeada) | Neon |
| Deploy (planeado) | Render — backend como Web Service, frontend como Static Site |
| CI | GitHub Actions (lint + build + test, con un Postgres de servicio) |

## Estructura del repo (monorepo, npm workspaces)

```
/apps
  /api      → backend Fastify (rutas, Prisma, JWT, bcrypt)
  /web      → frontend React (páginas por rol, cliente API, auth en memoria)
/packages
  /shared   → schemas Zod + tipos TS compartidos entre api y web
/docs
  SPEC.md       → catálogo completo de los 23 endpoints REST (request/response/errores)
  ADR.md        → decisiones de arquitectura: estrategia de auth y modelo de permisos
  db-diagram.dbml → diagrama de base de datos (pegar en dbdiagram.io)
/.github/workflows/ci.yml → lint + build + test en cada push/PR
docker-compose.yml         → Postgres local para desarrollo
CLAUDE.md                  → reglas de proceso del proyecto (ver sección de abajo)
```

---

## Modelo de datos

5 tablas (ver detalle completo y el razonamiento de cada decisión en [`docs/db-diagram.dbml`](docs/db-diagram.dbml)):

- **User** — un único modelo para los tres roles; nunca dos roles en la misma fila. Campos opcionales (`birth_date`, `height`, `weight`) solo tienen sentido para `PATIENT`. `is_active` permite desactivar una cuenta sin borrarla.
- **PatientNutritionist** — tabla intermedia para la relación paciente↔nutrióloga. Estructuralmente N:N (con historial vía `started_at`/`ended_at`), aunque la regla de negocio actual exige una única nutrióloga activa por paciente — forzada con un índice único parcial, no por la forma de la tabla.
- **DailyLog** — una fila por paciente por día (agua, ejercicio, sueño). `UNIQUE(patient_id, date)` evita duplicados ante inserts concurrentes.
- **MoodEntry** — separada de `DailyLog` a propósito: el estado de ánimo es un evento cronometrado, no "un valor por día".
- **RefreshToken** — se guarda solo el hash del token (nunca en texto plano), con `revoked_at` para invalidación individual.

Triggers de Postgres (documentados al final del `.dbml`, no expresables en Prisma) validan que `patient_id`/`nutritionist_id` referencien un `User` con el rol correcto — una FK simple no alcanza para eso. Un índice único parcial garantiza que solo exista un `ADMIN` en todo el sistema.

## API

23 endpoints en 4 dominios — catálogo completo con request/response/códigos de error en [`docs/SPEC.md`](docs/SPEC.md):

- **Auth** (público): `register`, `login`, `refresh`, `logout`. `forgot-password` queda documentado como pendiente a propósito.
- **Paciente** (`PATIENT`): crear/editar/ver historial de 30 días de hábitos, registrar estado de ánimo, ver/editar perfil.
- **Nutrióloga** (`NUTRITIONIST`): lista de pacientes propios, búsqueda de pacientes, detalle de un paciente, asignarse/desasignarse un paciente.
- **Admin** (`ADMIN`): listar/buscar nutriólogas y pacientes, crear usuario, editar usuario, activar/desactivar cuenta, reasignar un paciente a otra nutrióloga.

Reglas de permisos (detalladas en [`docs/ADR.md`](docs/ADR.md)):
- Toda autorización se resuelve del JWT verificado (`req.user`), nunca de un id que mande el cliente — así se garantiza que un paciente no pueda leer ni editar datos de otro paciente (cubierto por un test e2e no negociable).
- Access token de 15 minutos, vive solo en memoria del frontend (nunca en `localStorage`). Refresh token de 7 días en cookie `httpOnly` + `Secure`/`SameSite=None` en producción.

---

## Cómo correr el proyecto en local

### Requisitos
- Node.js (LTS 20.x o 22.x recomendado — el proyecto se desarrolló parcialmente sobre Node 21, que ya no está soportado por algunas dependencias)
- Docker (para Postgres local)

### 1. Levantar la base de datos

```bash
docker compose up -d db
```

### 2. Instalar dependencias (desde la raíz)

```bash
npm install
```

Esto corre automáticamente `prisma generate` en `apps/api` (hook `postinstall`).

### 3. Configurar variables de entorno

```bash
cp apps/api/.env.example apps/api/.env
```

El valor por defecto de `DATABASE_URL` ya apunta al Postgres de `docker-compose.yml`.

### 4. Aplicar migraciones y sembrar el usuario admin

```bash
npm run db:migrate --workspace=apps/api      # aplica prisma/migrations (incluye triggers/CHECK/índices parciales en SQL crudo)
npm run db:seed --workspace=apps/api         # crea root@admin.com / root
```

### 5. Levantar todo

```bash
npm run dev
```

Esto levanta `apps/api` (http://localhost:3001) y `apps/web` (http://localhost:5173) en paralelo (vía `concurrently`).

### Comandos generales (desde la raíz)

```bash
npm run dev      # api + web en paralelo
npm run build    # build de shared, api y web en orden
npm run lint      # eslint sobre todo el repo (config compartida)
npm run test      # vitest en api y web
npm run format    # prettier --write
```

### Cuentas de prueba

- **Admin** (semilla): `root@admin.com` / `root`
- **Paciente**: registrarse desde `/register` (siempre crea rol `PATIENT`)
- **Nutrióloga**: solo la crea un admin, desde el panel de Admin o `POST /admin/users`

---

## Cómo se construyó este proyecto

El desarrollo siguió un proceso deliberadamente "diseño antes que código", definido en [`CLAUDE.md`](CLAUDE.md):

1. **Diagrama de base de datos primero** (`docs/db-diagram.dbml`), revisado críticamente antes de tocar `schema.prisma`.
2. **Catálogo de endpoints en papel** (`docs/SPEC.md`) antes de escribir cualquier handler.
3. **ADR de autenticación y permisos** (`docs/ADR.md`) antes de generar boilerplate de auth.
4. **Scaffolding del monorepo + CI básico**.
5. **Implementación dominio por dominio** (Auth → Paciente → Nutrióloga → Admin), cada uno de punta a punta (backend + frontend + tests) antes de pasar al siguiente.
6. **Rediseño responsivo** (mobile-first → desktop) sobre el frontend ya funcional.

Cada paso de implementación se hizo en una rama de feature propia, con su propio commit, y se mergeó a `master` antes de empezar el siguiente paso.

## Cómo se usó Claude Code

Este proyecto se construyó íntegramente en conversación con Claude Code, con un rol deliberadamente distinto al de "generador de código a pedido":

- **Claude como entrevistador, no como autor, en la fase de diseño.** Para el esquema de BD y el catálogo de endpoints, Claude no propuso un diseño cerrado — hizo preguntas de a una (acciones / datos / errores por dominio), señaló huecos y casos borde no obvios (ventanas de edición, aislamiento entre pacientes, validación de roles en triggers), y dejó decisiones de producto explícitamente en manos del usuario en vez de asumirlas en silencio.
- **`CLAUDE.md` como contrato del repo.** Define qué puede y qué no puede decidir Claude por su cuenta (ej. "no decide endpoints nuevos", "no genera código de auth que el usuario no pueda explicar línea por línea"), los códigos HTTP esperados (400/401/403/422) y la regla de mobile-first — y esas reglas se respetaron durante toda la implementación.
- **Un plan explícito antes de tocar código de implementación.** Antes de programar los tres dominios restantes, se usó el modo de planificación de Claude Code para producir un plan escrito (rama por feature, merge a `master` entre pasos, orden de trabajo) que el usuario aprobó antes de ejecutar.
- **Verificación real, no solo compilación.** Cada dominio se probó con tests automatizados (Vitest, incluyendo el test de aislamiento entre pacientes) y, además, manejando un browser real vía Playwright en viewport mobile para confirmar que la UI funcionaba de punta a punta — no solo que el build pasara.
- **Decisiones de seguridad explícitas, no implícitas.** Dónde vive el access token, si el refresh token rota, qué algoritmo de hashing usar, qué pasa si la nutrióloga asignada se desactiva — cada una de estas decisiones se discutió con opciones y trade-offs antes de implementarse, documentado en `docs/ADR.md`.
- **Flujo de git acordado, no improvisado.** El propio usuario definió (vía modo de planificación) que cada paso terminado se commitea en una rama nueva nombrada según la funcionalidad y se mergea a `master` antes de arrancar el siguiente — Claude pidió autorización explícita antes de mergear directo a `master` la primera vez que esa acción quedó bloqueada por el clasificador de auto-modo.

## Estado actual / pendiente

- ✅ Diseño completo (BD, endpoints, ADR), los 4 dominios funcionales con tests, frontend responsivo mobile→desktop.
- ⏳ `POST /auth/forgot-password` — documentado como pendiente en `SPEC.md`, requiere decidir proveedor de email antes de diseñarse.
- ⏳ Deploy en producción (Render + Neon) — deliberadamente dejado para el final; por ahora todo se corre en local.
