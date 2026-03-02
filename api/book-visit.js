module.exports = async (req, res) => {
  // DEBUG: Estado inicial
  console.log('📥 Request recibido');
  console.log('🔑 GOOGLE_SERVICE_ACCOUNT_KEY existe:', !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
  console.log('📅 CALENDAR_ID:', process.env.CALENDAR_ID);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Solo POST permitido' });
  }

  const { start, end, user_name, user_email } = req.body;
  console.log('📋 Body:', { start, end, user_name, user_email });

  if (!start || !end || !user_name || !user_email) {
    return res.status(400).json({ status: 'error', message: 'Faltan campos requeridos' });
  }

  // CHECK CRÍTICO
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    console.error('❌ FALTA GOOGLE_SERVICE_ACCOUNT_KEY');
    return res.status(500).json({ status: 'error', message: 'Falta GOOGLE_SERVICE_ACCOUNT_KEY en variables' });
  }

  try {
    const { google } = require('googleapis');
    
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
      scopes: ['https://www.googleapis.com/auth/calendar']
    });

    const authClient = await auth.getClient();
    const calendar = google.calendar({ version: 'v3', auth: authClient });
    
    console.log('✅ Google Calendar auth OK');

    // Check eventos
    const events = await calendar.events.list({
      calendarId: process.env.CALENDAR_ID || 'primary',
      timeMin: new Date(start).toISOString(),
      timeMax: new Date(end).toISOString()
    });

    console.log('📊 Eventos encontrados:', events.data.items?.length || 0);

    if (events.data.items?.length > 0) {
      return res.json({ status: 'busy', message: 'Franja ocupada' });
    }

    // Crear evento
    const event = {
      summary: `🧭 Visita: ${user_name}`,
      start: { dateTime: new Date(start), timeZone: 'Europe/Madrid' },
      end: { dateTime: new Date(end), timeZone: 'Europe/Madrid' }
    };

    const result = await calendar.events.insert({
      calendarId: process.env.CALENDAR_ID || 'primary',
      resource: event
    });

    console.log('✅ Evento creado:', result.data.id);
    res.json({ status: 'booked', event_id: result.data.id });

  } catch (error) {
    console.error('💥 ERROR COMPLETO:', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
};
