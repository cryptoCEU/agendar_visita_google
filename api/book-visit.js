const { google } = require('googleapis');

module.exports = async (req, res) => {
  console.log('📥 Body recibido:', JSON.stringify(req.body, null, 2));
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Solo POST permitido' });
  }

  // FIX ELEVENLABS: Normalizar "use_name" → "user_name"
  const body = req.body;
  const normalized = {
    start: body.start,
    end: body.end,
    user_name: body.user_name || body.use_name,  // ← FIX CRÍTICO
    user_email: body.user_email,
    notes: body.notes || ''
  };

  const { start, end, user_name, user_email, notes } = normalized;
  
  console.log('👤 Normalizado:', { start, end, user_name, user_email });

  if (!start || !user_name || !user_email) {
    return res.status(400).json({ 
      status: 'error', 
      message: 'Faltan: start, user_name, user_email' 
    });
  }

  // END AUTO +1h (visitas 60min)
  let finalEnd = end;
  if (!end) {
    const startDate = new Date(start);
    finalEnd = new Date(startDate.getTime() + 60 * 60 * 1000).toISOString().slice(0, 19);
    console.log('🔄 End auto:', finalEnd);
  }

  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    return res.status(500).json({ status: 'error', message: 'Falta configuración' });
  }

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
      scopes: ['https://www.googleapis.com/auth/calendar']
    });

    const authClient = await auth.getClient();
    const calendar = google.calendar({ version: 'v3', auth: authClient });
    const calendarId = process.env.CALENDAR_ID || 'primary';

    console.log('📅 Check:', calendarId, start, '→', finalEnd);

    // 1. CHECK DISPONIBILIDAD
    const events = await calendar.events.list({
      calendarId,
      timeMin: new Date(start).toISOString(),
      timeMax: new Date(finalEnd).toISOString(),
      singleEvents: true,
      orderBy: 'startTime'
    });

    if (events.data.items && events.data.items.length > 0) {
      console.log('❌ Ocupado:', events.data.items.length);
      return res.json({ 
        status: 'busy', 
        message: 'Franja ocupada. ¿+30min, mañana, o miércoles?' 
      });
    }

    // 2. FIX HORARIO GOOGLE CALENDAR - Europe/Madrid EXPLÍCITO
    const event = {
      summary: `🧭 Visita: ${user_name}`,
      description: `Cliente: ${user_name}\nEmail: ${user_email}\nNotas: ${notes}\n\nAgendado desde agente ElevenLabs`,
      start: { 
        dateTime: start,  // ISO directo del LLM
        timeZone: 'Europe/Madrid'  // ← FIX CRÍTICO
      },
      end: { 
        dateTime: finalEnd,
        timeZone: 'Europe/Madrid'  // ← HORA EXACTA
      },
      location: { displayName: 'Oficina Madrid' },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 1440 },  // 24h
          { method: 'popup', minutes: 60 }     // 1h
        ]
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
      htmlLink: result.data.htmlLink,
      start: start,
      end: finalEnd
    });

  } catch (error) {
    console.error('💥 ERROR:', error.message);
    res.status(500).json({ 
      status: 'error', 
      message: error.message 
    });
  }
};
