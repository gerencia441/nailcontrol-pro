const { google } = require('googleapis');

function createOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirect = process.env.GOOGLE_REDIRECT;
  if (!clientId || !clientSecret || !redirect) throw new Error('Missing Google OAuth env vars');
  return new google.auth.OAuth2(clientId, clientSecret, redirect);
}

async function getOAuthClientForUser(prisma, userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.googleRefreshToken) return null;
  const oauth2Client = createOAuthClient();
  oauth2Client.setCredentials({ refresh_token: user.googleRefreshToken });
  return oauth2Client;
}

async function getCalendarId(prisma, userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user?.googleCalendarId || 'primary';
}

function toISOLocal(date) {
  // date is a Date or ISO string; return ISO string
  const d = new Date(date);
  return d.toISOString();
}

async function createEvent(prisma, userId, appt) {
  const oauth2Client = await getOAuthClientForUser(prisma, userId);
  if (!oauth2Client) return null;
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const start = new Date(appt.date);
  const end = new Date(start.getTime() + (appt.service?.durationMinutes || 60) * 60000);

  const summary = `${appt.service?.name || 'Cita'} — ${appt.client?.name || ''}`;
  const description = `Manicurista: ${appt.manicurist?.name || ''}`;

  const res = await calendar.events.insert({
    calendarId: await getCalendarId(prisma, userId),
    requestBody: {
      summary,
      description,
      start: { dateTime: toISOLocal(start), timeZone: 'America/Bogota' },
      end: { dateTime: toISOLocal(end), timeZone: 'America/Bogota' },
    },
  });

  return res.data.id;
}

async function updateEvent(prisma, userId, appt) {
  if (!appt.googleEventId) return null;
  const oauth2Client = await getOAuthClientForUser(prisma, userId);
  if (!oauth2Client) return null;
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const start = new Date(appt.date);
  const end = new Date(start.getTime() + (appt.service?.durationMinutes || 60) * 60000);

  const summary = `${appt.service?.name || 'Cita'} — ${appt.client?.name || ''}`;
  const description = `Manicurista: ${appt.manicurist?.name || ''}`;

  const res = await calendar.events.update({
    calendarId: await getCalendarId(prisma, userId),
    eventId: appt.googleEventId,
    requestBody: {
      summary,
      description,
      start: { dateTime: toISOLocal(start), timeZone: 'America/Bogota' },
      end: { dateTime: toISOLocal(end), timeZone: 'America/Bogota' },
    },
  });

  return res.data.id;
}

async function deleteEvent(prisma, userId, eventId) {
  if (!eventId) return;
  const oauth2Client = await getOAuthClientForUser(prisma, userId);
  if (!oauth2Client) return;
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  try {
    await calendar.events.delete({ calendarId: await getCalendarId(prisma, userId), eventId });
  } catch (e) {
    // ignore not found
  }
}

module.exports = {
  createEvent,
  updateEvent,
  deleteEvent,
};
