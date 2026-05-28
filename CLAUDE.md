# NailControl Pro — CLAUDE.md

Aplicación de gestión para salón de uñas. Full-stack: React + Vite (frontend) y Express + Prisma + MySQL (backend).

## Arrancar en local

```bash
# Terminal 1 — backend
npm run dev:server

# Terminal 2 — frontend
npm run dev:client
```

- Frontend: http://localhost:5174
- Backend API: http://localhost:3001
- El frontend proxea `/api` al backend (configurado en `client/vite.config.js`)

> Antes de arrancar el backend por primera vez, copiar `server/.env.example` a `server/.env` y rellenar los valores.

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, React Router v6, Lucide icons |
| Backend | Express 4, Prisma 5, MySQL 2 |
| Auth | JWT (`jsonwebtoken`) + bcrypt |
| BD | MySQL (remota en Alianzared.net) |
| Integración | Google Calendar API (`googleapis`) |
| Deploy | Railway (auto-deploy desde GitHub main) |
| Repo | https://github.com/gerencia441/nailcontrol-pro |

## Variables de entorno (`server/.env`)

```env
DATABASE_URL="mysql://user:pass@host:3306/db"
SHADOW_DATABASE_URL="mysql://user:pass@host:3306/shadow_db"
JWT_SECRET="..."
PORT=3001
NODE_ENV=development
FRONTEND_URL="http://localhost:5174"

GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT="http://localhost:3001/api/integrations/google/callback"
GOOGLE_CALENDAR_ID=florisabelcatalanlopez@gmail.com
GOOGLE_REFRESH_TOKEN=...
```

En Railway están las mismas variables con los valores de producción (`FRONTEND_URL` apunta al dominio de Railway, `GOOGLE_REDIRECT` apunta al callback de producción).

## Estructura del proyecto

```
spa-aplicacion-v2/
├── package.json              # Scripts raíz + workspace
├── client/
│   ├── src/
│   │   ├── App.jsx           # Router + ProtectedRoute
│   │   ├── main.jsx
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Clients.jsx
│   │   │   ├── Services.jsx
│   │   │   ├── Manicurists.jsx
│   │   │   ├── Appointments.jsx
│   │   │   ├── Finances.jsx
│   │   │   └── Settings.jsx
│   │   ├── components/
│   │   │   ├── Layout.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   └── ui/
│   │   │       ├── Button.jsx
│   │   │       ├── Input.jsx
│   │   │       ├── Select.jsx
│   │   │       ├── Modal.jsx
│   │   │       ├── Badge.jsx
│   │   │       └── DateTimePicker.jsx
│   │   └── lib/
│   │       ├── api.js         # HTTP client con Bearer token
│   │       └── AuthContext.jsx
│   ├── vite.config.js         # Puerto 5174, proxy /api → 3001, PWA
│   └── tailwind.config.js     # Paleta spa.* (rosa/violeta)
└── server/
    ├── src/
    │   ├── index.js            # Express app, mount de rutas
    │   ├── routes/
    │   │   ├── auth.js         # POST /login
    │   │   ├── clients.js
    │   │   ├── services.js
    │   │   ├── manicurists.js
    │   │   ├── appointments.js
    │   │   ├── finances.js
    │   │   ├── dashboard.js
    │   │   └── integrations/
    │   │       └── google.js   # /setup + /callback (obtención token)
    │   ├── middleware/
    │   │   └── auth.js         # requireAuth — verifica JWT
    │   └── lib/
    │       ├── bogotaTime.js   # Conversión UTC ↔ Bogotá
    │       └── googleCalendar.js
    └── prisma/
        ├── schema.prisma
        └── seed.js
```

## Base de datos (schema Prisma)

Proveedor: `mysql`. Los IDs son CUID.

```
Client         — id, name, birthDate?, phone?, tags (LongText JSON), technicalNotes?, createdAt, updatedAt
Service        — id, name, basePrice, durationMinutes, createdAt, updatedAt
Manicurist     — id, name, phone?, commissionPercentage, color? (hex pastel para identificar sus citas), createdAt, updatedAt
Appointment    — id, clientId, manicuristId, date, status, finalPricePaid?, paymentMethod?, googleEventId?
AppointmentService — appointmentId + serviceId (tabla junction, onDelete Cascade)
Finance        — id, type (INCOME|EXPENSE), amount, description, date, paymentMethod?
User           — id, username (unique), password (bcrypt), googleRefreshToken?, googleCalendarId?
```

**Enums:**
- `AppointmentStatus`: PENDING · COMPLETED · CANCELLED
- `PaymentMethod`: CASH · BANCOLOMBIA · NEQUI
- `FinanceType`: INCOME · EXPENSE

### Convenciones importantes de la BD

- **`Client.tags`** se guarda como JSON serializado en un campo `String @db.LongText`. Siempre pasar por `parseTags()` al leer y `JSON.stringify()` al escribir.
- **MySQL no soporta `mode: 'insensitive'`** en queries Prisma. No usar esa opción.
- Las **relaciones en el schema usan nombres en minúscula** (`services`, `service`, `appointment`) para coincidir con el código de las rutas. No cambiarlos a PascalCase.

## Rutas API

