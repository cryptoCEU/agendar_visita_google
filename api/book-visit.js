export default async function handler(req, res) {
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

  // DEBUG: Verificar variables
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    return res.status(500).json({ 
      status: 'error', 
      message: 'Falta GOOGLE_SERVICE_ACCOUNT_KEY' 
    });
  }

  try {
    const { google } = await import('googleapis');
    
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
      scopes: ['https://www.googleapis.com/auth/calendar']
    });

    const CALENDAR_ID = process.env.CALENDAR_ID || 'primary';
    
    const authClient = await auth.getClient();
    const calendar = google.calendar({ version: 'v3', auth: authClient });

    // Check disponibilidad
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
        message: 'Franja ocupada',
        events: checkEvents.data.items.map(e => e.summary)
      });
    }

    // Crear evento
    const event = {
      summary: `🧭 Visita: ${user_name}`,
      description: `Cliente: ${user_name}\nEmail: ${user_email}\nNotas: ${notes}`,
      start: { dateTime: new Date(start), timeZone: 'Europe/Madrid' },
      end: { dateTime: new Date(end), timeZone: 'Europe/Madrid' },
      location: 'Oficina Madrid'
    };

    const createEvent = await calendar.events.insert({
      calendarId: CALENDAR_ID,
      resource: event,
    });

    res.json({ 
      status: 'booked', 
      event_id: createEvent.data.id,
      htmlLink: createEvent.data.htmlLink
    });

  } catch (error) {
    console.error('ERROR COMPLETO:', error);
    res.status(500).json({ 
      status: 'error', 
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : 'Internal error'
    });
  }
}
