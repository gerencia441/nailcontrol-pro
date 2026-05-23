const express = require('express');
const { google } = require('googleapis');

const router = express.Router();

const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

function createOAuthClient() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT)
    throw new Error('Missing Google OAuth env vars');
  return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT);
}

// One-time setup: visit /api/integrations/google/setup to get the auth URL
// After completing OAuth, the refresh token is printed in the callback response
// so you can copy it into GOOGLE_REFRESH_TOKEN in .env / Railway
router.get('/setup', (_req, res) => {
  try {
    const url = createOAuthClient().generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
    });
    res.redirect(url);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Google calls this after the user grants consent
router.get('/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).send('Missing code');
    const { tokens } = await createOAuthClient().getToken(code);
    if (!tokens.refresh_token) {
      return res.status(400).send(
        'No se recibió refresh_token. Revoca el acceso en myaccount.google.com/permissions y vuelve a intentarlo.'
      );
    }
    res.send(`
      <h2>¡Listo! Copia este Refresh Token y guárdalo en tu .env y en Railway como GOOGLE_REFRESH_TOKEN:</h2>
      <pre style="background:#f4f4f4;padding:16px;border-radius:8px;word-break:break-all">${tokens.refresh_token}</pre>
      <p>Luego reinicia el servidor. No necesitas volver a hacer esto.</p>
    `);
  } catch (err) {
    res.status(500).send(`Error: ${err.message}`);
  }
});

module.exports = router;
