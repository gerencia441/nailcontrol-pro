const { google } = require('googleapis');

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'primary';

function getOAuthClient() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT, GOOGLE_REFRESH_TOKEN } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT || !GOOGLE_REFRESH_TOKEN) return null;
  const client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT);
  client.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
  return client;
}

async function createEvent(_prisma, _userId, appt) {
  const oauth2Client = getOAuthClient();
  if (!oauth2Client) return null;
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const start = new Date(appt.date);
  const end = new Date(start.getTime() + (appt.service?.durationMinutes || 60) * 60000);

  const res = await calendar.events.insert({
    calendarId: CALENDAR_ID,
    requestBody: {
      summary: `${appt.service?.name || 'Cita'} — ${appt.client?.name || ''}`,
      description: `Manicurista: ${appt.manicurist?.name || ''}`,
      start: { dateTime: start.toISOString(), timeZone: 'America/Bogota' },
      end: { dateTime: end.toISOString(), timeZone: 'America/Bogota' },
    },
  });

  return res.data.id;
}

async function updateEvent(_prisma, _userId, appt) {
  if (!appt.googleEventId) return null;
  const oauth2Client = getOAuthClient();
  if (!oauth2Client) return null;
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const start = new Date(appt.date);
  const end = new Date(start.getTime() + (appt.service?.durationMinutes || 60) * 60000);

  const res = await calendar.events.update({
    calendarId: CALENDAR_ID,
    eventId: appt.googleEventId,
    requestBody: {
      summary: `${appt.service?.name || 'Cita'} — ${appt.client?.name || ''}`,
      description: `Manicurista: ${appt.manicurist?.name || ''}`,
      start: { dateTime: start.toISOString(), timeZone: 'America/Bogota' },
      end: { dateTime: end.toISOString(), timeZone: 'America/Bogota' },
    },
  });

  return res.data.id;
}

async function deleteEvent(_prisma, _userId, eventId) {
  if (!eventId) return;
  const oauth2Client = getOAuthClient();
  if (!oauth2Client) return;
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  try {
    await calendar.events.delete({ calendarId: CALENDAR_ID, eventId });
  } catch {
    // ignore not found / already deleted
  }
}

module.exports = { createEvent, updateEvent, deleteEvent };
