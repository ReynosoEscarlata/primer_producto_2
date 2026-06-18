# nutri-habits — ADR.md

Decisiones de arquitectura sobre autenticación y modelo de permisos, derivadas de la entrevista de diseño posterior a `docs/db-diagram.dbml` y `docs/SPEC.md`. Formato estándar: Contexto / Decisión / Opciones consideradas / Trade-offs / Consecuencias.

---

## ADR-001: Estrategia de autenticación (JWT access + refresh)

### Contexto

La API necesita autenticación stateless para un backend Fastify con frontend separado (React + Vite, deploy como Static Site en Render) y backend como Web Service en Render — es decir, **front y back en subdominios distintos** (origen cruzado). El criterio de evaluación del brief menciona explícitamente "JWT en localStorage", lo que obliga a decidir conscientemente dónde vive cada token y por qué, en vez de asumirlo.

### Decisión

- **Access token**: JWT firmado con HS256, secret en variable de entorno. Payload mínimo: `{ sub: user.id, role: user.role, iat, exp }`. Vida: **15 minutos**. Vive **en memoria del cliente** (estado de React/contexto de auth), nunca en `localStorage`/`sessionStorage`.
- **Refresh token**: también JWT, payload `{ sub: user.id, iat, exp }`. Vida: **7 días**. Viaja como cookie `HttpOnly`, `Secure`, `SameSite=None` (obligatorio por ser cross-origin). Se persiste el **hash SHA-256** del token en `RefreshToken.token_hash`, junto con `expires_at` y `revoked_at`, para poder revocarlo individualmente (logout) sin depender solo de su expiración.
- **Sin rotación de refresh token** en esta iteración: `POST /auth/refresh` valida el mismo refresh token contra la BD (hash + `revoked_at` + `expires_at`) y emite un access token nuevo; el refresh token no cambia hasta que expire o se revoque explícitamente.
- `password_hash`: **bcrypt**, cost factor 12.
- CORS con **origen explícito** (nunca `*`) y `credentials: true` — requisito para que el navegador adjunte la cookie `HttpOnly` en requests cross-origin hacia la API.

### Opciones consideradas

- **Access token en `localStorage`** (lo que sugiere literalmente el criterio de evaluación): se descartó por quedar expuesto de forma persistente a cualquier XSS en el frontend. Se prioriza memoria, aceptando el costo de UX descrito abajo.
- **Refresh token opaco** (string aleatorio, ej. `crypto.randomBytes(32)`) en vez de JWT: más simple, ya que la validación real es siempre contra la BD (el JWT no se verifica por sí solo para autorizar, solo se usa su hash como clave de búsqueda). Se decidió mantenerlo como JWT de todos modos.
- **Rotación de refresh token con detección de reuso**: más segura (permite detectar robo de token por un patrón de uso anómalo), pero agrega lógica y casos borde (refresh concurrentes desde el mismo dispositivo). Se posterga a una iteración futura.
- **argon2id** en vez de bcrypt para `password_hash`: se descartó por el riesgo de que el binding nativo (`argon2` npm package) falle al compilar en el entorno de build de Render.

### Trade-offs

- Memoria en vez de `localStorage`: mejor resistencia a XSS, pero cada carga/recarga de página necesita un round-trip a `/auth/refresh` (usando la cookie) antes de poder mostrar cualquier pantalla protegida — el frontend tiene que manejar ese estado de carga inicial.
- Sin rotación: más simple de implementar y depurar, pero si la cookie de refresh se compromete, el token robado sigue siendo válido hasta los 7 días o hasta que el usuario legítimo haga logout — no hay forma automática de detectar el uso indebido.
- `token_hash` con SHA-256 en vez de bcrypt: correcto porque el refresh token ya es un valor de alta entropía (un JWT firmado), no una contraseña corta — no necesita un hash deliberadamente lento para resistir fuerza bruta, solo un lookup determinístico y rápido.
- `SameSite=None; Secure`: obligatorio por el escenario cross-origin de Render, pero implica que el flujo de cookies solo funciona sobre HTTPS (en desarrollo local hay que replicar esto con cuidado, ej. usando un túnel HTTPS o relajando la config solo en ese entorno).

### Consecuencias

