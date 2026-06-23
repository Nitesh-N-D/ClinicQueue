import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, CheckCircle, AlertCircle, Bell, ArrowLeft, Users } from 'lucide-react';
import { usePatientSocket } from '../hooks/useSocket';

const CLINIC_ID = import.meta.env.VITE_CLINIC_ID ?? 'a0000000-0000-0000-0000-000000000001';

const STATUS_CONFIG = {
  waiting: {
    color: 'text-amber-400',
    bg: 'bg-amber-900/20 border-amber-700/30',
    dot: 'bg-amber-400 pulse-amber',
    label: 'In Queue',
  },
  called: {
    color: 'text-blue-400',
    bg: 'bg-blue-900/20 border-blue-700/30 called-glow',
    dot: 'bg-blue-400 pulse-blue',
    label: "It's Your Turn!",
  },
  serving: {
    color: 'text-emerald-400',
    bg: 'bg-emerald-900/20 border-emerald-700/30',
    dot: 'bg-emerald-400',
    label: 'Being Served',
  },
  done: {
    color: 'text-slate-400',
    bg: 'bg-slate-800/50 border-slate-700/30',
    dot: 'bg-slate-400',
    label: 'Completed',
  },
  no_show: {
    color: 'text-red-400',
    bg: 'bg-red-900/20 border-red-700/30',
    dot: 'bg-red-400',
    label: 'Removed from queue',
  },
};

export default function StatusPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const ticketNumber = searchParams.get('ticket');
  const patientName = searchParams.get('name') ?? 'Patient';

  const { connected, update } = usePatientSocket(CLINIC_ID, patientId);

  // Find this patient's entry in the public queue
  const myEntry = update?.queue.find(p => p.ticketNumber === Number(ticketNumber));
  const status = (myEntry?.status ?? 'waiting') as keyof typeof STATUS_CONFIG;
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.waiting;

  // Notify when called
  const [notified, setNotified] = useState(false);
  useEffect(() => {
    if (status === 'called' && !notified) {
      setNotified(true);
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Your turn!', { body: `Please come to reception. Ticket #${ticketNumber}` });
      }
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    }
  }, [status, notified, ticketNumber]);

  const requestNotification = () => {
    if ('Notification' in window) Notification.requestPermission();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">

        {/* Back */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1 text-slate-400 hover:text-white text-sm mb-6 transition-colors"
        >
          <ArrowLeft size={16} /> Back to Join
        </button>

        {/* Connection indicator */}
        <div className={`flex items-center gap-1.5 text-xs mb-4 ${connected ? 'text-emerald-400' : 'text-slate-500'}`}>
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 pulse-green' : 'bg-slate-500'}`} />
          {connected ? 'Live updates' : 'Reconnecting...'}
        </div>

        {/* Ticket card */}
        <motion.div
          layout
          className={`card border ${cfg.bg} mb-4 text-center`}
        >
          <p className="text-slate-400 text-sm mb-2">Your Ticket</p>
          <p className="text-7xl font-bold text-white ticket-glow mb-3">
            #{ticketNumber}
          </p>
          <p className="text-slate-300 text-sm mb-4">Hi, {patientName}</p>

          {/* Status badge */}
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border ${cfg.bg}`}>
            <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
            <span className={`font-semibold ${cfg.color}`}>{cfg.label}</span>
          </div>
        </motion.div>

        {/* Position / wait info */}
        <AnimatePresence mode="wait">
          {status === 'waiting' && myEntry && (
            <motion.div
              key="waiting"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="card mb-4"
            >
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-3xl font-bold text-white">#{myEntry.position}</p>
                  <p className="text-slate-400 text-xs mt-1 flex items-center gap-1 justify-center">
                    <Users size={11} /> Position in queue
                  </p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-white">{myEntry.estimatedWaitMinutes}</p>
                  <p className="text-slate-400 text-xs mt-1 flex items-center gap-1 justify-center">
                    <Clock size={11} /> Est. minutes
                  </p>
                </div>
              </div>

              {/* Confidence band visual — honest range, not a false-precise number */}
              <div className="mt-4 pt-4 border-t border-surface-border">
                <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                  <span>Likely range</span>
                  <span>{Math.max(0, myEntry.estimatedWaitMinutes - 5)}–{myEntry.estimatedWaitMinutes + 10} min</span>
                </div>
                <div className="h-2 bg-surface-hover rounded-full overflow-hidden relative">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: '70%' }}
                    transition={{ duration: 0.6 }}
                    className="h-full bg-gradient-to-r from-brand-600 to-brand-400 rounded-full"
                  />
                </div>
                <p className="text-slate-600 text-xs mt-1.5">Based on recent service times at this clinic</p>
              </div>
              {myEntry.position <= 3 && (
                <div className="mt-3 bg-amber-900/30 border border-amber-700/40 rounded-lg px-3 py-2 text-amber-300 text-sm text-center">
                  Almost your turn — please stay nearby!
                </div>
              )}
            </motion.div>
          )}

          {status === 'called' && (
            <motion.div
              key="called"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="card border border-blue-700/50 bg-blue-900/20 mb-4 text-center"
            >
              <Bell size={36} className="text-blue-400 mx-auto mb-2" />
              <p className="text-blue-300 font-semibold text-lg">Please come to reception now!</p>
              <p className="text-slate-400 text-sm mt-1">Show this screen at the front desk</p>
            </motion.div>
          )}

          {status === 'done' && (
            <motion.div
              key="done"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="card text-center mb-4"
            >
              <CheckCircle size={40} className="text-emerald-400 mx-auto mb-2" />
              <p className="text-white font-semibold">Visit complete</p>
              <p className="text-slate-400 text-sm mt-1">Thank you for visiting!</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Queue overview */}
        {update && (
          <div className="card">
            <p className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-3">
              Clinic Status — {update.clinic.name}
            </p>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div>
                <p className="text-xl font-bold text-amber-400">{update.stats.waiting}</p>
                <p className="text-slate-500 text-xs">Waiting</p>
              </div>
              <div>
                <p className="text-xl font-bold text-emerald-400">{update.stats.serving}</p>
                <p className="text-slate-500 text-xs">Serving</p>
              </div>
              <div>
                <p className="text-xl font-bold text-slate-400">{update.stats.done}</p>
                <p className="text-slate-500 text-xs">Done today</p>
              </div>
            </div>
          </div>
        )}

        {/* Notification prompt */}
        {'Notification' in window && Notification.permission === 'default' && status === 'waiting' && (
          <button
            onClick={requestNotification}
            className="mt-4 w-full py-2 text-sm text-slate-400 border border-surface-border rounded-lg hover:border-brand-600 hover:text-brand-400 transition-colors flex items-center gap-2 justify-center"
          >
            <Bell size={14} /> Enable push notifications for your turn
          </button>
        )}

        {/* Leave queue */}
        {(status === 'waiting') && (
          <button
            onClick={() => navigate('/')}
            className="mt-3 w-full text-center text-xs text-red-400/60 hover:text-red-400 transition-colors py-2"
          >
            Leave queue
          </button>
        )}
      </div>
    </div>
  );
}
