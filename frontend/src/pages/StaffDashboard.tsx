import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, CheckCircle, XCircle, ChevronRight,
  UserCheck, Wifi, WifiOff, Plus, Minus, Power,
  Clock, Activity, Bell, QrCode, Keyboard,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStaffSocket } from '../hooks/useSocket';
import { EnrichedPatient, QueueStats } from '../shared/types';
import QueueHealthWidget from '../components/QueueHealthWidget';
import NoShowBadge from '../components/NoShowBadge';
import TeamPanel from '../components/TeamPanel';
import { getMe } from '../lib/api';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const CLINIC_ID = import.meta.env.VITE_CLINIC_ID ?? 'a0000000-0000-0000-0000-000000000001';

interface Props { pin: string; authMode: 'pin' | 'google'; accessToken?: string; onLogout: () => void; }

export default function StaffDashboard({ pin, authMode, accessToken, onLogout }: Props) {
  const navigate = useNavigate();
  const credential = authMode === 'google' ? { accessToken } : { pin };
  const { connected, state, error, callNext, markServing, markDone, markNoShow, updateStaffCount, toggleOpen } = useStaffSocket(CLINIC_ID, credential);
  const [activeTab, setActiveTab] = useState<'queue' | 'done'>('queue');
  const [showConfirm, setShowConfirm] = useState<{ action: string; patientId: string; name: string } | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showTeamPanel, setShowTeamPanel] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const prevCalledCount = React.useRef(0);

  // Determine if current user is admin (only relevant for Google auth mode)
  useEffect(() => {
    if (authMode !== 'google') return;
    getMe(CLINIC_ID).then(res => {
      setIsAdmin(res.staffMember?.role === 'admin');
    }).catch(() => {});
  }, [authMode]);

  // Audible chime when a new patient is called (distinct from browser tab title alert)
  useEffect(() => {
    if (!state) return;
    const calledCount = state.queue.filter(p => p.status === 'called').length;
    if (calledCount > prevCalledCount.current) {
      try {
        const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start(); osc.stop(ctx.currentTime + 0.4);
      } catch { /* audio not available, ignore */ }
    }
    prevCalledCount.current = calledCount;
  }, [state]);

  // Keyboard shortcuts: N = call next, ? = show shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'n' || e.key === 'N') { handleCallNext(); }
      if (e.key === '?') { setShowShortcuts(s => !s); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // Audible alert when patient is called
  useEffect(() => {
    if (!state) return;
    const called = state.queue.filter(p => p.status === 'called');
    if (called.length > 0) document.title = `🔔 ${called.length} patient(s) called — ClinicQueue`;
    else document.title = 'ClinicQueue Staff';
  }, [state]);

  const handleCallNext = () => {
    callNext();
    toast.success('Next patient called!');
  };

  const confirmAction = (action: string, patientId: string, name: string) => {
    setShowConfirm({ action, patientId, name });
  };

  const executeConfirm = () => {
    if (!showConfirm) return;
    const { action, patientId, name } = showConfirm;
    if (action === 'done')    { markDone(patientId);    toast.success(`${name} — marked done`); }
    if (action === 'no_show') { markNoShow(patientId);  toast(`${name} — marked no-show`, { icon: '⚠️' }); }
    if (action === 'serving') { markServing(patientId); toast.success(`Now serving ${name}`); }
    setShowConfirm(null);
  };

  if (!state && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-400">Connecting to queue...</p>
        </div>
      </div>
    );
  }

  if (error && !state) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-red-400">
          <XCircle size={40} className="mx-auto mb-2" />
          <p>{error}</p>
          <button onClick={onLogout} className="btn-secondary mt-4">Try again</button>
        </div>
      </div>
    );
  }

  const stats: QueueStats = state?.stats ?? { waiting: 0, serving: 0, done: 0, avgWaitMinutes: 0, estimatedWaitForNew: 0, staffActive: 1 };
  const waiting = state?.queue.filter(p => p.status === 'waiting') ?? [];
  const called  = state?.queue.filter(p => p.status === 'called')  ?? [];
  const serving = state?.queue.filter(p => p.status === 'serving') ?? [];
  const active  = [...called, ...serving, ...waiting];
  const done    = state?.done ?? [];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar */}
      <header className="bg-surface-card border-b border-surface-border px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-white">🏥 ClinicQueue</span>
          <span className="text-slate-500 text-sm hidden sm:block">{state?.clinic.name}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className={clsx('flex items-center gap-1 text-xs', connected ? 'text-emerald-400' : 'text-slate-500')}>
            {connected ? <Wifi size={13} /> : <WifiOff size={13} />}
            <span className="hidden sm:block">{connected ? 'Live' : 'Offline'}</span>
          </div>
          {/* Staff count */}
          <div className="flex items-center gap-1 bg-surface-hover rounded-lg px-2 py-1">
            <button onClick={() => updateStaffCount(Math.max(1, stats.staffActive - 1))} className="text-slate-400 hover:text-white">
              <Minus size={14} />
            </button>
            <span className="text-white text-sm min-w-[20px] text-center font-medium">{stats.staffActive}</span>
            <button onClick={() => updateStaffCount(stats.staffActive + 1)} className="text-slate-400 hover:text-white">
              <Plus size={14} />
            </button>
            <span className="text-slate-500 text-xs ml-1">staff</span>
          </div>
          {/* Open/close toggle */}
          <button
            onClick={() => toggleOpen(!state?.clinic.isOpen)}
            className={clsx('flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border transition-all',
              state?.clinic.isOpen
                ? 'bg-emerald-900/30 border-emerald-700/50 text-emerald-400'
                : 'bg-red-900/30 border-red-700/50 text-red-400'
            )}
          >
            <Power size={12} />
            {state?.clinic.isOpen ? 'Open' : 'Closed'}
          </button>
          <button onClick={() => navigate('/poster')} className="text-slate-500 hover:text-white" title="Print QR poster">
            <QrCode size={16} />
          </button>
          {authMode === 'google' && (
            <button onClick={() => setShowTeamPanel(true)} className="text-slate-500 hover:text-white" title="Manage team">
              <Users size={16} />
            </button>
          )}
          <button onClick={() => setShowShortcuts(true)} className="text-slate-500 hover:text-white hidden sm:block" title="Keyboard shortcuts">
            <Keyboard size={16} />
          </button>
          <button onClick={onLogout} className="text-slate-500 hover:text-white text-xs">
            Exit
          </button>
        </div>
      </header>

      {/* Queue health widget */}
      {state?.health && (
        <div className="p-3 bg-surface-card border-b border-surface-border">
          <QueueHealthWidget health={state.health} />
        </div>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-2 p-3 bg-surface-card border-b border-surface-border">
        {[
          { label: 'Waiting', value: stats.waiting, color: 'text-amber-400' },
          { label: 'Serving', value: stats.serving, color: 'text-emerald-400' },
          { label: 'Avg wait', value: `${stats.avgWaitMinutes}m`, color: 'text-brand-400' },
          { label: 'Done today', value: stats.done, color: 'text-slate-400' },
        ].map(s => (
          <div key={s.label} className="text-center">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-slate-500 text-xs">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Call Next button */}
      <div className="p-3 bg-surface-card border-b border-surface-border">
        <button
          onClick={handleCallNext}
          disabled={waiting.length === 0}
          className="btn-primary w-full py-3 text-base disabled:opacity-40"
        >
          <Bell size={18} />
          Call Next Patient
          {waiting.length > 0 && (
            <span className="ml-auto bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">
              {waiting.length} waiting
            </span>
          )}
        </button>
        {stats.estimatedWaitForNew > 0 && (
          <p className="text-center text-xs text-slate-500 mt-1">
            <Clock size={10} className="inline mr-1" />
            New patient would wait ~{stats.estimatedWaitForNew} min
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-surface-border">
        {(['queue', 'done'] as const).map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={clsx('flex-1 py-2.5 text-sm font-medium transition-colors border-b-2',
              activeTab === t
                ? 'border-brand-500 text-white'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            )}
          >
            {t === 'queue' ? `Active Queue (${active.length})` : `Done Today (${done.length})`}
          </button>
        ))}
      </div>

      {/* Queue list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {activeTab === 'queue' && (
          <>
            {active.length === 0 && (
              <div className="text-center py-16 text-slate-500">
                <Users size={40} className="mx-auto mb-2 opacity-30" />
                <p>Queue is empty</p>
              </div>
            )}
            <AnimatePresence>
              {active.map(patient => (
                <PatientCard
                  key={patient.id}
                  patient={patient}
                  onMarkServing={id => confirmAction('serving', id, patient.name)}
                  onMarkDone={id => confirmAction('done', id, patient.name)}
                  onMarkNoShow={id => confirmAction('no_show', id, patient.name)}
                />
              ))}
            </AnimatePresence>
          </>
        )}

        {activeTab === 'done' && (
          <>
            {done.length === 0 && (
              <div className="text-center py-16 text-slate-500">
                <CheckCircle size={40} className="mx-auto mb-2 opacity-30" />
                <p>No completed visits yet today</p>
              </div>
            )}
            {done.map(patient => (
              <div key={patient.id} className="card opacity-60 flex items-center justify-between">
                <div>
                  <span className="text-slate-300 text-sm font-medium">#{patient.ticketNumber} — {patient.name}</span>
                  <p className="text-slate-500 text-xs mt-0.5">
                    {patient.status === 'done' ? '✓ Completed' : '⚠ No-show'}
                    {patient.completedAt && ` · ${new Date(patient.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                  </p>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Confirm modal */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4"
            onClick={() => setShowConfirm(null)}
          >
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              className="card w-full max-w-sm"
              onClick={e => e.stopPropagation()}
            >
              <p className="text-white font-semibold mb-1">Confirm action</p>
              <p className="text-slate-400 text-sm mb-4">
                Mark <strong className="text-white">{showConfirm.name}</strong> as{' '}
                <strong className="text-white">{showConfirm.action.replace('_', '-')}</strong>?
              </p>
              <div className="flex gap-2">
                <button onClick={() => setShowConfirm(null)} className="btn-secondary flex-1">Cancel</button>
                <button
                  onClick={executeConfirm}
                  className={showConfirm.action === 'no_show' ? 'btn-danger flex-1' : 'btn-primary flex-1'}
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showTeamPanel && (
          <TeamPanel onClose={() => setShowTeamPanel(false)} isAdmin={isAdmin} />
        )}
      </AnimatePresence>

      {/* Keyboard shortcuts modal */}
      <AnimatePresence>
        {showShortcuts && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
            onClick={() => setShowShortcuts(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="card w-full max-w-xs" onClick={e => e.stopPropagation()}
            >
              <p className="text-white font-semibold mb-3">Keyboard shortcuts</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-400">Call next patient</span><kbd className="bg-surface-hover px-2 py-0.5 rounded text-slate-300 font-mono">N</kbd></div>
                <div className="flex justify-between"><span className="text-slate-400">Show this menu</span><kbd className="bg-surface-hover px-2 py-0.5 rounded text-slate-300 font-mono">?</kbd></div>
              </div>
              <button onClick={() => setShowShortcuts(false)} className="btn-secondary w-full mt-4">Close</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Patient card component ───────────────────────────────────────────────────

interface PatientCardProps {
  patient: EnrichedPatient;
  onMarkServing: (id: string) => void;
  onMarkDone: (id: string) => void;
  onMarkNoShow: (id: string) => void;
}

function PatientCard({ patient, onMarkServing, onMarkDone, onMarkNoShow }: PatientCardProps) {
  const statusStyles = {
    waiting: 'border-l-amber-500',
    called:  'border-l-blue-500 called-glow',
    serving: 'border-l-emerald-500',
    done:    'border-l-slate-600',
    no_show: 'border-l-red-700',
  };

  const waitedMin = Math.round((Date.now() - patient.joinedAt) / 60_000);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      className={clsx('card border-l-4 flex flex-col gap-2', statusStyles[patient.status])}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-white">#{patient.ticketNumber}</span>
          <div>
            <p className="text-white text-sm font-medium leading-tight">{patient.name}</p>
            <p className="text-slate-400 text-xs">
              {patient.type === 'appointment' ? '📅 Appointment' : '🚶 Walk-in'}
              {patient.reason && ` · ${patient.reason}`}
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className={clsx('text-xs px-2 py-0.5 rounded-full border inline-block',
            `badge-${patient.status}`
          )}>
            {patient.status.replace('_', ' ')}
          </span>
          <p className="text-slate-500 text-xs mt-0.5">{waitedMin}m ago</p>
        </div>
      </div>

      {/* Info row */}
      <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
        <span>📱 {patient.phone}</span>
        <span>🌐 {patient.language.toUpperCase()}</span>
        {patient.position > 0 && <span>#{patient.position} in queue</span>}
        <NoShowBadge risk={patient.noShowRisk} />
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap">
        {patient.status === 'waiting' || patient.status === 'called' ? (
          <>
            <button
              onClick={() => onMarkServing(patient.id)}
              className="btn-success flex-1 py-1.5 text-xs"
            >
              <UserCheck size={13} /> Serving
            </button>
            <button
              onClick={() => onMarkNoShow(patient.id)}
              className="btn-danger flex-1 py-1.5 text-xs"
            >
              <XCircle size={13} /> No-show
            </button>
          </>
        ) : patient.status === 'serving' ? (
          <>
            <button
              onClick={() => onMarkDone(patient.id)}
              className="btn-success flex-1 py-1.5 text-xs"
            >
              <CheckCircle size={13} /> Done
            </button>
            <button
              onClick={() => onMarkNoShow(patient.id)}
              className="btn-danger py-1.5 text-xs px-3"
            >
              <XCircle size={13} />
            </button>
          </>
        ) : null}
      </div>
    </motion.div>
  );
}
