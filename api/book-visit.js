const { google } = require('googleapis');  // ✅ DESTRUCTURING CORRECTO

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

  // END AUTOMÁTICO +1h
  let finalEnd = end;
  if (!end) {
    const startDate = new Date(start);
    finalEnd = new Date(startDate.getTime() + 60 * 60 * 1000).toISOString().slice(0, 19);
    console.log('🔄 End calculado:', finalEnd);
  }

  try {
    // AUTH CORRECTO (googleapis v137+)
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
      scopes: ['https://www.googleapis.com/auth/calendar']
    });

    const authClient = await auth.getClient();
    const calendar = google.calendar({ version: 'v3', auth: authClient });

    const calendarId = process.env.CALENDAR_ID || 'primary';
    console.log('📅 Usando calendario:', calendarId);

    // CHECK DISPONIBILIDAD
    const events = await calendar.events.list({
      calendarId,
      timeMin: new Date(start).toISOString(),
      timeMax: new Date(finalEnd).toISOString(),
      singleEvents: true,
      orderBy: 'startTime'
    });

    if (events.data.items && events.data.items.length > 0) {
      console.log('❌ Ocupado:', events.data.items.length, 'eventos');
      return res.json({ 
        status: 'busy', 
        message: 'Franja ocupada. ¿Te viene +30min o mañana?' 
      });
    }

    // CREAR EVENTO
    const event = {
      summary: `🧭 Visita: ${user_name}`,
      description: `Cliente: ${user_name}\nEmail: ${user_email}\nNotas: ${notes}`,
      start: { dateTime: new Date(start), timeZone: 'Europe/Madrid' },
      end: { dateTime: new Date(finalEnd), timeZone: 'Europe/Madrid' },
      location: 'Oficina Madrid',
      reminders: {
        useDefault: false,
        overrides: [{ method: 'popup', minutes: 60 }]
      }
    };

    const result = await calendar.events.insert({
      calendarId,
      resource: event
    });

    console.log('✅ CREADO:', result.data.id);
    res.json({ 
      status: 'booked', 
      event_id: result.data.id,
      start: start,
      end: finalEnd,
      htmlLink: result.data.htmlLink
    });

  } catch (error) {
    console.error('💥 ERROR:', error.message);
    res.status(500).json({ 
      status: 'error', 
      message: error.message 
    });
  }
};
