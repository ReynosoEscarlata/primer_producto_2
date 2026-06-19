# nutri-habits — SPEC.md

Catálogo de endpoints REST, derivado de la entrevista de diseño (ver historial de conversación) sobre el esquema aprobado en `docs/db-diagram.dbml`. Este es un **borrador para revisar**, no una decisión cerrada: los paths exactos y nombres de campos son una propuesta razonable a partir de lo que se discutió, no algo que ya esté validado contigo.

## Convenciones generales

- Todos los campos JSON en `snake_case`, igual que las columnas del diagrama (`full_name`, `water_ml`, etc.).
- Fechas como `date` en formato `YYYY-MM-DD`; timestamps como `timestamp` en ISO 8601 UTC.
- Ningún endpoint devuelve `password_hash`, ni campos no usados por el frontend (`created_at`/`updated_at` se omiten salvo que se justifique).
- Forma de error no decidida todavía en la entrevista — se asume `{ "error": { "message": "..." } }` en el body, a confirmar.
- `PATIENT`/`NUTRITIONIST`/`ADMIN` siempre se resuelven del JWT verificado (`req.user.id`, `req.user.role`), nunca de un parámetro o body que mande el cliente — así se previene el acceso cruzado entre pacientes y entre nutriólogas.
- Todo endpoint con **Rol requerido** distinto de "público" devuelve `401` si el access token falta, es inválido, o expiró — esa fila no se repite en cada tabla de errores para no inflar el documento, pero aplica siempre.

---

## Dominio: Auth

### POST /auth/register

**Rol requerido:** público
**Auth:** ninguna

**Request**
Body:
```json
{
  "email": "paciente@example.com",
  "password": "abcdef123",
  "full_name": "Ana Pérez",
  "birth_date": "1995-04-12",
  "height": 1.65,
  "weight": 60.5
}
```
`birth_date`, `height`, `weight` son opcionales. El `role` no se manda en el body: todo registro público crea un usuario `PATIENT`; `NUTRITIONIST` solo lo crea un admin (ver dominio Admin). `nutritionist_id`/relación con nutrióloga no se asigna en este paso.

**Response 201**
```json
{
  "id": "uuid",
  "email": "paciente@example.com",
  "full_name": "Ana Pérez",
  "role": "PATIENT"
}
```

**Errores posibles**
| Código | Cuándo ocurre |
|--------|--------------|
| 400 | Body malformado / JSON inválido |
| 422 | `email` ya registrado |
| 422 | `password` no cumple la regla (mínimo 6 caracteres, solo letras y números) |
| 422 | `height`/`weight` no son números positivos |
| 422 | `birth_date` no respeta formato `YYYY-MM-DD` |

---

### POST /auth/login

**Rol requerido:** público
**Auth:** ninguna

**Request**
Body:
```json
{
  "email": "paciente@example.com",
  "password": "abcdef123"
}
```

**Response 200**
```json
{
  "access_token": "ey..."
}
```
El refresh token se setea como cookie `httpOnly` (no aparece en el body). El `role` del usuario no va en este response — el frontend lo obtiene decodificando el `access_token`.

**Errores posibles**
| Código | Cuándo ocurre |
|--------|--------------|
| 400 | Body malformado / JSON inválido |
| 401 | `email` no existe o `password` incorrecta (mismo código para ambos casos, para no filtrar qué emails existen) |
| 403 | Credenciales correctas pero `is_active = false` |

---

### POST /auth/refresh

**Rol requerido:** público (la identidad la da la cookie, no un Bearer token)
**Auth:** cookie httpOnly (refresh token)

**Request**
Sin body. El refresh token viaja en la cookie `httpOnly`.

**Response 200**
```json
{
  "access_token": "ey..."
}
```

**Errores posibles**
| Código | Cuándo ocurre |
|--------|--------------|
| 401 | Cookie de refresh ausente, con hash que no matchea ninguna fila, expirada, o `revoked_at` ya seteado |
| 401 | El usuario del token ya no existe o tiene `is_active = false` (cuenta desactivada después de emitido el refresh token) |

---

### POST /auth/logout

**Rol requerido:** cualquier usuario autenticado
**Auth:** Bearer token + cookie httpOnly (refresh token)

**Request**
Sin body. Revoca únicamente el refresh token de la cookie actual (la sesión de este dispositivo) — no afecta otras sesiones del mismo usuario.

**Response 200**
```json
{ "success": true }
```

**Errores posibles**
| Código | Cuándo ocurre |
|--------|--------------|
| 401 | Cookie de refresh ausente o que no matchea ninguna fila |

---

### POST /auth/forgot-password — PENDIENTE

Flujo de reset de contraseña por correo. Queda fuera de este borrador a propósito — se diseña en una pasada aparte cuando se decida el proveedor de envío de email. No tiene contrato definido todavía.

