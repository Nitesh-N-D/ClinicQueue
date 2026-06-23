import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Phone, Search, ArrowLeft } from 'lucide-react';
import { getMyStatus } from '../lib/api';

const CLINIC_ID = import.meta.env.VITE_CLINIC_ID ?? 'a0000000-0000-0000-0000-000000000001';

export default function CheckStatusPage() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const formatPhone = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 10);
    if (d.length >= 7) return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
    if (d.length >= 4) return `(${d.slice(0,3)}) ${d.slice(3)}`;
    return d.length ? `(${d}` : '';
  };

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) { setError('Enter a valid 10-digit phone number'); return; }
    setError('');
    setLoading(true);
    try {
      const result = await getMyStatus(CLINIC_ID, digits);
      navigate(`/status/lookup?ticket=${result.ticketNumber}&name=${encodeURIComponent(result.name)}&pos=${result.position}&wait=${result.estimatedWaitMinutes}&status=${result.status}`);
    } catch {
      setError('No active queue entry found for this phone number.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-xs">
        <button onClick={() => navigate('/')} className="flex items-center gap-1 text-slate-400 hover:text-white text-sm mb-6">
          <ArrowLeft size={16} /> Back
        </button>
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-brand-600/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Search size={24} className="text-brand-400" />
          </div>
          <h1 className="text-xl font-bold text-white">Check My Status</h1>
          <p className="text-slate-400 text-sm mt-1">Enter the phone number you used to join</p>
        </div>
        <form onSubmit={handleCheck} className="card flex flex-col gap-4">
          <div>
            <label className="text-sm text-slate-400 mb-1 block flex items-center gap-1">
              <Phone size={13} /> Phone Number
            </label>
            <input
              className="input"
              placeholder="(555) 000-0000"
              value={phone}
              onChange={e => setPhone(formatPhone(e.target.value))}
              inputMode="tel"
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full py-3">
            {loading ? 'Looking up...' : 'Check Status'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
