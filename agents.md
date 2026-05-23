# NailControl Pro - Agent Guide

## Project Summary

NailControl Pro is a salon management app for nail businesses. It manages:

- Clients
- Services
- Manicurists
- Appointments
- Appointment completion and payment capture
- Income and expense records
- Daily, weekly, monthly, yearly, and custom-range finance summaries
- Manicurist commission liquidation

The repository is a full-stack JavaScript app:

- `client/`: React + Vite frontend
- `server/`: Express API + Prisma ORM
- Database: MySQL

Use Node.js `>=20`.

## Repository

Remote:

```bash
https://github.com/gerencia441/nailcontrol-pro.git
```

Main branch:

```bash
main
```

## Important Local URLs

Development frontend:

```txt
http://localhost:5174
```

Development backend:

```txt
http://localhost:3001
```

Use the frontend URL for the application UI. The backend is for API routes such as:

```txt
/api/auth/login
/api/dashboard
/api/appointments
/api/finances
/api/services
/api/clients
/api/manicurists
```

## Commands

From the repository root:

```bash
npm install
npm.cmd run dev:server
npm.cmd run dev:client
npm.cmd run build
npm.cmd run migrate
npm.cmd run migrate:dev
```

On Windows PowerShell, prefer `npm.cmd` instead of `npm` if script execution policy blocks `npm.ps1`.

Backend only:

```bash
cd server
npx.cmd prisma validate
npx.cmd prisma generate
npx.cmd prisma migrate deploy
npx.cmd prisma migrate dev
npx.cmd prisma db seed
```

Client only:

```bash
cd client
npm.cmd run dev
npm.cmd run build
```

## Development Startup

Run backend and frontend in separate terminals:

```bash
npm.cmd run dev:server
npm.cmd run dev:client
```

If requests fail with `Failed to fetch`, check that the backend is running on port `3001`.

If all Node processes were killed with:

```bash
taskkill /F /IM node.exe
```

restart both backend and frontend.

## Environment

The backend expects `server/.env`.

Required:

```txt
DATABASE_URL
SHADOW_DATABASE_URL
JWT_SECRET
```

Optional:

```txt
PORT
```

Default backend port is `3001`.

Do not commit `.env` files.

## Database And Prisma

Prisma schema:

```txt
server/prisma/schema.prisma
```

Current main models:

- `Client`
- `Service`
- `Manicurist`
- `Appointment`
- `AppointmentService`
- `Finance`
- `User`

Appointments support multiple services through `AppointmentService`.

Migration for multiple appointment services:

```txt
server/prisma/migrations/20260523153000_appointment_multiple_services/migration.sql
```

After schema changes:

```bash
cd server
npx.cmd prisma validate
npx.cmd prisma generate
npx.cmd prisma migrate dev
```

For deployed databases:

```bash
cd server
npx.cmd prisma migrate deploy
```

On Windows, `prisma generate` can fail with `EPERM` if a Node process is holding Prisma's query engine DLL. Stop running Node processes and retry.

## Time Zone Rules

This project must treat appointment dates and times as Bogota, Colombia time:

```txt
America/Bogota
UTC-5
```

Do not rely on server-local timezone behavior for appointments.

Backend helper:

```txt
server/src/lib/bogotaTime.js
```

Use:

- `bogotaDateTimeToUtc(value)` when storing appointment `datetime-local` input.
- `bogotaDayRangeToUtc(value)` when filtering appointments by day.

Important example:

```txt
2026-05-23T18:34 Bogota -> 2026-05-23T23:34:00.000Z
```

The frontend should display appointment dates with:

```js
timeZone: 'America/Bogota'
```

Do not replace this with plain `new Date(...).toLocaleString()` without a timezone.

## Backend Structure

Entry point:

```txt
server/src/index.js
```

Routes:

```txt
server/src/routes/auth.js
server/src/routes/dashboard.js
server/src/routes/clients.js
server/src/routes/services.js
server/src/routes/manicurists.js
server/src/routes/appointments.js
server/src/routes/finances.js
```

Auth middleware:

