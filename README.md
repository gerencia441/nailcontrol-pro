NailControl Pro

Proyecto de gestión para salones de uñas (frontend con React + Vite y backend con Express + Prisma).

Estructura

- `client/` — aplicación React (Vite)
- `server/` — API Express con Prisma y MySQL

Requisitos

- Node.js >= 20
- MySQL (para migraciones y conexiones locales)

Uso (desarrollo)

1. Instala dependencias (desde la raíz):

```bash
cd server && npm install
cd ../client && npm install
```

2. Arranca backend y frontend en terminales separadas:

```bash
# Backend
cd server
npm run dev

# Frontend
cd client
npm run dev
```

El frontend se sirve en `http://localhost:5174`.

Migraciones y seed

Configura `server/.env` con `DATABASE_URL` y `SHADOW_DATABASE_URL` antes de correr migraciones.

```bash
cd server
npx prisma migrate dev --name init
npx prisma db seed
```

CI

Incluye un workflow básico en `.github/workflows/ci.yml` que construye el cliente y ejecuta `prisma generate`.

Publicación

Se creó la etiqueta `v1.0.0` y se empujó al remoto.

---

Si quieres, puedo ampliar el README con variables de entorno, despliegue y ejemplos.