Todas requieren `Authorization: Bearer <token>` excepto `/api/auth/login` y `/api/integrations/google/*`.

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/login` | Login → devuelve `{ token, user }` |
| GET | `/api/clients` | Lista clientes (query: `?search=`) |
| GET | `/api/clients/:id` | Cliente con historial de citas |
| POST | `/api/clients` | Crear cliente |
| PUT | `/api/clients/:id` | Editar cliente |
| DELETE | `/api/clients/:id` | Eliminar cliente |
| GET/POST/PUT/DELETE | `/api/services` | CRUD servicios |
| GET/POST/PUT/DELETE | `/api/manicurists` | CRUD manicuristas |
| GET | `/api/appointments` | Lista citas (query: `?date=YYYY-MM-DD&status=`) |
| POST | `/api/appointments` | Crear cita + sync Google Calendar |
| PATCH | `/api/appointments/:id` | Editar cita + sync Calendar |
| PATCH | `/api/appointments/:id/complete` | Completar cita + crear Finance + sync Calendar |
| DELETE | `/api/appointments/:id` | Eliminar + borrar evento Calendar |
| GET | `/api/finances` | Lista finanzas (query: `?date&type&period`) |
| POST | `/api/finances` | Crear registro financiero |
| DELETE | `/api/finances/:id` | Eliminar registro |
| GET | `/api/finances/summary` | Resumen por período |
| GET | `/api/finances/day-close` | Cierre del día |
| GET | `/api/finances/week-close` | Cierre de semana |
| GET | `/api/dashboard` | Estadísticas generales |
| GET | `/api/integrations/google/setup` | Redirige a Google OAuth (uso único) |
| GET | `/api/integrations/google/callback` | Callback de Google → muestra refresh token |

## Zona horaria

Todas las citas se almacenan en UTC. La conversión se hace en `server/src/lib/bogotaTime.js`:

- `bogotaDateTimeToUtc(value)` — recibe `"YYYY-MM-DDTHH:MM"` (hora Bogotá) → devuelve `Date` UTC
- `bogotaDayRangeToUtc(value)` — recibe `"YYYY-MM-DD"` → devuelve `{ start, end }` UTC del día en Bogotá

Bogotá = UTC−5 (offset fijo, sin horario de verano).

El frontend envía fechas como `"YYYY-MM-DDTHH:MM"` (locales Bogotá). El backend convierte antes de guardar.

## Autenticación

- `POST /api/auth/login` devuelve `{ token, user: { id, username } }`
- El token se guarda en `localStorage('token')`
- Todas las peticiones incluyen `Authorization: Bearer <token>`
- En el backend, `requireAuth` verifica el JWT y pone `req.user` (con `id` y `username`)
- En 401, el frontend limpia el token y redirige a `/login`

## Google Calendar

**Configuración fija** — no requiere que el usuario conecte nada desde la app.

- Cuenta: `florisabelcatalanlopez@gmail.com`
- Calendar ID: `florisabelcatalanlopez@gmail.com` (variable `GOOGLE_CALENDAR_ID`)
- Refresh token: variable de entorno `GOOGLE_REFRESH_TOKEN`
- `server/src/lib/googleCalendar.js` usa directamente las env vars (no hace queries a la BD)

**Formato del evento:**
- Título: nombre del cliente
- Descripción: `Servicios: X, Y\nTeléfono: ...\nManicurista: ...`
- Duración: suma de `durationMinutes` de todos los servicios

**Para obtener un nuevo refresh token** (si expira o se revoca):
1. Iniciar el servidor local
2. Abrir `http://localhost:3001/api/integrations/google/setup`
3. Autenticar con `florisabelcatalanlopez@gmail.com`
4. Copiar el token que aparece en pantalla
5. Actualizar `GOOGLE_REFRESH_TOKEN` en `.env` y en Railway

## Citas con múltiples servicios

- `POST /api/appointments` acepta `serviceIds: string[]` o `serviceId: string`
- Guardados en la tabla junction `AppointmentService`
- `mapAppointment()` en `appointments.js` aplana: `services[]` (array completo) + `service` (primero)
- La duración del evento Calendar es la suma de todos los servicios

## Deploy

- **Repositorio:** https://github.com/gerencia441/nailcontrol-pro (branch `main`)
- **Railway:** auto-despliega al hacer push a `main`
- Build en Railway: `npm run build` (build Vite + `prisma generate` + `prisma migrate deploy`)
- Start en Railway: `node server/src/index.js`
- En producción el servidor sirve el build estático de React desde `client/dist`

### Gestión del schema en producción

- Nunca usar `prisma db push` en producción
- Usar migraciones: `npx prisma migrate dev --name nombre` (local) → push → Railway ejecuta `migrate deploy`
- Si se sincroniza el schema con la BD existente: `npx prisma db pull`
- Después de cualquier cambio en el schema: `npx prisma generate`

## Scripts raíz

```bash
npm run dev:server    # Arranca Express en modo desarrollo
npm run dev:client    # Arranca Vite
npm run build         # Build cliente + prisma generate + migrate deploy
npm start             # node server/src/index.js (producción)
npm run migrate       # prisma migrate deploy
npm run migrate:dev   # prisma migrate dev
```

## Paleta de colores (Tailwind)

La app usa clases `spa-*` definidas en `client/tailwind.config.js`:
- Principal: rosa/pink (`#EC4899` base)
- Bordes de tarjetas: `border-pink-100`
- Fondo de secciones: tonos rosa muy claros
