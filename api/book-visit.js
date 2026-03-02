const { google } = require('googleapis');

const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY, // JSON completo
  scopes: ['https://www.googleapis.com/auth/calendar']
});

const CALENDAR_ID = process.env.CALENDAR_ID || 'primary';

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Solo POST permitido' });
  }

  const { start, end, user_name, user_email, notes = '' } = req.body;

  if (!start || !end || !user_name || !user_email) {
    return res.status(400).json({ 
      status: 'error', 
      message: 'Faltan: start, end, user_name, user_email' 
    });
  }

  try {
    const authClient = await auth.getClient();
    const calendar = google.calendar({ version: 'v3', auth: authClient });

    // 1. Check disponibilidad
    const checkEvents = await calendar.events.list({
      calendarId: CALENDAR_ID,
      timeMin: new Date(start).toISOString(),
      timeMax: new Date(end).toISOString(),
      singleEvents: true,
      orderBy: 'startTime'
    });

    if (checkEvents.data.items?.length > 0) {
      return res.json({ 
        status: 'busy', 
        message: 'Franja ocupada. ¿Otra hora?',
        events: checkEvents.data.items.map(e => e.summary)
      });
    }

    // 2. Crear evento
    const event = {
      summary: `🧭 Visita: ${user_name}`,
      description: `Cliente: ${user_name}\nEmail: ${user_email}\nNotas: ${notes}\n\nAgendado desde agente ElevenLabs`,
      start: {
        dateTime: new Date(start),
        timeZone: 'Europe/Madrid',
      },
      end: {
        dateTime: new Date(end),
        timeZone: 'Europe/Madrid',
      },
      location: 'Oficina Madrid',
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },
          { method: 'popup', minutes: 10 },
        ],
      },
    };

    const createEvent = await calendar.events.insert({
      calendarId: CALENDAR_ID,
      resource: event,
    });

    res.json({ 
      status: 'booked', 
      event_id: createEvent.data.id,
      htmlLink: createEvent.data.htmlLink,
      start: createEvent.data.start.dateTime,
      end: createEvent.data.end.dateTime
    });

  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ 
      status: 'error', 
      message: error.message 
    });
  }
};
