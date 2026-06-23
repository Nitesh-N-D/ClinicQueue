import twilio from 'twilio';
import { config } from '../config';
import { Language, Patient, Clinic, SMS_TEMPLATES } from '../shared/types';

let twilioClient: ReturnType<typeof twilio> | null = null;

if (config.SMS_ENABLED && config.TWILIO_ACCOUNT_SID && config.TWILIO_AUTH_TOKEN) {
  twilioClient = twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);
  console.log('✅ Twilio SMS enabled');
} else {
  console.log('📱 SMS in demo mode (no Twilio keys) — messages logged to console');
}

function fillTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    // Also handle ${...} syntax in templates
    result = result.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
  }
  return result;
}

async function sendSMS(to: string, body: string, language: Language): Promise<boolean> {
  // Normalize phone number
  let phone = to.replace(/\D/g, '');
  if (phone.length === 10) phone = '1' + phone;
  if (!phone.startsWith('+')) phone = '+' + phone;

  if (!twilioClient) {
    // Demo mode: log to console
    console.log(`\n📱 [SMS DEMO] To: ${phone} [${language.toUpperCase()}]`);
    console.log(`   Message: ${body}`);
    console.log('');
    return true;
  }

  try {
    await twilioClient.messages.create({
      body,
      from: config.TWILIO_PHONE_NUMBER,
      to: phone,
    });
    console.log(`✅ SMS sent to ${phone}`);
    return true;
  } catch (err) {
    console.error(`❌ SMS failed to ${phone}:`, (err as Error).message);
    return false;
  }
}

export async function notifyJoined(patient: Patient, clinic: Clinic): Promise<boolean> {
  const lang = patient.language;
  const template = SMS_TEMPLATES.joined[lang] ?? SMS_TEMPLATES.joined.en;
  const body = fillTemplate(template, {
    name: patient.name.split(' ')[0],
    ticket: patient.ticketNumber.toString(),
    clinic: clinic.name,
    wait: patient.estimatedWaitMinutes.toString(),
  });
  return sendSMS(patient.phone, body, lang);
}

export async function notifyCalled(patient: Patient, clinic: Clinic): Promise<boolean> {
  const lang = patient.language;
  const template = SMS_TEMPLATES.called[lang] ?? SMS_TEMPLATES.called.en;
  const body = fillTemplate(template, {
    name: patient.name.split(' ')[0],
    ticket: patient.ticketNumber.toString(),
    clinic: clinic.name,
  });
  return sendSMS(patient.phone, body, lang);
}

export async function sendStatusUpdate(patient: Patient, currentServing: number): Promise<boolean> {
  const lang = patient.language;
  const template = SMS_TEMPLATES.status[lang] ?? SMS_TEMPLATES.status.en;
  const body = fillTemplate(template, {
    position: patient.position.toString(),
    wait: patient.estimatedWaitMinutes.toString(),
    serving: currentServing.toString(),
  });
  return sendSMS(patient.phone, body, lang);
}

export async function sendReminder(patient: Patient, clinic: Clinic): Promise<boolean> {
  const lang = patient.language;
  const template = SMS_TEMPLATES.reminder[lang] ?? SMS_TEMPLATES.reminder.en;
  const body = fillTemplate(template, {
    name: patient.name.split(' ')[0],
    ticket: patient.ticketNumber.toString(),
    clinic: clinic.name,
    position: patient.position.toString(),
    wait: patient.estimatedWaitMinutes.toString(),
  });
  return sendSMS(patient.phone, body, lang);
}

export async function handleIncomingSMS(from: string, body: string, clinicId: string): Promise<string> {
  const text = body.trim().toUpperCase();

  if (text === 'HELP' || text === 'AYUDA' || text === 'STATUS' || text === '?') {
    return 'STATUS_REQUEST';
  }
  if (text === 'LEAVE' || text === 'CANCEL' || text === 'SALIR') {
    return 'LEAVE_REQUEST';
  }
  if (text.startsWith('JOIN ') || text.startsWith('UNIRSE ')) {
    const code = text.split(' ')[1];
    return `JOIN_REQUEST:${code}`;
  }
  return 'UNKNOWN';
}
