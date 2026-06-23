export type QueueStatus = 'waiting' | 'called' | 'serving' | 'done' | 'no_show';
export type Language = 'en' | 'es' | 'hi' | 'ta' | 'fr';
export type AppointmentType = 'walk_in' | 'appointment';

export interface Patient {
  id: string;
  ticketNumber: number;
  name: string;
  phone: string;
  language: Language;
  type: AppointmentType;
  reason: string;
  status: QueueStatus;
  position: number;
  estimatedWaitMinutes: number;
  joinedAt: number;
  calledAt: number | null;
  servedAt: number | null;
  completedAt: number | null;
  clinicId: string;
  notified: boolean;
}

export interface Clinic {
  id: string;
  name: string;
  phone: string;
  address: string;
  staffCount: number;
  isOpen: boolean;
  avgServiceMinutes: number;
  createdAt: number;
}

export interface QueueStats {
  waiting: number;
  serving: number;
  done: number;
  avgWaitMinutes: number;
  estimatedWaitForNew: number;
  staffActive: number;
}

export interface WaitPrediction {
  estimatedMinutes: number;
  confidence: 'low' | 'medium' | 'high';
  basedOn: string;
}

export interface SMSMessage {
  to: string;
  body: string;
  language: Language;
}

export interface StaffAction {
  action: 'call_next' | 'mark_serving' | 'mark_done' | 'mark_no_show' | 'add_staff' | 'remove_staff';
  patientId?: string;
  staffCount?: number;
}

export interface DashboardState {
  clinic: Clinic;
  queue: Patient[];
  stats: QueueStats;
  isConnected: boolean;
}

export const SMS_TEMPLATES: Record<string, Record<Language, string>> = {
  joined: {
    en: 'Hi {name}, you are #\${ticket} in queue at {clinic}. Est. wait: {wait} min. Reply HELP for status.',
    es: 'Hola {name}, usted es #\${ticket} en la cola de {clinic}. Espera estimada: {wait} min. Responda AYUDA para estado.',
    hi: 'नमस्ते {name}, आप {clinic} में #\${ticket} नंबर पर हैं। अनुमानित प्रतीक्षा: {wait} मिनट।',
    ta: 'வணக்கம் {name}, நீங்கள் {clinic} வரிசையில் #\${ticket}. மதிப்பிடப்பட்ட காத்திருப்பு: {wait} நிமிடம்.',
    fr: 'Bonjour {name}, vous êtes le #\${ticket} dans la file de {clinic}. Attente estimée: {wait} min.',
  },
  called: {
    en: 'Your turn! Please come to the reception at {clinic} now. Ticket #{ticket}.',
    es: 'Su turno! Por favor acérquese a recepción en {clinic} ahora. Turno #{ticket}.',
    hi: 'आपकी बारी है! कृपया अभी {clinic} के रिसेप्शन पर आएं। टिकट #{ticket}।',
    ta: 'உங்கள் முறை! இப்போது {clinic} ஏற்பு மேசையில் வாருங்கள். டிக்கெட் #{ticket}.',
    fr: 'C\'est votre tour! Venez à l\'accueil de {clinic} maintenant. Ticket #{ticket}.',
  },
  status: {
    en: 'Queue update: You are #{position} in line. Est. wait: {wait} min. Current serving: #{serving}.',
    es: 'Actualización: Usted es #{position} en la fila. Espera: {wait} min.',
    hi: 'कतार अपडेट: आप #{position} नंबर पर हैं। प्रतीक्षा: {wait} मिनट।',
    ta: 'வரிசை நிலை: நீங்கள் #{position}. காத்திருப்பு: {wait} நிமிடம்.',
    fr: 'Mise à jour: Vous êtes #{position} dans la file. Attente: {wait} min.',
  },
  reminder: {
    en: 'Reminder: You are #{position} in queue at {clinic}. Est. wait: {wait} min.',
    es: 'Recordatorio: Usted es #{position} en la cola de {clinic}. Espera: {wait} min.',
    hi: 'अनुस्मारक: {clinic} में आप #{position} नंबर पर हैं। प्रतीक्षा: {wait} मिनट।',
    ta: 'நினைவூட்டல்: {clinic} வரிசையில் நீங்கள் #{position}. காத்திருப்பு: {wait} நிமிடம்.',
    fr: 'Rappel: Vous êtes #{position} dans la file de {clinic}. Attente: {wait} min.',
  },
};

// ─── Queue intelligence (v2 features) ──────────────────────────────────────────

export interface NoShowRisk {
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  reason: string;
}

export interface ConfidenceBand {
  low: number;
  expected: number;
  high: number;
}

export interface QueueHealthFactor {
  label: string;
  impact: 'positive' | 'negative';
  detail: string;
}

export interface QueueHealth {
  score: number;
  status: 'excellent' | 'good' | 'strained' | 'critical';
  factors: QueueHealthFactor[];
}

export interface EnrichedPatient extends Patient {
  noShowRisk?: NoShowRisk;
  confidenceBand?: ConfidenceBand;
}