---

## Dominio: Paciente

Todos los endpoints de este dominio filtran siempre por el `patient_id` del JWT verificado — nunca por un id que llegue en el body, params o query.

### POST /patients/me/daily-logs

**Rol requerido:** PATIENT
**Auth:** Bearer token

**Request**
Body:
```json
{
  "date": "2026-06-18",
  "water_ml": 2000,
  "exercise_minutes": 30,
  "sleep_hours": 7.5
}
```
Los tres campos de hábito son obligatorios (no pueden ir vacíos). Rangos: `sleep_hours` 0–24, `exercise_minutes` 0–1440, `water_ml` 0–10000.

**Response 201**
```json
{
  "id": "uuid",
  "date": "2026-06-18",
  "water_ml": 2000,
  "exercise_minutes": 30,
  "sleep_hours": 7.5
}
```

**Errores posibles**
| Código | Cuándo ocurre |
|--------|--------------|
| 400 | Body malformado / JSON inválido |
| 422 | `date` es una fecha futura |
| 422 | Algún campo fuera de su rango válido, o vacío |
| 422 | Ya existe un log para ese `date` (usar `PATCH /patients/me/daily-logs/:date` en su lugar) |

---

### PATCH /patients/me/daily-logs/:date

**Rol requerido:** PATIENT
**Auth:** Bearer token

**Request**
Params: `date` (`YYYY-MM-DD`) del log a editar.
Body (los tres campos van completos, no es edición parcial):
```json
{
  "water_ml": 2200,
  "exercise_minutes": 45,
  "sleep_hours": 8.0
}
```
Solo se puede editar si el `created_at` del log es del mismo día calendario (UTC) que el momento del request — pasada esa ventana, queda bloqueado aunque el log sea del propio paciente.

**Response 200**
```json
{
  "id": "uuid",
  "date": "2026-06-18",
  "water_ml": 2200,
  "exercise_minutes": 45,
  "sleep_hours": 8.0
}
```

**Errores posibles**
| Código | Cuándo ocurre |
|--------|--------------|
| 400 | Body malformado / JSON inválido |
| 404 | No existe un log de este paciente para ese `date` |
| 422 | Algún campo fuera de rango, o vacío |
| 422 | La ventana de edición ya venció (`created_at` no es del día calendario UTC actual) |

---

### GET /patients/me/daily-logs

**Rol requerido:** PATIENT
**Auth:** Bearer token

**Request**
Sin body ni params — siempre devuelve los últimos 30 días del paciente autenticado.

**Response 200**
```json
[
  { "date": "2026-05-20", "water_ml": 1800, "exercise_minutes": 20, "sleep_hours": 6.5 },
  { "date": "2026-05-21", "water_ml": 2000, "exercise_minutes": 30, "sleep_hours": 7.5 }
]
```

**Errores posibles**
| Código | Cuándo ocurre |
|--------|--------------|
| (ninguno específico — lista vacía si no hay logs) | |

---

### POST /patients/me/mood-entries

**Rol requerido:** PATIENT
**Auth:** Bearer token

**Request**
Body:
```json
{
  "value": 7,
  "note": "buen día"
}
```
`value` en escala 1–10. `note` es opcional. `occurred_at` lo asigna el servidor (momento del request), no lo manda el cliente.

**Response 201**
```json
{
  "id": "uuid",
  "occurred_at": "2026-06-18T15:42:00Z",
  "value": 7,
  "note": "buen día"
}
```

**Errores posibles**
| Código | Cuándo ocurre |
|--------|--------------|
| 400 | Body malformado / JSON inválido |
| 422 | `value` fuera del rango 1–10 |

---

### GET /patients/me/mood-entries

**Rol requerido:** PATIENT
**Auth:** Bearer token

**Request**
Sin body ni params — últimos 30 días del paciente autenticado.

**Response 200**
```json
[
  { "id": "uuid", "occurred_at": "2026-06-18T15:42:00Z", "value": 7, "note": "buen día" }
]
```

**Errores posibles**
| Código | Cuándo ocurre |
|--------|--------------|
| (ninguno específico — lista vacía si no hay entradas) | |

---

### GET /patients/me/profile

**Rol requerido:** PATIENT
**Auth:** Bearer token

**Request**
Sin body ni params.

**Response 200**
```json
{
  "id": "uuid",
  "email": "paciente@example.com",
  "full_name": "Ana Pérez",
  "birth_date": "1995-04-12",
  "height": 1.65,
  "weight": 60.5
}
```

**Errores posibles**
| Código | Cuándo ocurre |
|--------|--------------|
| (ninguno específico) | |

---

### PATCH /patients/me/profile

**Rol requerido:** PATIENT
**Auth:** Bearer token

