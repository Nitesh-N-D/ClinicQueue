import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, ChevronDown, TrendingUp, TrendingDown } from 'lucide-react';
import { QueueHealth } from '../shared/types';
import clsx from 'clsx';

const STATUS_CONFIG = {
  excellent: { color: '#34d399', label: 'Excellent', bg: 'bg-emerald-900/20', border: 'border-emerald-700/40', ring: '#34d399' },
  good:      { color: '#60a5fa', label: 'Good',      bg: 'bg-blue-900/20',    border: 'border-blue-700/40',    ring: '#60a5fa' },
  strained:  { color: '#fbbf24', label: 'Strained',   bg: 'bg-amber-900/20',   border: 'border-amber-700/40',   ring: '#fbbf24' },
  critical:  { color: '#f87171', label: 'Critical',   bg: 'bg-red-900/20',     border: 'border-red-700/40',     ring: '#f87171' },
};

export default function QueueHealthWidget({ health }: { health: QueueHealth | null }) {
  const [expanded, setExpanded] = useState(false);

  if (!health) return null;
  const cfg = STATUS_CONFIG[health.status];

  // SVG ring math
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (health.score / 100) * circumference;

  return (
    <div className={clsx('card border', cfg.bg, cfg.border)}>
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 text-left"
      >
        {/* Ring score */}
        <div className="relative w-16 h-16 flex-shrink-0">
          <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
            <circle cx="32" cy="32" r={radius} fill="none" stroke="#1e293b" strokeWidth="6" />
            <motion.circle
              cx="32" cy="32" r={radius} fill="none"
              stroke={cfg.ring} strokeWidth="6" strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold text-white">{health.score}</span>
          </div>
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Activity size={15} style={{ color: cfg.color }} />
            <span className="font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
          </div>
          <p className="text-slate-500 text-xs mt-0.5">Queue health score · tap for details</p>
        </div>

        <ChevronDown size={18} className={clsx('text-slate-500 transition-transform', expanded && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-3 mt-3 border-t border-surface-border space-y-2">
              {health.factors.map((f, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  {f.impact === 'positive' ? (
                    <TrendingUp size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                  ) : (
                    <TrendingDown size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
                  )}
                  <div>
                    <span className={clsx('font-medium', f.impact === 'positive' ? 'text-emerald-300' : 'text-red-300')}>
                      {f.label}
                    </span>
                    <p className="text-slate-500 text-xs">{f.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
