import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Phone, User, ChevronRight, Globe, Clock, AlertCircle } from 'lucide-react';
import { joinQueue } from '../lib/api';
import { Language, AppointmentType } from '../shared/types';
import toast from 'react-hot-toast';

const CLINIC_ID = import.meta.env.VITE_CLINIC_ID ?? 'a0000000-0000-0000-0000-000000000001';

const LANGUAGES: { code: Language; label: string; native: string }[] = [
  { code: 'en', label: 'English',  native: 'English' },
  { code: 'es', label: 'Spanish',  native: 'Español' },
  { code: 'hi', label: 'Hindi',    native: 'हिंदी' },
  { code: 'ta', label: 'Tamil',    native: 'தமிழ்' },
  { code: 'fr', label: 'French',   native: 'Français' },
];

const LABELS: Record<Language, {
  title: string; subtitle: string;
  nameLabel: string; namePlaceholder: string;
  phoneLabel: string; phonePlaceholder: string;
  phoneNote: string;
  reasonLabel: string; reasonPlaceholder: string;
  typeWalkIn: string; typeAppointment: string;
  langLabel: string; submit: string; submitting: string;
  checkStatus: string;
}> = {
  en: {
    title: 'Join the Queue',
    subtitle: 'Enter your details and we\'ll text you updates',
    nameLabel: 'Your Name', namePlaceholder: 'Full name',
    phoneLabel: 'Phone Number', phonePlaceholder: '(555) 000-0000',
    phoneNote: 'We\'ll send SMS updates to this number',
    reasonLabel: 'Reason for Visit', reasonPlaceholder: 'e.g. General check-up, Prescription refill',
    typeWalkIn: 'Walk-in', typeAppointment: 'I have an appointment',
    langLabel: 'Language for SMS', submit: 'Join Queue', submitting: 'Joining...',
    checkStatus: 'Check my status',
  },
  es: {
    title: 'Unirse a la Cola',
    subtitle: 'Ingrese sus datos y le enviaremos actualizaciones por mensaje',
    nameLabel: 'Su Nombre', namePlaceholder: 'Nombre completo',
    phoneLabel: 'Número de Teléfono', phonePlaceholder: '(555) 000-0000',
    phoneNote: 'Le enviaremos mensajes SMS a este número',
    reasonLabel: 'Motivo de la Visita', reasonPlaceholder: 'Ej. Chequeo general, Renovar receta',
    typeWalkIn: 'Sin cita', typeAppointment: 'Tengo cita',
    langLabel: 'Idioma para SMS', submit: 'Unirse a la Cola', submitting: 'Uniéndose...',
    checkStatus: 'Ver mi estado',
  },
  hi: {
    title: 'कतार में शामिल हों',
    subtitle: 'अपनी जानकारी दें और हम SMS अपडेट भेजेंगे',
    nameLabel: 'आपका नाम', namePlaceholder: 'पूरा नाम',
    phoneLabel: 'फ़ोन नंबर', phonePlaceholder: '(555) 000-0000',
    phoneNote: 'इस नंबर पर SMS भेजे जाएंगे',
    reasonLabel: 'आने का कारण', reasonPlaceholder: 'जैसे: जांच, दवाई',
    typeWalkIn: 'बिना अपॉइंटमेंट', typeAppointment: 'अपॉइंटमेंट है',
    langLabel: 'SMS भाषा', submit: 'कतार में शामिल हों', submitting: 'शामिल हो रहे हैं...',
    checkStatus: 'मेरी स्थिति देखें',
  },
  ta: {
    title: 'வரிசையில் சேரவும்',
    subtitle: 'உங்கள் விவரங்களை உள்ளிடுங்கள், SMS அனுப்புவோம்',
    nameLabel: 'உங்கள் பெயர்', namePlaceholder: 'முழு பெயர்',
    phoneLabel: 'தொலைபேசி எண்', phonePlaceholder: '(555) 000-0000',
    phoneNote: 'இந்த எண்ணுக்கு SMS அனுப்பப்படும்',
    reasonLabel: 'வருகையின் காரணம்', reasonPlaceholder: 'உ.தா: பொது பரிசோதனை',
    typeWalkIn: 'நேரடி வருகை', typeAppointment: 'முன்பதிவு உள்ளது',
    langLabel: 'SMS மொழி', submit: 'வரிசையில் சேர', submitting: 'சேர்கிறோம்...',
    checkStatus: 'என் நிலை பார்',
  },
  fr: {
    title: 'Rejoindre la File',
    subtitle: 'Entrez vos coordonnées, nous vous enverrons des mises à jour par SMS',
    nameLabel: 'Votre Nom', namePlaceholder: 'Nom complet',
    phoneLabel: 'Numéro de Téléphone', phonePlaceholder: '(555) 000-0000',
    phoneNote: 'Nous enverrons des SMS à ce numéro',
    reasonLabel: 'Motif de la Visite', reasonPlaceholder: 'Ex. Consultation générale',
    typeWalkIn: 'Sans rendez-vous', typeAppointment: 'J\'ai un rendez-vous',
    langLabel: 'Langue pour SMS', submit: 'Rejoindre la File', submitting: 'Inscription...',
    checkStatus: 'Voir mon statut',
  },
};

