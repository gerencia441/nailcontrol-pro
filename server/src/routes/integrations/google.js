const express = require('express');
const { google } = require('googleapis');

const router = express.Router();

const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

function createOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirect = process.env.GOOGLE_REDIRECT;
  if (!clientId || !clientSecret || !redirect) throw new Error('Missing Google OAuth env vars');
  return new google.auth.OAuth2(clientId, clientSecret, redirect);
}

// Return an auth URL for the frontend to open
router.get('/connect', async (req, res) => {
  try {
    const oauth2Client = createOAuthClient();
    const state = JSON.stringify({ userId: req.user.id });
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
      state,
    });
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Callback endpoint that Google will call after consent
router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code) return res.status(400).send('Missing code');

    const oauth2Client = createOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);

    // State should contain userId set earlier
    let userId = null;
    try {
      const parsed = JSON.parse(state);
      userId = parsed.userId;
    } catch (e) {
      // ignore
    }

    if (!userId) {
      return res.status(400).send('Missing state.userId');
    }

    // Save refresh token if provided
    if (tokens.refresh_token) {
      await req.prisma.user.update({
        where: { id: userId },
        data: { googleRefreshToken: tokens.refresh_token },
      });
    }

    // Redirect to frontend success page
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174';
    return res.redirect(`${frontendUrl}/?google_connected=1`);
  } catch (err) {
    console.error(err);
    return res.status(500).send('Google callback error');
  }
});

// Status: whether user has connected calendar
router.get('/status', async (req, res) => {
  try {
    const user = await req.prisma.user.findUnique({ where: { id: req.user.id } });
    res.json({ connected: Boolean(user?.googleRefreshToken) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
