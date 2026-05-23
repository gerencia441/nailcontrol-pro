const { google } = require('googleapis');

const OWNER_ID = 'owner';
const TZ = 'America/Bogota';

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT
  );
}

function getAuthUrl() {
  return getOAuthClient().generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar'],
  });
}

async function getOwnerConfig(prisma) {
  const user = await prisma.user.findUnique({ where: { id: OWNER_ID } });
  return {
    refreshToken: user?.googleRefreshToken ?? null,
    calendarId: user?.googleCalendarId || 'primary',
  };
}

function buildCalendarClient(refreshToken) {
  const auth = getOAuthClient();
  auth.setCredentials({ refresh_token: refreshToken });
  return google.calendar({ version: 'v3', auth });
}

async function createEvent(refreshToken, calendarId, appointment) {
  const cal = buildCalendarClient(refreshToken);
  const start = new Date(appointment.date);
  const durationMs = (appointment.service?.durationMinutes || 60) * 60_000;
  const end = new Date(start.getTime() + durationMs);

  const { data } = await cal.events.insert({
    calendarId: calendarId || 'primary',
    requestBody: {
      summary: `${appointment.service?.name || 'Cita'} — ${appointment.client?.name || ''}`,
      description: `Manicurista: ${appointment.manicurist?.name || ''}`,
      start: { dateTime: start.toISOString(), timeZone: TZ },
      end: { dateTime: end.toISOString(), timeZone: TZ },
      colorId: '1',
    },
  });
  return data.id;
}

async function deleteEvent(refreshToken, calendarId, googleEventId) {
  try {
    const cal = buildCalendarClient(refreshToken);
    await cal.events.delete({ calendarId: calendarId || 'primary', eventId: googleEventId });
  } catch (err) {
    // Event may already be deleted — ignore 404/410
    if (err.code !== 404 && err.code !== 410) throw err;
  }
}

module.exports = { getOAuthClient, getAuthUrl, getOwnerConfig, createEvent, deleteEvent, OWNER_ID };
