const { Router } = require('express');
const router = Router();
const { getAuthUrl, getOAuthClient, OWNER_ID } = require('../lib/googleCalendar');

router.get('/google/connect', (_req, res) => {
  res.redirect(getAuthUrl());
});

router.get('/google/callback', async (req, res) => {
  const { code, error } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  if (error || !code) {
    return res.redirect(`${frontendUrl}/settings?google=error`);
  }

  try {
    const oauth2Client = getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);

    await req.prisma.user.upsert({
      where: { id: OWNER_ID },
      create: {
        id: OWNER_ID,
        username: 'owner',
        password: '',
        googleRefreshToken: tokens.refresh_token,
      },
      update: { googleRefreshToken: tokens.refresh_token },
    });

    res.redirect(`${frontendUrl}/settings?google=connected`);
  } catch (err) {
    console.error('Google OAuth callback error:', err.message);
    res.redirect(`${frontendUrl}/settings?google=error`);
  }
});

router.get('/google/status', async (req, res) => {
  try {
    const user = await req.prisma.user.findUnique({ where: { id: OWNER_ID } });
    res.json({
      connected: !!user?.googleRefreshToken,
      calendarId: user?.googleCalendarId || '',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/google/calendar', async (req, res) => {
  try {
    const { calendarId } = req.body;
    await req.prisma.user.upsert({
      where: { id: OWNER_ID },
      create: { id: OWNER_ID, username: 'owner', password: '', googleCalendarId: calendarId },
      update: { googleCalendarId: calendarId },
    });
    res.json({ calendarId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/google/disconnect', async (req, res) => {
  try {
    await req.prisma.user.upsert({
      where: { id: OWNER_ID },
      create: { id: OWNER_ID, username: 'owner', password: '', googleRefreshToken: null },
      update: { googleRefreshToken: null },
    });
    res.json({ connected: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