- El frontend necesita un interceptor que detecte `401` en cualquier request, dispare `/auth/refresh` automáticamente, y reintente — con un límite claro para no generar loops infinitos si el refresh también falla (ahí sí se fuerza logout y redirect a login).
- Logout tiene que hacer tres cosas, no una: marcar `revoked_at` en la fila de `RefreshToken`, limpiar la cookie en el browser (`Set-Cookie` con `Max-Age=0`), y descartar el access token en memoria.
- Revocar todas las sesiones de un usuario comprometido (`UPDATE RefreshToken SET revoked_at = now() WHERE user_id = ?`) queda disponible para una feature futura ("cerrar todas las sesiones"), ya soportada por el índice en `RefreshToken.user_id` del esquema — no requiere cambios de BD cuando se implemente.

---

## ADR-002: Modelo de permisos y aislamiento de datos entre pacientes

### Contexto

El criterio de aceptación no negociable del brief es que ningún paciente pueda leer datos de otro paciente, validado con un test e2e. Con la incorporación del rol `ADMIN`, además hay tres niveles de visibilidad distintos sobre los mismos datos (paciente, nutrióloga, admin) que hay que mantener consistentes en cada endpoint de `docs/SPEC.md`.

### Decisión

- Toda identidad usada para autorizar (quién soy, qué rol tengo) se obtiene **exclusivamente** de los claims del access token verificado (`req.user.id`, `req.user.role`) — nunca de un parámetro de ruta, query string o campo del body.
- **PATIENT**: lectura/escritura únicamente sobre sus propios `DailyLog`/`MoodEntry`/perfil, filtrado siempre por `patient_id = req.user.id` en la query, no por un id que llegue del cliente.
- **NUTRITIONIST**: lectura de pacientes con relación activa (`PatientNutritionist.nutritionist_id = req.user.id AND ended_at IS NULL`); cero permiso de escritura sobre hábitos de un paciente. Pedir el detalle de un paciente que existe pero no es suyo devuelve `403`; pedir un `patientId` que no existe devuelve `404` — la distinción ya está fijada en `SPEC.md`.
- **ADMIN**: gestiona usuarios y asignaciones, pero **nunca** lee `DailyLog`/`MoodEntry` — ninguno de los endpoints de `/admin/*` en `SPEC.md` expone datos de hábitos, solo identificación y estado (`is_active`, `holder`).
- Esto se refuerza a nivel de esquema (no solo de código de aplicación): `uuid` no enumerable como PK, triggers que validan el `role` del lado referenciado en las FKs de `patient_id`/`nutritionist_id` (ver `db-diagram.dbml`), e índice único parcial que garantiza un único nutricionista activo por paciente.

### Opciones consideradas

- **Postgres Row-Level Security (RLS)** como capa adicional de aislamiento, en vez de (o sumado a) filtrar en cada query del backend: se descartó para esta iteración por la complejidad operativa que agrega con Prisma (no tiene soporte nativo de RLS; requeriría `SET ROLE`/session variables manuales en cada request). Queda anotado como mejora de defensa en profundidad para una iteración futura, no descartado para siempre.
- **Devolver `404` en vez de `403`** para recursos que existen pero no le pertenecen al usuario (para no confirmarle a un atacante que el id probado existe): se descartó porque `CLAUDE.md` ya fija explícitamente que `403` es "autenticado pero sin permiso sobre ese recurso", y cambiarlo rompería la consistencia de códigos que pide el brief.

### Trade-offs

- Filtrado 100% en código de aplicación (sin RLS): más simple de razonar y depurar con Prisma, pero un único query sin su `WHERE patient_id = req.user.id` es suficiente para una fuga de datos entre pacientes — por eso el test e2e de aislamiento es un requisito no negociable del brief, no una mejora opcional.
- `403` en vez de `404` para recursos ajenos: más honesto sobre la causa real del error (más fácil de debuggear), pero técnicamente le confirma a quien hace la request que el id que probó corresponde a un recurso real del sistema.

### Consecuencias

- Todo handler que toque `DailyLog`, `MoodEntry` o `PatientNutritionist` depende de que el middleware de auth ya haya resuelto y poblado `req.user` antes de llegar a la lógica de negocio — ningún handler debe confiar en un id que no sea ese.
- El test e2e de aislamiento (criterio de aceptación del brief) tiene que cubrir, como mínimo: paciente A no puede leer ni editar logs de paciente B manipulando directamente la URL o el body de la request.
