import dotenv from 'dotenv';
dotenv.config();

const required = (key: string): string => {
  const val = process.env[key];
  if (!val) {
    console.error(`❌ Missing required env var: ${key}`);
    process.exit(1);
  }
  return val;
};

const optional = (key: string, fallback: string): string =>
  process.env[key] ?? fallback;

export const config = {
  PORT: parseInt(optional('PORT', '3001')),
  NODE_ENV: optional('NODE_ENV', 'development'),

  SUPABASE_URL: required('SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY: required('SUPABASE_SERVICE_ROLE_KEY'),

  TWILIO_ACCOUNT_SID: optional('TWILIO_ACCOUNT_SID', ''),
  TWILIO_AUTH_TOKEN: optional('TWILIO_AUTH_TOKEN', ''),
  TWILIO_PHONE_NUMBER: optional('TWILIO_PHONE_NUMBER', ''),

  FRONTEND_URL: optional('FRONTEND_URL', 'http://localhost:5173'),
  SMS_ENABLED: optional('SMS_ENABLED', 'false') === 'true',

  // Wait prediction weights
  BASE_SERVICE_MINUTES: parseInt(optional('BASE_SERVICE_MINUTES', '8')),
  REMINDER_THRESHOLD_POSITIONS: parseInt(optional('REMINDER_THRESHOLD', '3')),
};

export const isDev = config.NODE_ENV === 'development';
