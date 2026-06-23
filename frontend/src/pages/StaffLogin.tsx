import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, AlertCircle, ChevronDown, ShieldCheck } from 'lucide-react';
import { verifyPin, setStaffPin, setGoogleAccessToken } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

const CLINIC_ID = import.meta.env.VITE_CLINIC_ID ?? 'a0000000-0000-0000-0000-000000000001';

interface Props { onLogin: (mode: 'pin' | 'google', pin?: string) => void; }

export default function StaffLogin({ onLogin }: Props) {
  const { session, loading, signInWithGoogle, googleConfigured } = useAuth();
  const [showPinFallback, setShowPinFallback] = useState(!googleConfigured);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [pinLoading, setPinLoading] = useState(false);

  // Once Supabase returns a session (after Google redirect), forward the
  // access token to the API client and notify the parent we're authed.
  useEffect(() => {
    if (session?.access_token) {
      setGoogleAccessToken(session.access_token);
      onLogin('google');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 4) { setError('PIN must be at least 4 digits'); return; }
    setError('');
    setPinLoading(true);
    const ok = await verifyPin(CLINIC_ID, pin);
    setPinLoading(false);
    if (ok) {
      setStaffPin(pin);
      onLogin('pin', pin);
    } else {
      setError('Invalid PIN. Please try again.');
      setPin('');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xs"
      >
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-brand-600/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <ShieldCheck size={24} className="text-brand-400" />
          </div>
          <h1 className="text-xl font-bold text-white">Staff Access</h1>
          <p className="text-slate-400 text-sm mt-1">Sign in to manage the queue</p>
        </div>

        {googleConfigured && (
          <button
            onClick={signInWithGoogle}
            className="w-full bg-white hover:bg-slate-100 text-slate-800 font-medium py-3 rounded-lg flex items-center justify-center gap-3 transition-colors mb-4"
          >
            <GoogleIcon />
            Continue with Google
          </button>
        )}

        {googleConfigured && (
          <button
            onClick={() => setShowPinFallback(s => !s)}
            className="w-full flex items-center justify-center gap-1 text-slate-500 hover:text-slate-300 text-xs py-2 transition-colors"
          >
            Or use a staff PIN instead
            <ChevronDown size={13} className={showPinFallback ? 'rotate-180' : ''} style={{ transition: 'transform 0.15s' }} />
          </button>
        )}

        <AnimatePresence>
          {showPinFallback && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <form onSubmit={handlePinSubmit} className="card flex flex-col gap-4 mt-2">
                <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                  <Lock size={13} /> Staff PIN
                </div>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  className="input text-center text-2xl tracking-widest"
                  placeholder="• • • •"
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                  autoFocus={!googleConfigured}
                />
                {error && (
                  <div className="flex items-center gap-2 text-red-300 text-sm">
                    <AlertCircle size={15} /> {error}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={pinLoading || pin.length < 4}
                  className="btn-primary w-full py-2.5"
                >
                  {pinLoading ? 'Verifying...' : 'Sign in with PIN'}
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-center text-slate-600 text-xs mt-4">
          {googleConfigured
            ? 'Google sign-in is recommended — it lets admins manage who has access.'
            : 'Default PIN: 1234 (change via STAFF_PIN env var). Set up Supabase to enable Google sign-in.'}
        </p>
      </motion.div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
    </svg>
  );
}