**Request**
Body (todos los campos opcionales, se actualiza solo lo que se manda, salvo que vacíe `full_name`/`email`):
```json
{
  "full_name": "Ana Pérez Gómez",
  "birth_date": "1995-04-12",
  "email": "nuevo@example.com",
  "height": 1.66,
  "weight": 59.0
}
```
No requiere `current_password` para cambiar el `email`. Contraseña no se edita por este endpoint en esta iteración.

**Response 200**
```json
{
  "id": "uuid",
  "email": "nuevo@example.com",
  "full_name": "Ana Pérez Gómez",
  "birth_date": "1995-04-12",
  "height": 1.66,
  "weight": 59.0
}
```

**Errores posibles**
| Código | Cuándo ocurre |
|--------|--------------|
| 400 | Body malformado / JSON inválido |
| 422 | `full_name` o `email` enviados vacíos |
| 422 | `email` con formato inválido, o ya en uso por otro usuario |
| 422 | `height`/`weight` enviados pero no son números positivos |

---

## Dominio: Nutrióloga

### GET /nutritionists/me/patients

**Rol requerido:** NUTRITIONIST
**Auth:** Bearer token

**Request**
Sin body ni params. Filtra siempre por la relación activa (`PatientNutritionist.nutritionist_id = req.user.id AND ended_at IS NULL`) — nunca por un id que mande el cliente.

**Response 200**
```json
[
  { "id": "uuid", "full_name": "Ana Pérez", "email": "paciente@example.com", "last_log_date": "2026-06-17" }
]
```
`last_log_date` es `null` si el paciente todavía no registró ningún log.

**Errores posibles**
| Código | Cuándo ocurre |
|--------|--------------|
| (ninguno específico — lista vacía si no tiene pacientes) | |

---

### GET /nutritionists/patients/search

**Rol requerido:** NUTRITIONIST
**Auth:** Bearer token

**Request**
Query: `q` (busca por `full_name` o `email`, coincidencia parcial).

**Response 200**
```json
[
  {
    "id": "uuid",
    "full_name": "Ana Pérez",
    "email": "paciente@example.com",
    "holder": { "full_name": "Dra. López", "email": "lopez@example.com" }
  },
  {
    "id": "uuid",
    "full_name": "Bruno Díaz",
    "email": "bruno@example.com",
    "holder": null
  }
]
```
Devuelve todos los pacientes que matchean, asignados o no — sin datos de hábitos/logs, solo identificación y `holder` (nutrióloga asignada actualmente, o `null` si está libre).

**Errores posibles**
| Código | Cuándo ocurre |
|--------|--------------|
| (ninguno específico — lista vacía si no hay coincidencias) | |

---

### GET /nutritionists/patients/:patientId

**Rol requerido:** NUTRITIONIST
**Auth:** Bearer token

**Request**
Params: `patientId` (uuid).

**Response 200**
```json
{
  "profile": {
    "id": "uuid",
    "email": "paciente@example.com",
    "full_name": "Ana Pérez",
    "birth_date": "1995-04-12",
    "height": 1.65,
    "weight": 60.5
  },
  "daily_logs": [
    { "date": "2026-05-20", "water_ml": 1800, "exercise_minutes": 20, "sleep_hours": 6.5 }
  ],
  "mood_entries": [
    { "id": "uuid", "occurred_at": "2026-06-18T15:42:00Z", "value": 7, "note": "buen día" }
  ]
}
```

**Errores posibles**
| Código | Cuándo ocurre |
|--------|--------------|
| 404 | `patientId` no existe |
| 422 | `patientId` existe pero su `role` no es `PATIENT` |
| 403 | El paciente existe pero no está asignado a esta nutrióloga (no hay relación activa con `req.user.id`) |

---

### POST /nutritionists/me/patients

**Rol requerido:** NUTRITIONIST
**Auth:** Bearer token

**Request**
Body:
```json
{ "patient_id": "uuid" }
```

**Response 201**
```json
{ "patient_id": "uuid", "nutritionist_id": "uuid", "started_at": "2026-06-18T15:42:00Z" }
```

**Errores posibles**
| Código | Cuándo ocurre |
|--------|--------------|
| 400 | Body malformado / JSON inválido |
| 404 | `patient_id` no existe |
| 422 | `patient_id` existe pero su `role` no es `PATIENT` |
| 422 | El paciente ya tiene una nutrióloga activa asignada (sea esta misma u otra) |

---

### DELETE /nutritionists/me/patients/:patientId

**Rol requerido:** NUTRITIONIST
**Auth:** Bearer token

**Request**
Params: `patientId` (uuid).

**Response 200**
```json
{ "patient_id": "uuid", "ended_at": "2026-06-18T15:42:00Z" }
```

**Errores posibles**
| Código | Cuándo ocurre |
|--------|--------------|
| 404 | `patientId` no existe |
| 403 | El paciente está asignado a otra nutrióloga distinta de `req.user.id` |
| 422 | El paciente no tiene ninguna nutrióloga activa asignada (ya estaba desasignado) |

