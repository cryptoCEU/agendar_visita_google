module.exports = async (req, res) => {
  // DEBUG logs
  console.log('📥 Request recibido');
  console.log('🔑 GOOGLE_SERVICE_ACCOUNT_KEY existe:', !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
  console.log('📅 CALENDAR_ID:', process.env.CALENDAR_ID);
  
  if (req.method !== 'POST') {
    console.log('❌ Método no permitido:', req.method);
    return res.status(405).json({ error: 'Solo POST permitido' });
  }

  const { start, end, user_name, user_email, notes = '' } = req.body;
  console.log('📋 Body recibido:', { start, end, user_name, user_email });

  // VALIDACIÓN: Campos obligatorios
  if (!start || !user_name || !user_email) {
    console.log('❌ Faltan campos obligatorios');
    return res.status(400).json({ 
      status: 'error', 
      message: 'Faltan: start, user_name, user_email' 
    });
  }

  // 🆕 VALIDACIÓN END AUTOMÁTICA: Si no viene end, start + 1h
  let finalEnd = end;
  if (!end) {
    const startDate = new Date(start);
    finalEnd = new Date(startDate.getTime() + 60 * 60 * 1000).toISOString().slice(0, 19); // +1h
    console.log('🔄 End auto-calculado:', finalEnd);
  }

  console.log('📊 Final usando:', { start, end: finalEnd, user_name, user_email });

  // CHECK CRÍTICO: Variables de entorno
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    console.error('❌ FALTA GOOGLE_SERVICE_ACCOUNT_KEY');
    return res.status(500).json({ status: 'error', message: 'Falta configuración Google Calendar' });
  }

  try {
    const { google } = require('googleapis');
    
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
      scopes: ['https://www.googleapis.com/auth/calendar']
    });

    const authClient = await auth.getClient();
    const calendar = google.calendar({ version: 'v3', auth: authClient });
    
    console.log('✅ Google Calendar autenticado');

    // 1. CHECK DISPONIBILIDAD
    const calendarId = process.env.CALENDAR_ID || 'primary';
    const events = await calendar.events.li
