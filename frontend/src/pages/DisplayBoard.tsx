import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Users, Volume2, VolumeX } from 'lucide-react';
import { usePatientSocket } from '../hooks/useSocket';
import { useVoiceAnnouncer } from '../hooks/useVoiceAnnouncer';

const CLINIC_ID = import.meta.env.VITE_CLINIC_ID ?? 'a0000000-0000-0000-0000-000000000001';

// Designed for a waiting-room TV or tablet — large text, auto-refreshing, no interaction needed
export default function DisplayBoard() {
  const { connected, update } = usePatientSocket(CLINIC_ID);

  const called = update?.queue.filter(q => q.status === 'called') ?? [];
  const serving = update?.queue.filter(q => q.status === 'serving') ?? [];
  const waiting = update?.queue.filter(q => q.status === 'waiting') ?? [];

  const { enabled, supported, toggle } = useVoiceAnnouncer(called.map(c => c.ticketNumber));

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <span className="text-4xl">🏥</span>
          <div>
            <h1 className="text-2xl font-bold text-white">{update?.clinic.name ?? 'ClinicQueue'}</h1>
            <p className="text-slate-500 text-sm">Live Queue Status</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {supported && (
            <button
              onClick={toggle}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border transition-all ${
                enabled
                  ? 'bg-emerald-900/30 border-emerald-700/50 text-emerald-400'
                  : 'bg-slate-900 border-slate-700 text-slate-500'
              }`}
            >
              {enabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
              {enabled ? 'Voice on' : 'Enable voice calls'}
            </button>
          )}
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${connected ? 'bg-emerald-400 pulse-green' : 'bg-slate-600'}`} />
            <span className="text-slate-400 text-sm">{connected ? 'Live' : 'Connecting...'}</span>
          </div>
        </div>
      </div>


      {/* Now serving — huge ticket numbers */}
      <div className="mb-8">
        <p className="text-slate-500 text-sm uppercase tracking-widest mb-3 flex items-center gap-2">
          <Clock size={14} /> Now Calling
        </p>
        <div className="grid grid-cols-3 gap-4">
          <AnimatePresence>
            {[...called, ...serving].length === 0 && (
              <div className="col-span-3 text-center py-12 text-slate-600 text-xl">
                No patients currently being called
              </div>
            )}
            {[...called, ...serving].map(p => (
              <motion.div
                key={p.ticketNumber}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="bg-blue-900/30 border-2 border-blue-500 rounded-2xl p-6 text-center called-glow"
              >
                <p className="text-7xl font-bold text-white ticket-glow">#{p.ticketNumber}</p>
                <p className="text-blue-300 text-sm mt-2 uppercase tracking-wide">
                  {p.status === 'called' ? 'Please come now' : 'Being served'}
                </p>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Waiting list */}
      <div className="flex-1">
        <p className="text-slate-500 text-sm uppercase tracking-widest mb-3 flex items-center gap-2">
          <Users size={14} /> Waiting ({waiting.length})
        </p>
        <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-3">
          {waiting.map(p => (
            <motion.div
              key={p.ticketNumber}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center"
            >
              <p className="text-2xl font-bold text-slate-200">#{p.ticketNumber}</p>
              <p className="text-slate-500 text-xs mt-1">~{p.estimatedWaitMinutes}m</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Footer stats */}
      <div className="mt-8 pt-6 border-t border-slate-800 grid grid-cols-3 text-center">
        <div>
          <p className="text-3xl font-bold text-amber-400">{update?.stats.waiting ?? 0}</p>
          <p className="text-slate-500 text-sm">Waiting</p>
        </div>
        <div>
          <p className="text-3xl font-bold text-emerald-400">{update?.stats.avgWaitMinutes ?? 0}m</p>
          <p className="text-slate-500 text-sm">Average Wait</p>
        </div>
        <div>
          <p className="text-3xl font-bold text-slate-400">{update?.stats.done ?? 0}</p>
          <p className="text-slate-500 text-sm">Served Today</p>
        </div>
      </div>
    </div>
  );
}
