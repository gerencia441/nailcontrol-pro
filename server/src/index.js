const express = require('express');
const cors = require('cors');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const clientsRouter = require('./routes/clients');
const servicesRouter = require('./routes/services');
const manicuristsRouter = require('./routes/manicurists');
const appointmentsRouter = require('./routes/appointments');
const financesRouter = require('./routes/finances');
const dashboardRouter = require('./routes/dashboard');
const integrationsRouter = require('./routes/integrations');

const prisma = new PrismaClient();
const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);
const IS_PROD = process.env.NODE_ENV === 'production';

app.use(express.json());

if (!IS_PROD) {
  app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
}

app.use((req, _res, next) => {
  req.prisma = prisma;
  next();
});

app.use('/api/clients', clientsRouter);
app.use('/api/services', servicesRouter);
app.use('/api/manicurists', manicuristsRouter);
app.use('/api/appointments', appointmentsRouter);
app.use('/api/finances', financesRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/integrations', integrationsRouter);

if (IS_PROD) {
  const distPath = path.join(__dirname, '../../client/dist');
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

async function main() {
  await prisma.$connect();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NailControl Pro server running on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