```txt
server/src/middleware/auth.js
```

Protected routes require:

```txt
Authorization: Bearer <token>
```

API fallback:

```txt
/api/*
```

Unknown API routes should return JSON 404, not `index.html`.

## Frontend Structure

Entry:

```txt
client/src/main.jsx
client/src/App.jsx
```

Auth:

```txt
client/src/lib/AuthContext.jsx
client/src/lib/api.js
```

Layout:

```txt
client/src/components/Layout.jsx
client/src/components/Sidebar.jsx
```

Reusable UI:

```txt
client/src/components/ui/Button.jsx
client/src/components/ui/Input.jsx
client/src/components/ui/Select.jsx
client/src/components/ui/Modal.jsx
client/src/components/ui/Badge.jsx
```

Pages:

```txt
client/src/pages/Dashboard.jsx
client/src/pages/Appointments.jsx
client/src/pages/Clients.jsx
client/src/pages/Services.jsx
client/src/pages/Manicurists.jsx
client/src/pages/Finances.jsx
client/src/pages/Login.jsx
```

## Appointment Behavior

Appointments can include one or more services.

The frontend sends:

```js
serviceIds: ['service-id-1', 'service-id-2']
```

The backend creates or replaces rows in `AppointmentService`.

Pending appointments can be edited:

- Date/time
- Manicurist
- Services

Completed appointments cannot have services edited because that would affect financial records.

When an appointment is completed:

- Appointment status becomes `COMPLETED`
- `finalPricePaid` is stored
- `paymentMethod` is stored
- A `Finance` entry of type `INCOME` is created

If no final price is supplied, the backend uses the sum of assigned service base prices.

## Finance Behavior

Finance records use:

```txt
INCOME
EXPENSE
```

Payment methods:

```txt
CASH
BANCOLOMBIA
NEQUI
```

Finance endpoints:

```txt
GET /api/finances
POST /api/finances
DELETE /api/finances/:id
GET /api/finances/day-close?date=YYYY-MM-DD
GET /api/finances/week-close?date=YYYY-MM-DD
GET /api/finances/summary?period=day&date=YYYY-MM-DD
GET /api/finances/summary?period=week&date=YYYY-MM-DD
GET /api/finances/summary?period=month&year=YYYY&month=MM
GET /api/finances/summary?period=year&year=YYYY
GET /api/finances/summary?period=custom&dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD
```

Finance summaries include:

- Total income
- Total expenses
- Net
- Total commissions
- Net after commissions
- Income by payment method
- Appointment status counts
- Manicurist liquidation
- Finance entries in the period

Commissions are calculated from completed appointments and each manicurist's current `commissionPercentage`.

## Known Operational Notes

If the frontend shows:

```txt
Unexpected token '<', <!DOCTYPE ... is not valid JSON
```

the frontend likely received `index.html` instead of JSON. Restart the backend so it loads the current routes.

If the frontend shows:

```txt
Failed to fetch
```

the backend is probably not running on port `3001`.

## Git And Commit Hygiene

Ignored files include:

```txt
node_modules/
client/dist/
client/node_modules/
server/node_modules/
.env
.env.local
*.log
```

Do not commit:

- `.env`
- `node_modules`
- `client/dist`
- local logs such as `.client.log` or `.server.log`
- editor-only config unless explicitly requested

There is currently a local `.vscode/launch.json` in some workspaces. Treat it as local editor config unless the user asks to include it.

Before committing:

```bash
npm.cmd run build
cd server && npx.cmd prisma validate
```

Also syntax-check backend JS when changing server code:

```bash
Get-ChildItem -Path server/src -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
```

## Design Notes

The UI is an operational salon management tool. Keep it practical, readable, and workflow-focused.

Prefer:

- Compact forms
- Clear tables
- Predictable tabs
- Existing UI components
- Lucide icons already used in the project

Avoid introducing a separate design system unless necessary.

## Current Important Caveat

Existing appointments created before the Bogota timezone fix may have already been stored with shifted hours. New and edited appointments should use the Bogota conversion rules.
