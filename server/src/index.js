require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const clientsRouter = require('./routes/clients');
const servicesRouter = require('./routes/services');
const manicuristsRouter = require('./routes/manicurists');
const appointmentsRouter = require('./routes/appointments');
const financesRouter = require('./routes/finances');
const dashboardRouter = require('./routes/dashboard');
const usersRouter = require('./routes/users');
const settingsRouter = require('./routes/settings');
const authRouter = require('./routes/auth');
const googleRouter = require('./routes/integrations/google');
const publicRouter = require('./routes/public');
const pushRouter = require('./routes/push');
const requireAuth = require('./middleware/auth');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('Missing DATABASE_URL. Copy server/.env.example to server/.env and set your MySQL connection string.');
  process.exit(1);
}

const prisma = new PrismaClient();
const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);
const IS_PROD = process.env.NODE_ENV === 'production';
const distPath = path.join(__dirname, '../../client/dist');
const hasDist = fs.existsSync(distPath);

// Necesario para que req.ip sea el del visitante y no el del proxy de Railway;
// sin esto el limitador de tasa del portal público agruparía a todo el mundo
// en un mismo cubo.
app.set('trust proxy', 1);

app.use(express.json());

if (!IS_PROD) {
  app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
}

app.use((req, _res, next) => {
  req.prisma = prisma;
  next();
});

app.use('/api/auth', authRouter);

// Google routes: setup + callback don't need auth (one-time token retrieval only)
app.use('/api/integrations/google', googleRouter);

// Portal público de reservas (citas.florcatalan.com) — sin autenticación.
app.use('/api/public', publicRouter);

app.use('/api/clients', requireAuth, clientsRouter);
app.use('/api/services', requireAuth, servicesRouter);
app.use('/api/manicurists', requireAuth, manicuristsRouter);
app.use('/api/appointments', requireAuth, appointmentsRouter);
app.use('/api/finances', requireAuth, financesRouter);
app.use('/api/dashboard', requireAuth, dashboardRouter);
app.use('/api/users', requireAuth, usersRouter);
app.use('/api/settings', requireAuth, settingsRouter);
app.use('/api/push', requireAuth, pushRouter);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

if (IS_PROD || hasDist) {
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

async function main() {
  await prisma.$connect();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BeautyControl Pro server running on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
