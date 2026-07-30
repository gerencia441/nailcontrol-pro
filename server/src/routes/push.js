const { Router } = require('express');
const push = require('../lib/push');

const router = Router();

// La llave pública no es secreta: el navegador la necesita para suscribirse.
// Se sirve desde aquí en lugar de incrustarla en el build del cliente, para
// poder rotarla sin recompilar el frontend.
router.get('/public-key', (_req, res) => {
  res.json({ publicKey: push.getPublicKey(), enabled: push.isConfigured });
});

router.post('/subscribe', async (req, res) => {
  try {
    if (!push.isConfigured) {
      return res.status(503).json({ error: 'Las notificaciones push no están configuradas en el servidor.' });
    }

    await push.saveSubscription(req.prisma, {
      userId: req.user.id,
      subscription: req.body?.subscription || req.body,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({ ok: true });
  } catch (err) {
    if (err.httpStatus) return res.status(err.httpStatus).json({ error: err.message });
    console.error('push/subscribe error', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/unsubscribe', async (req, res) => {
  try {
    await push.removeSubscription(req.prisma, req.body?.endpoint);
    res.json({ ok: true });
  } catch (err) {
    console.error('push/unsubscribe error', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Envía un aviso de prueba a los dispositivos de quien lo pide. Útil para
// confirmar que el push funciona sin tener que esperar una reserva real.
router.post('/test', async (req, res) => {
  try {
    const result = await push.sendToUsers(req.prisma, [req.user.id], {
      title: 'Notificaciones activas',
      body: 'Así se verá el aviso cuando una clienta reserve en línea.',
      url: '/appointments',
      tag: 'push-test',
    });
    res.json(result);
  } catch (err) {
    console.error('push/test error', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
