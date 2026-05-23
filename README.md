# NailControl Pro

Proyecto de gestión de citas para salones de uñas (frontend React + backend Express + Prisma).

## Requisitos
- Node.js >= 20
- npm
- Base de datos MySQL (o ajustar `DATABASE_URL`)

## Clonar el repositorio

```bash
git clone https://github.com/gerencia441/nailcontrol-pro.git
cd nailcontrol-pro
```

## Instalar dependencias

Instalación en el root (ejecuta `postinstall` que instala `server` y `client`):

```bash
npm install
```

O instala por separado:

```bash
cd server && npm install
cd ../client && npm install
```

## Variables de entorno
Configura `server/.env` con al menos:

- `DATABASE_URL` — conexión MySQL
- `JWT_SECRET` — clave para tokens
- `PORT` (opcional, por defecto 3001)

Hay un `server/.env` en el proyecto; revisa y reemplaza credenciales sensibles antes de publicar.

## Ejecutar en desarrollo

1) Iniciar servidor:

```bash
cd server
npm run dev
```

2) Iniciar cliente (Vite):

```bash
cd client
npm run dev
# Abre http://localhost:5174/
```

## Build / Producción

En la raíz:

```bash
npm run build
npm start
```

El script `build` compila el cliente y aplica las tareas de Prisma necesarias.

## Notas
- Si trabajas en Windows y el script `dev:server` no establece `NODE_ENV`, inicia el servidor directamente con `cd server && npm run dev`.
- Revisa el contenido de `server/.env` y elimina credenciales públicas si subes el repositorio a un servicio público.

Si quieres, puedo añadir un `README` más detallado, workflows de CI o proteger ramas en GitHub.
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
