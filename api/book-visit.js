module.exports = async (req, res) => {
  console.log('📥 Request recibido');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Solo POST permitido' });
  }

  const { start, end, user_name, user_email, notes = '' } = req.body;
  
  if (!start || !user_name || !user_email) {
    return res.status(400).json({ 
      status: 'error', 
      message: 'Faltan: start, user_name, user_email' 
    });
  }

  // CALCULAR END AUTOMÁTICO (+1h si no viene)
  let finalEnd = end;
  if (!end) {
    const startDate = new Date(start);
    finalEnd = new Date(startDate.getTime() + 60 * 60 * 1000).toISOString().slice(0, 19);
  }

  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    return res.status(500).json({ status: 'error', message: 'Falta configuración' });
  }

  try {
    const google = require('googleapis');
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
      scopes: ['https://www.googleapis.com/auth/calendar']
    });

    const authClient = await auth.getClient();
    const calendar = google.calendar({ version: 'v3', auth: authClient });

    const calendarId = process.env.CALENDAR_ID || 'primary';

    // CHECK DISPONIBILIDAD
    const events = await calendar.events.list({
      calendarId: calendarId,
      timeMin: new Date(start).toISOString(),
      timeMax: new Date(finalEnd).toISOString(),
      singleEvents: true
    });

    if (events.data.items && events.data.items.length > 0) {
      return res.json({ 
        status: 'busy', 
        message: 'Franja ocupada. ¿Otra hora?' 
      });
    }

    // CREAR EVENTO
    const event = {
      summary: `🧭 Visita: ${user_name}`,
      description: `Cliente: ${user_name}\nEmail: ${user_email}\n${notes}`,
      start: { dateTime: new Date(start), timeZone: 'Europe/Madrid' },
      end: { dateTime: new Date(finalEnd), timeZone: 'Europe/Madrid' },
      location: 'Oficina Madrid'
    };

    const result = await calendar.events.insert({
      calendarId: calendarId,
      resource: event
    });

    res.json({ 
      status: 'booked', 
      event_id: result.data.id,
      start: start,
      end: finalEnd
    });

  } catch (error) {
    console.error('ERROR:', error.message);
    res.status(500).json({ 
      status: 'error', 
      message: error.message 
    });
  }
};