---

## Dominio: Admin

Solo existe un `ADMIN` en todo el sistema, sembrado directo en la base de datos al iniciar el proyecto (`root@admin.com` / `root`) — no hay endpoint para crear otro admin, y ninguno de los endpoints siguientes acepta `role = ADMIN` como valor de entrada.

### GET /admin/nutritionists

**Rol requerido:** ADMIN
**Auth:** Bearer token

**Request**
Query: `q` (opcional, busca por `full_name`/`email`).

**Response 200**
```json
[
  { "id": "uuid", "full_name": "Dra. López", "email": "lopez@example.com", "is_active": true }
]
```

**Errores posibles**
| Código | Cuándo ocurre |
|--------|--------------|
| (ninguno específico) | |

---

### GET /admin/patients

**Rol requerido:** ADMIN
**Auth:** Bearer token

**Request**
Query: `q` (opcional, busca por `full_name`/`email`).

**Response 200**
```json
[
  {
    "id": "uuid",
    "full_name": "Ana Pérez",
    "email": "paciente@example.com",
    "is_active": true,
    "holder": { "id": "uuid", "full_name": "Dra. López", "email": "lopez@example.com" }
  }
]
```
`holder` es `null` si el paciente no tiene nutrióloga asignada.

**Errores posibles**
| Código | Cuándo ocurre |
|--------|--------------|
| (ninguno específico) | |

---

### POST /admin/users

**Rol requerido:** ADMIN
**Auth:** Bearer token

**Request**
Body (ejemplo para `NUTRITIONIST`):
```json
{
  "email": "lopez@example.com",
  "password": "abcdef123",
  "full_name": "Dra. López",
  "role": "NUTRITIONIST"
}
```
Para `role = "PATIENT"` aplican además los campos opcionales `birth_date`/`height`/`weight`, con las mismas reglas que en `POST /auth/register`.

**Response 201**
```json
{ "id": "uuid", "email": "lopez@example.com", "full_name": "Dra. López", "role": "NUTRITIONIST" }
```

**Errores posibles**
| Código | Cuándo ocurre |
|--------|--------------|
| 400 | Body malformado / JSON inválido |
| 422 | `email` ya registrado |
| 422 | `role` distinto de `PATIENT`/`NUTRITIONIST` (en particular, `ADMIN` rechazado) |
| 422 | Campos fuera de regla para el rol elegido (ej. `height` negativo) |

---

### PATCH /admin/users/:id

**Rol requerido:** ADMIN
**Auth:** Bearer token

**Request**
Params: `id` (uuid).
Body (campos opcionales, según el rol del usuario editado):
```json
{ "full_name": "Dra. López Gómez", "email": "nuevo@example.com" }
```

**Response 200**
```json
{ "id": "uuid", "email": "nuevo@example.com", "full_name": "Dra. López Gómez", "role": "NUTRITIONIST" }
```

**Errores posibles**
| Código | Cuándo ocurre |
|--------|--------------|
| 400 | Body malformado / JSON inválido |
| 404 | `id` no existe |
| 422 | `email` con formato inválido o ya en uso |
| 422 | Campos fuera de regla para el rol del usuario |

---

### PATCH /admin/users/:id/status

**Rol requerido:** ADMIN
**Auth:** Bearer token

**Request**
Params: `id` (uuid).
Body:
```json
{ "is_active": false }
```
Activa o desactiva la cuenta. Desactivar no cierra ni reasigna relaciones de `PatientNutritionist` automáticamente.

**Response 200**
```json
{ "id": "uuid", "is_active": false }
```

**Errores posibles**
| Código | Cuándo ocurre |
|--------|--------------|
| 400 | Body malformado / JSON inválido |
| 404 | `id` no existe |

---

### POST /admin/patients/:patientId/assign-nutritionist

**Rol requerido:** ADMIN
**Auth:** Bearer token

**Request**
Params: `patientId` (uuid).
Body:
```json
{ "nutritionist_id": "uuid" }
```
Cierra la relación activa actual del paciente (si existe) y abre una nueva con `nutritionist_id`, en el mismo request.

**Response 200**
```json
{ "patient_id": "uuid", "nutritionist_id": "uuid", "started_at": "2026-06-18T15:42:00Z" }
```

**Errores posibles**
| Código | Cuándo ocurre |
|--------|--------------|
| 400 | Body malformado / JSON inválido |
| 404 | `patientId` no existe |
| 422 | `patientId` existe pero su `role` no es `PATIENT` |
| 404 | `nutritionist_id` no existe |
| 422 | `nutritionist_id` existe pero su `role` no es `NUTRITIONIST` |
| 422 | `nutritionist_id` existe y es `NUTRITIONIST`, pero `is_active = false` |
