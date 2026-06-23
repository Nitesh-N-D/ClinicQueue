import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { NoShowRisk } from '../shared/types';
import clsx from 'clsx';

const RISK_CONFIG = {
  low:    { color: 'text-slate-500', bg: '', label: 'Low risk' },
  medium: { color: 'text-amber-400', bg: 'bg-amber-900/20 border border-amber-700/30', label: 'Medium risk' },
  high:   { color: 'text-red-400',   bg: 'bg-red-900/20 border border-red-700/30',   label: 'High no-show risk' },
};

export default function NoShowBadge({ risk }: { risk?: NoShowRisk }) {
  const [showTip, setShowTip] = useState(false);
  if (!risk || risk.riskLevel === 'low') return null;

  const cfg = RISK_CONFIG[risk.riskLevel];

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setShowTip(s => !s)}
        onMouseEnter={() => setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
        className={clsx('flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', cfg.bg, cfg.color)}
      >
        <AlertTriangle size={11} />
        {cfg.label}
      </button>
      {showTip && (
        <div className="absolute z-20 bottom-full left-0 mb-1.5 w-48 bg-slate-950 border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-300 shadow-xl">
          <span className="font-medium text-white">{risk.riskScore}% predicted risk</span>
          <p className="text-slate-400 mt-0.5">Based on {risk.reason}</p>
        </div>
      )}
    </div>
  );
}
