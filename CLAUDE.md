# CLAUDE.md

Nombre de trabajo del proyecto: **nutri-habits** (cambialo cuando quieras, no es relevante para la evaluación).

## Resumen del proyecto

App full-stack para que pacientes de una nutrióloga registren hábitos diarios (agua, ejercicio, sueño) y la nutrióloga monitoree el progreso de todos sus pacientes. Dos roles: `PATIENT` y `NUTRITIONIST`.

El reto evalúa decisiones de producto — modelado de datos, control de acceso, manejo de concurrencia — no solo que el código compile. Toda decisión de diseño relevante se documenta en `docs/SPEC.md` y `docs/ADR.md` **antes** de implementarse.

## Criterios de aceptación (resumen — ver brief original para el detalle completo)

- Registro y login con JWT + refresh tokens funcionando.
- Paciente registra hábitos diarios y ve su historial de 30 días con un mini-chart.
- Nutrióloga ve la lista de sus pacientes y el detalle de cada uno.
- Ningún paciente puede leer datos de otro paciente — probado con un test e2e.
- Deploy en producción, accesible públicamente con HTTPS.

## Estado actual

Fase de diseño. Todavía no hay código. Ver "Próximos pasos" al final de este documento.

## Stack

- Backend: Fastify + TypeScript + Prisma + PostgreSQL
- Frontend: React + TypeScript + Vite + TailwindCSS
- Validación: Zod, en un paquete compartido entre front y back
- Auth: JWT (access + refresh tokens)
- BD producción: Neon
- Deploy: Render (backend como Web Service, frontend como Static Site)

El brief dejaba algunas de estas opciones abiertas (Fastify/Express, Neon/Supabase/Railway, Render/Railway/Fly.io). Elegí una opción de cada una para poder avanzar — son decisiones reversibles, decime si preferís otra antes de que avancemos a scaffolding.

## Estructura del repo (monorepo)

```
/apps
  /api      → backend Fastify
  /web      → frontend React
/packages
  /shared   → schemas Zod + tipos TS compartidos entre api y web
/docs
  SPEC.md       → catálogo de endpoints + modelo de datos
  ADR.md        → estrategia de auth y modelo de permisos
  db-diagram.*  → diagrama de BD (dbdiagram.io o Excalidraw)
```

Uso monorepo con workspaces (npm o pnpm) en vez de dos repos porque el brief pide compartir los schemas de Zod entre front y back — dentro de un mismo repo eso es un paquete local, sin necesidad de publicar/versionar nada por separado.

## Reglas de proceso (no negociables — vienen del brief, no son una sugerencia)

1. **Endpoints primero en papel.** No se escribe un handler hasta que el endpoint esté documentado en `docs/SPEC.md`. Claude Code no decide ni propone endpoints nuevos por su cuenta — implementa lo que ya está especificado ahí.
2. **Esquema de BD primero como diagrama.** El modelo de datos se diseña en dbdiagram.io o Excalidraw antes de tocar `schema.prisma`. El archivo Prisma es una traducción del diagrama aprobado, nunca al revés.
3. **Cero confianza en el cliente.** Toda entrada externa (body, params, query string) se valida con Zod en el backend, sin excepción, incluso si el frontend ya validó lo mismo.
4. **Códigos HTTP correctos y consistentes:**
   - `400` → body malformado / JSON inválido
   - `422` → body bien formado pero falla una regla de negocio (ej. fecha futura en un registro de hábito)
   - `401` → no autenticado (token ausente, inválido o expirado)
   - `403` → autenticado pero sin permiso sobre ese recurso (ej. paciente pidiendo datos de otro paciente)
5. **Mobile-first.** Cada vista se diseña y prueba primero en viewport de celular antes que en desktop.

## Cómo debe (y no debe) ayudar Claude Code en este proyecto

**Sí, puede generar:**
- Boilerplate de auth (middleware, hashing de contraseñas, firma/verificación de JWT) una vez que el flujo ya esté decidido en `docs/ADR.md`.
- Componentes UI repetitivos (inputs, cards, layout).
- Migrations de Prisma, a partir del diagrama de BD ya aprobado.
- Configuración inicial de Tailwind y Vite.

**No debe:**
- Decidir el diseño de los endpoints — eso lo decide el usuario en `SPEC.md`.
- Generar componentes que el usuario no pueda explicar línea por línea, en particular los hooks que usan.
- Generar o aceptar código de auth sin que el usuario pueda explicar exactamente qué firma, qué guarda, y dónde lo guarda (localStorage vs. cookie, vida del access token, vida del refresh token).

Si una petición implica decidir un endpoint o un cambio de esquema que todavía no está en `SPEC.md` o en el diagrama, la respuesta correcta es pedir que se actualice esa documentación primero, no improvisar el diseño.

## Modelo de permisos (alto nivel — el detalle completo va en `docs/ADR.md`)

- `PATIENT`: lectura y escritura únicamente sobre sus propios registros de hábitos. Cada query del backend filtra por el `userId` que viene del JWT verificado, nunca por un `userId` que llegue en el body o en los params.
- `NUTRITIONIST`: lectura de la lista de sus pacientes y del detalle de cada uno. Sin permiso de escritura sobre los hábitos de un paciente.
- Este modelo se valida con al menos un test e2e que confirme que un paciente no puede leer datos de otro paciente.

## Convenciones de código

- TypeScript en modo `strict`.
- ESLint + Prettier con config compartida en la raíz del monorepo.
- Modelos de Prisma en PascalCase; nombres de tabla/columna en inglés.
- Conventional Commits (`feat:`, `fix:`, `chore:`...).

## Comandos

_(se completa apenas exista el scaffolding inicial del monorepo)_

```bash
npm run dev          # api + web en paralelo
npm run build
npm run lint
npm run test
npm run db:migrate
```

## Próximos pasos del plan de diseño

1. Diagrama de base de datos (dbdiagram.io / Excalidraw).
2. `docs/SPEC.md`: catálogo de endpoints REST + modelo de datos, listo para revisar con el mentor.
3. `docs/ADR.md`: estrategia de auth (qué guarda cada token, dónde vive cada uno — el criterio de evaluación menciona explícitamente "JWT en el localStorage", así que conviene decidir ahí mismo si eso aplica solo al access token o también al refresh token) y modelo de permisos, con formato ADR estándar (Contexto / Decisión / Opciones consideradas / Trade-offs / Consecuencias).
4. Scaffolding del monorepo + CI básico (lint + build + test).
5. Implementación, guiada por lo anterior.