export default function JoinPage() {
  const navigate = useNavigate();
  const [lang, setLang] = useState<Language>('en');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState<AppointmentType>('walk_in');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const L = LABELS[lang];

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 10);
    if (digits.length >= 7) return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
    if (digits.length >= 4) return `(${digits.slice(0,3)}) ${digits.slice(3)}`;
    if (digits.length >= 1) return `(${digits}`;
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) { setError('Please enter a valid 10-digit phone number'); return; }
    if (!name.trim()) { setError('Please enter your name'); return; }

    setSubmitting(true);
    try {
      const patient = await joinQueue(CLINIC_ID, {
        name: name.trim(),
        phone: digits,
        language: lang,
        type,
        reason: reason.trim(),
      });
      toast.success(`Joined! Ticket #${patient.ticketNumber}`);
      navigate(`/status/${patient.id}?ticket=${patient.ticketNumber}&name=${encodeURIComponent(patient.name)}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? 'Failed to join queue. Please try again.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      {/* Language picker */}
      <div className="flex gap-2 flex-wrap justify-center mb-6">
        {LANGUAGES.map(l => (
          <button
            key={l.code}
            onClick={() => setLang(l.code)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              lang === l.code
                ? 'bg-brand-600 text-white'
                : 'bg-surface-card text-slate-400 hover:text-white border border-surface-border'
            }`}
          >
            {l.native}
          </button>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-brand-600/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">🏥</span>
          </div>
          <h1 className="text-2xl font-bold text-white">{L.title}</h1>
          <p className="text-slate-400 text-sm mt-1">{L.subtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="card flex flex-col gap-4">
          {/* Visit type */}
          <div className="grid grid-cols-2 gap-2">
            {(['walk_in', 'appointment'] as AppointmentType[]).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                  type === t
                    ? 'bg-brand-600 border-brand-500 text-white'
                    : 'bg-surface-hover border-surface-border text-slate-400'
                }`}
              >
                {t === 'walk_in' ? L.typeWalkIn : L.typeAppointment}
              </button>
            ))}
          </div>

          {/* Name */}
          <div>
            <label className="text-sm text-slate-400 mb-1 block flex items-center gap-1">
              <User size={13} /> {L.nameLabel}
            </label>
            <input
              className="input"
              placeholder={L.namePlaceholder}
              value={name}
              onChange={e => setName(e.target.value)}
              autoComplete="name"
              required
            />
          </div>

          {/* Phone */}
          <div>
            <label className="text-sm text-slate-400 mb-1 block flex items-center gap-1">
              <Phone size={13} /> {L.phoneLabel}
            </label>
            <input
              className="input"
              placeholder={L.phonePlaceholder}
              value={phone}
              onChange={e => setPhone(formatPhone(e.target.value))}
              inputMode="tel"
              autoComplete="tel"
              required
            />
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <Clock size={11} /> {L.phoneNote}
            </p>
          </div>

          {/* Reason */}
          <div>
            <label className="text-sm text-slate-400 mb-1 block">{L.reasonLabel}</label>
            <input
              className="input"
              placeholder={L.reasonPlaceholder}
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
          </div>

          {/* Language for SMS */}
          <div>
            <label className="text-sm text-slate-400 mb-1 block flex items-center gap-1">
              <Globe size={13} /> {L.langLabel}
            </label>
            <select
              className="input"
              value={lang}
              onChange={e => setLang(e.target.value as Language)}
            >
              {LANGUAGES.map(l => (
                <option key={l.code} value={l.code}>{l.label} — {l.native}</option>
              ))}
            </select>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 bg-red-900/30 border border-red-700/50 rounded-lg px-3 py-2 text-sm text-red-300">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full py-3 text-base"
          >
            {submitting ? L.submitting : L.submit}
            {!submitting && <ChevronRight size={18} />}
          </button>
        </form>

        {/* Check status link */}
        <p className="text-center mt-4">
          <button
            onClick={() => navigate('/check-status')}
            className="text-brand-400 hover:text-brand-300 text-sm underline"
          >
            {L.checkStatus}
          </button>
        </p>
      </motion.div>
    </div>
  );
}
